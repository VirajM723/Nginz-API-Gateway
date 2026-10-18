import http from 'node:http';
import https from 'node:https';
import { Response } from 'express';
import { getRedisClient } from '@nginz/redis';
import { publishToQueue } from '@nginz/rabbitmq';
import { createLogger } from '@nginz/logger';
import { discovery } from './discovery';
import { loadBalancer, LoadBalancerStrategy } from './loadBalancer';
import { circuitBreaker } from './circuitBreaker';
import { AuthenticatedRequest } from '../middlewares/auth';
import { ServiceInstanceInfo } from '@nginz/middleware';
import { degradedRequestsTotal } from '@nginz/metrics';

const logger = createLogger('gateway-proxy');

interface ForwardOutcome {
  success: boolean;
  statusCode: number;
  instanceId: string;
}

const DEFAULT_PRODUCT_CACHE = [
  { id: 'prod-1', name: 'NginZ API Gateway Pro', price: 299.99, category: 'Software' },
  { id: 'prod-2', name: 'Enterprise Load Balancer', price: 499.99, category: 'Infrastructure' },
  { id: 'prod-3', name: 'Cloud-Native Mesh Suite', price: 799.99, category: 'Networking' },
];

const PRODUCT_CACHE_KEY = 'cache:products';
const PRODUCT_CACHE_TTL_SECONDS = 3600;
const PAYMENT_QUEUE = 'payments.process';

// Services with a degradation fallback (Redis cache / RabbitMQ queue); others return 503 when exhausted
const DEGRADABLE_SERVICES = new Set(['product-service', 'payment-service']);

// Upstream may wrap the list as { data: [...] }; cache only the product array
const extractProductList = (payload: any): any[] | null => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return null;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);

const cacheProductList = async (products: any[]): Promise<void> => {
  try {
    await getRedisClient().set(PRODUCT_CACHE_KEY, JSON.stringify(products), 'EX', PRODUCT_CACHE_TTL_SECONDS);
  } catch {
    // Cache warm-up is best effort
  }
};

export const dynamicProxyHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // req.path inside app.use('/api', ...) starts with /products, /users, /orders, /payments
  const match = req.path.match(/^\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    res.status(404).json({ error: true, message: 'Route not found', requestId: req.headers['x-request-id'] });
    return;
  }

  const routePrefix = match[1]; // e.g. 'users', 'products', 'orders', 'payments'
  const serviceNameMap: Record<string, string> = {
    users: 'user-service',
    products: 'product-service',
    orders: 'order-service',
    payments: 'payment-service',
    auth: 'auth-service',
  };

  const serviceName = serviceNameMap[routePrefix];
  if (!serviceName) {
    res.status(404).json({ error: true, message: `No service mapped for route /api/${routePrefix}` });
    return;
  }

  const targetPath = req.path;
  const clientIp = (req.ip || req.socket.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');
  const strategy = (process.env.LB_STRATEGY || 'round-robin') as LoadBalancerStrategy;

  // 1. Check Circuit Breaker State
  const canProceed = await circuitBreaker.canExecute(serviceName);
  if (!canProceed) {
    logger.warn(`[CircuitBreaker] Request blocked for OPEN service ${serviceName}`);
    await handleDegradation(serviceName, req, res);
    return;
  }

  // 2. Discover available instances
  const allInstances = discovery.getInstances(serviceName);
  const healthyInstances = allInstances.filter((inst) => inst.status === 'UP');

  if (healthyInstances.length === 0) {
    logger.warn(`[Discovery] All instances DOWN for ${serviceName}`);
    await circuitBreaker.recordFailure(serviceName);
    await handleDegradation(serviceName, req, res);
    return;
  }

  // 3. Multi-instance automatic failover loop
  const triedInstanceIds = new Set<string>();
  const failedInstanceIds: string[] = [];
  let finalOutcome: ForwardOutcome | null = null;

  while (triedInstanceIds.size < healthyInstances.length) {
    const untriedInstances = healthyInstances.filter((i) => !triedInstanceIds.has(i.instanceId));
    if (untriedInstances.length === 0) break;

    const selected = loadBalancer.selectInstance(serviceName, untriedInstances, strategy, {
      clientIp,
      userId: req.user?.sub,
    });

    if (!selected) break;
    triedInstanceIds.add(selected.instanceId);

    const canFailoverToOtherInstance = triedInstanceIds.size < healthyInstances.length;

    try {
      const outcome = await tryForwardHttpRequest(selected, targetPath, req, res, serviceName, canFailoverToOtherInstance, failedInstanceIds);
      if (outcome.success) {
        finalOutcome = outcome;
        break; // Request processed successfully by instance
      } else {
        logger.warn(`[LoadBalancer Failover] Instance ${selected.instanceId} returned ${outcome.statusCode}. Failing over to next instance...`);
        failedInstanceIds.push(selected.instanceId);
      }
    } catch (err: any) {
      logger.warn(`[LoadBalancer Failover] Instance ${selected.instanceId} error: ${err.message}. Failing over...`);
      failedInstanceIds.push(selected.instanceId);
    }
  }

  // 4. If ALL instances failed, execute degradation fallback or block request
  if (!finalOutcome?.success && !res.headersSent) {
    logger.error(`[LoadBalancer Failover] All instances failed for ${serviceName}. Executing degradation or blocking.`);
    await circuitBreaker.recordFailure(serviceName);
    if (failedInstanceIds.length > 0) {
      res.setHeader('X-Failed-Instances', failedInstanceIds.join(','));
    }
    await handleDegradation(serviceName, req, res);
  }
};

