import http from 'node:http';
import https from 'node:https';
import { Request, Response } from 'express';
import { discovery } from './discovery';
import { loadBalancer } from './loadBalancer';
import { ServiceInstanceInfo } from '@nginz/middleware';
import { createLogger } from '@nginz/logger';

const logger = createLogger('gateway-auth-proxy');

export const proxyToAuthService = async (req: Request, res: Response): Promise<void> => {
  const instances = discovery.getInstances('auth-service');

  // Fallback to static config if discovery is initializing
  let selectedInstance: ServiceInstanceInfo | null = null;

  if (instances && instances.length > 0) {
    selectedInstance = loadBalancer.selectInstance('auth-service', instances, 'round-robin', {
      clientIp: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });
  }

  const hostname = selectedInstance?.host || process.env.AUTH_SERVICE_HOST || 'auth-service-1';
  const port = selectedInstance?.port || Number(process.env.AUTH_SERVICE_PORT || 3001);

  const targetPath = `/auth${req.path.replace(/^\/auth/, '') || '/'}`;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {});
  const headers: Record<string, string | number> = {
    host: `${hostname}:${port}`,
    'x-request-id': String(req.headers['x-request-id'] || ''),
  };

  if (body) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(body);
  }

  const transport = port === 443 ? https : http;
  const reqOptions = {
    hostname,
    port,
    method: req.method,
    path: targetPath,
    headers,
    timeout: 5000,
  };

  const upstream = transport.request(reqOptions, (response) => {
    res.status(response.statusCode || 502);
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined && key !== 'transfer-encoding') {
        res.setHeader(key, value as string | string[]);
      }
    }
    response.pipe(res);
  });

  upstream.on('error', (err) => {
    logger.error('Auth service proxy error', { error: err.message, host: hostname, port });
    res.status(503).json({ error: true, message: 'Auth service unavailable', detail: err.message });
  });

  if (body) upstream.write(body);
  upstream.end();
};
