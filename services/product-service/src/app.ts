import express, { Request, Response } from 'express';
import cors from 'cors';
import { requestIdMiddleware, RequestWithId } from '@nginz/tracing';
import { errorHandler, createChaosRouter, chaosMiddleware } from '@nginz/middleware';
import { Pool } from 'pg';
import { config } from '@nginz/config';
import productRoutes from './routes/productRoutes';

const isSsl = config.postgresUri.includes('sslmode=require') || config.postgresUri.includes('aivencloud.com');
const pool = new Pool({
  connectionString: config.postgresUri,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

export const app = express();

app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Chaos Management Endpoints (unaffected by chaos fault injection)
app.use('/chaos', createChaosRouter());

// Chaos Middleware (injects 500s, latency, random errors into normal API calls)
app.use(chaosMiddleware);

app.use('/products', productRoutes);

app.get('/health', async (req: RequestWithId, res: Response) => {
  let dbStatus = 'DOWN';
  try {
    const client = await pool.connect();
    await client.query('SELECT 1;');
    client.release();
    dbStatus = 'UP';
  } catch {
    dbStatus = 'DOWN';
  }

  res.json({
    status: dbStatus === 'UP' ? 'UP' : 'DEGRADED',
    service: 'product-service',
    instance: process.env.INSTANCE_ID || 'product-service-1',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    dependencies: { postgres: dbStatus },
  });
});

app.use(errorHandler);
