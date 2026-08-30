import Redis, { RedisOptions } from 'ioredis';
import { config } from '@nginz/config';

let redisClient: Redis | null = null;

export const getRedisClient = (customUri?: string): Redis => {
  if (redisClient) {
    return redisClient;
  }

  const uri = customUri || process.env.REDIS_URI || config.redisUri || 'redis://redis:6379';
  const options: RedisOptions = {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 3000);
      return delay;
    },
    tls: uri.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  };

  redisClient = new Redis(uri, options);

  redisClient.on('connect', () => {
    console.log(`[Redis] Client connected successfully to ${uri.split('@').pop()}`);
  });

  redisClient.on('error', (err) => {
    console.error('[Redis] Connection Error:', err.message);
  });

  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};
