import express, { Request, Response } from 'express';
import cors from 'cors';
import { requestIdMiddleware, RequestWithId } from '@nginz/tracing';
import { errorHandler, createChaosRouter, chaosMiddleware } from '@nginz/middleware';
import { register, httpRequestsTotal, httpRequestDurationMs, activeConnections } from '@nginz/metrics';
import authRoutes from './routes/authRoutes';
import { pgPool } from './repositories/userRepository';

export const app = express();

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

// Metrics Endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// Chaos Management Endpoints
app.use('/chaos', createChaosRouter());

// Chaos Middleware
app.use(chaosMiddleware);

// Routes
app.use('/auth', authRoutes);

// Health Endpoint
app.get('/health', async (req: RequestWithId, res: Response) => {
  let dbStatus = 'DOWN';
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1;');
    client.release();
    dbStatus = 'UP';
  } catch (err: any) {
    dbStatus = 'DOWN';
  }

  res.json({
    status: dbStatus === 'UP' ? 'UP' : 'DEGRADED',
    service: 'auth-service',
    instance: process.env.INSTANCE_ID || 'auth-service-1',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    dependencies: { postgres: dbStatus },
  });
});

app.use(errorHandler);
