import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from '@nginz/config';
import { createLogger } from '@nginz/logger';
import { requestIdMiddleware, RequestWithId } from '@nginz/tracing';
import { errorHandler } from '@nginz/middleware';
import { register, httpRequestsTotal, httpRequestDurationMs, activeConnections } from '@nginz/metrics';
import { getRedisClient } from '@nginz/redis';
import { connectRabbitMQ } from '@nginz/rabbitmq';
import { Pool } from 'pg';
import { jwtAuthMiddleware } from './middlewares/auth';
import { rateLimiterMiddleware } from './middlewares/rateLimiter';
import { proxyToAuthService } from './services/proxy';
import { dynamicProxyHandler } from './services/dynamicProxy';
import gatewayRoutes from './routes/gatewayRoutes';
import { discovery } from './services/discovery';

const logger = createLogger('gateway');

export const app = express();

// Start discovery client background refresh
discovery.start(5000);

app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Active connections & metrics tracking middleware
app.use((req: Request, res: Response, next) => {
  activeConnections.inc();
  const start = Date.now();

  res.on('finish', () => {
    activeConnections.dec();
    const duration = Date.now() - start;
    const route = req.route ? req.route.path : req.path;
    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode.toString() });
    httpRequestDurationMs.observe({ method: req.method, route, status: res.statusCode.toString() }, duration);
  });

  next();
});

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
export const pgPool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

// Root Gateway Info Endpoint
app.get('/', (req: RequestWithId, res: Response) => {
  res.json({
    name: 'NginZ — Cloud-Native API Gateway Platform',
    version: '1.0.0',
    status: 'ONLINE',
    requestId: req.requestId,
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      stats: '/api/gateway/stats',
      services: '/api/gateway/services',
      circuitBreakers: '/api/gateway/circuit-breakers',
      rateLimit: '/api/gateway/rate-limit',
      auth: '/api/auth/login',
    },
    dashboard: 'http://localhost:8080',
    timestamp: new Date().toISOString(),
  });
});

// Metrics Endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// Gateway Management Endpoints
app.use('/api/gateway', gatewayRoutes);

// Distributed Rate Limiter Middleware
app.use(rateLimiterMiddleware);

// Auth Service proxy (unauthenticated login/register operations)
app.use('/api/auth', proxyToAuthService);

// JWT Authentication for protected endpoints
app.use('/api', jwtAuthMiddleware);

// Health Check Endpoint
app.get('/health', async (req: RequestWithId, res: Response) => {
  let dbStatus = 'DOWN';
  let redisStatus = 'DOWN';
  let rabbitStatus = 'DOWN';

  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    dbStatus = 'UP';
  } catch (err: any) {
    logger.error('PostgreSQL health check failed', { requestId: req.requestId, error: err.message });
  }

  try {
    const redis = getRedisClient();
    const pingRes = await redis.ping();
    if (pingRes === 'PONG') redisStatus = 'UP';
  } catch (err: any) {
    logger.error('Redis health check failed', { requestId: req.requestId, error: err.message });
  }

  try {
    const { connection } = await connectRabbitMQ();
    if (connection) rabbitStatus = 'UP';
  } catch (err: any) {
    logger.error('RabbitMQ health check failed', { requestId: req.requestId, error: err.message });
  }

  const overallStatus = dbStatus === 'UP' && redisStatus === 'UP' && rabbitStatus === 'UP' ? 'UP' : 'DEGRADED';

  res.status(200).json({
    status: overallStatus,
    service: 'gateway',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    dependencies: {
      postgres: dbStatus,
      redis: redisStatus,
      rabbitmq: rabbitStatus,
    },
  });
});

// Dynamic Microservices Reverse Proxy Handler
app.use('/api', dynamicProxyHandler);

app.use(errorHandler);
