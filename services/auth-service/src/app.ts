import express, { Request, Response } from 'express';
import cors from 'cors';
import { requestIdMiddleware, RequestWithId } from '@nginz/tracing';
import { errorHandler, createChaosRouter, chaosMiddleware } from '@nginz/middleware';
import authRoutes from './routes/authRoutes';
import { pgPool } from './repositories/userRepository';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

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