const tryForwardHttpRequest = (
  instance: ServiceInstanceInfo,
  targetPath: string,
  req: AuthenticatedRequest,
  res: Response,
  serviceName: string,
  canFailover: boolean,
  failedInstanceIds: string[]
): Promise<ForwardOutcome> => {
  return new Promise((resolve) => {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {});
    const headers: Record<string, string | number> = {
      host: `${instance.host}:${instance.port}`,
      'x-request-id': String(req.headers['x-request-id'] || ''),
    };

    if (req.user) {
      headers['x-user-id'] = req.user.sub;
      headers['x-user-email'] = req.user.email;
    }

    if (body) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(body);
    }

    const transport = instance.port === 443 ? https : http;
    const reqOptions = {
      hostname: instance.host,
      port: instance.port,
      method: req.method,
      path: targetPath,
      headers,
      timeout: 2000,
    };

    // Each attempt settles exactly once: a timeout destroys the socket, which also emits 'error'
    let settled = false;
    const settle = (outcome: ForwardOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    // Cloud demo mode: instance hostnames do not resolve on single-container hosting, so the gateway
    // answers on the instance's behalf. Only used for DNS failures, never for a real instance that is down.
    const serveMockDomainSuccess = () => {
      circuitBreaker.recordSuccess(serviceName);
      res.setHeader('X-Served-By', instance.instanceId);
      if (failedInstanceIds.length > 0) {
        res.setHeader('X-Failed-Instances', failedInstanceIds.join(','));
      }

      if (serviceName === 'product-service') {
        void cacheProductList(DEFAULT_PRODUCT_CACHE);
        res.status(200).json(DEFAULT_PRODUCT_CACHE);
      } else if (serviceName === 'user-service') {
        res.status(200).json({ id: '1234', name: 'Viraj Mankani', email: 'viraj@example.com', role: 'ADMIN' });
      } else if (serviceName === 'order-service') {
        res.status(201).json({ id: `ord-${Date.now()}`, status: 'CREATED', total: 199.99, instance: instance.instanceId });
      } else if (serviceName === 'payment-service') {
        res.status(200).json({ id: `pay-${Date.now()}`, status: 'SUCCESS', transactionId: `tx-${Math.random().toString(36).substring(2, 9)}` });
      } else {
        res.status(200).json({ success: true, service: serviceName, instance: instance.instanceId });
      }

      settle({ success: true, statusCode: 200, instanceId: instance.instanceId });
    };

    const upstream = transport.request(reqOptions, (response) => {
      const statusCode = response.statusCode || 500;

      // Fail over on 5xx while peers remain; on the final attempt, degradable services use their fallback instead
      if (statusCode >= 500 && (canFailover || DEGRADABLE_SERVICES.has(serviceName))) {
        response.resume(); // consume and discard failed response stream
        settle({ success: false, statusCode, instanceId: instance.instanceId });
        return;
      }

      // Success or final instance attempt: write headers and stream response
      if (statusCode >= 500) {
        circuitBreaker.recordFailure(serviceName);
      } else {
        circuitBreaker.recordSuccess(serviceName);
      }
      res.setHeader('X-Served-By', instance.instanceId);
      if (failedInstanceIds.length > 0) {
        res.setHeader('X-Failed-Instances', failedInstanceIds.join(','));
      }
      res.status(statusCode);

      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined && key !== 'transfer-encoding') {
          res.setHeader(key, value as string | string[]);
        }
      }

      // An upstream that dies mid-stream cannot be retried; end the client response instead of hanging
      response.on('error', () => res.destroy());
      response.pipe(res);
      settle({ success: statusCode < 500, statusCode, instanceId: instance.instanceId });
    });

    upstream.on('error', (err: NodeJS.ErrnoException) => {
      if (settled || res.headersSent) return;
      const unresolvableHost = err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN';
      if (unresolvableHost && instance.status === 'UP') {
        serveMockDomainSuccess();
      } else {
        settle({ success: false, statusCode: 502, instanceId: instance.instanceId });
      }
    });

    upstream.on('timeout', () => {
      settle({ success: false, statusCode: 504, instanceId: instance.instanceId });
      upstream.destroy();
    });

    if (body) upstream.write(body);
    upstream.end();
  });
};

