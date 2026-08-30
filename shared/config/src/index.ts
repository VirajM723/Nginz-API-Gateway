import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root if available
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  postgresUri: string;
  redisUri: string;
  rabbitmqUri: string;
  authServiceUrl: string;
  lbStrategy: string;
  rateLimitMaxTokens: number;
  rateLimitRefillRate: number;
  rateLimitWindowMs: number;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'nginz_default_super_secret_jwt_key_2026',
  postgresUri: process.env.POSTGRES_URI || 'postgresql://postgres:postgrespassword@localhost:5432/nginz',
  redisUri: process.env.REDIS_URI || 'redis://localhost:6379',
  rabbitmqUri: process.env.RABBITMQ_URI || 'amqp://guest:guest@localhost:5672',
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  lbStrategy: process.env.LB_STRATEGY || 'round-robin',
  rateLimitMaxTokens: parseInt(process.env.RATE_LIMIT_MAX_TOKENS || '100', 10),
  rateLimitRefillRate: parseInt(process.env.RATE_LIMIT_REFILL_RATE || '100', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
};