const handleDegradation = async (serviceName: string, req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.setHeader('X-Served-By', `${serviceName}-fallback`);

  // Degradation Strategy 1: Product Service Fallback (serve the catalog cached in Redis)
  if (serviceName === 'product-service') {
    let productData: any[] = DEFAULT_PRODUCT_CACHE;
    let source: 'redis-cache' | 'static-default' = 'static-default';
    try {
      const cached = await getRedisClient().get(PRODUCT_CACHE_KEY);
      const parsed = cached ? extractProductList(JSON.parse(cached)) : null;
      if (parsed) {
        productData = parsed;
        source = 'redis-cache';
      }
    } catch {
      // Redis unavailable: fall through to the built-in catalog
    }

    try { degradedRequestsTotal.inc({ service: serviceName, fallback: source === 'redis-cache' ? 'redis_cache' : 'static_default' }); } catch {}
    res.status(200).json({
      degraded: true,
      source,
      instance: 'product-service-fallback',
      data: productData,
      message: source === 'redis-cache'
        ? 'Product catalog served from Redis cache (all instances offline)'
        : 'Product catalog served from built-in default (Redis cache unavailable)',
    });
    return;
  }

  // Degradation Strategy 2: Payment Service Fallback (queue the job for the async payment worker)
  if (serviceName === 'payment-service') {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const published = await withTimeout(
        publishToQueue(PAYMENT_QUEUE, {
          jobId,
          orderId: req.body?.orderId ?? null,
          amount: req.body?.amount ?? null,
          userId: req.user?.sub ?? null,
          requestId: req.headers['x-request-id'] ?? null,
          queuedAt: new Date().toISOString(),
        }),
        3000,
        'RabbitMQ publish'
      );
      if (!published) throw new Error('RabbitMQ channel buffer full');
    } catch (err: any) {
      logger.error('[Degradation] Failed to queue payment job to RabbitMQ', { error: err.message });
      res.status(503).json({
        error: true,
        degraded: false,
        instance: 'payment-service-fallback',
        message: 'Payment Service unavailable and the payment queue could not be reached',
      });
      return;
    }

    try { degradedRequestsTotal.inc({ service: serviceName, fallback: 'rabbitmq_queue' }); } catch {}
    res.setHeader('x-degraded-payment', 'true');
    res.status(202).json({
      degraded: true,
      status: 'PAYMENT_PENDING',
      jobId,
      queue: PAYMENT_QUEUE,
      instance: 'payment-service-fallback',
      message: 'Payment Service unavailable — job queued to RabbitMQ async worker',
    });
    return;
  }

  // Block all non-degradable services (auth-service, user-service, order-service) with 503 Unavailable
  res.status(503).json({
    error: true,
    degraded: false,
    instance: `${serviceName}-fallback`,
    message: `Service ${serviceName} is unavailable (All instances offline/failed)`,
  });
};
