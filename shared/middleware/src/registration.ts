import { Server } from 'node:http';
import { getRedisClient } from '@nginz/redis';
import { createLogger } from '@nginz/logger';

const logger = createLogger('service-registration');

export interface ServiceRegistrationOptions {
  serviceName: string;
  instanceId: string;
  host: string;
  port: number;
  server?: Server;
}

export interface ServiceInstanceInfo {
  instanceId: string;
  serviceName: string;
  host: string;
  port: number;
  status: 'UP' | 'DOWN';
  registeredAt: string;
  lastPing: number;
}

export const registerService = async (options: ServiceRegistrationOptions): Promise<() => Promise<void>> => {
  const { serviceName, instanceId, host, port, server } = options;
  const redis = getRedisClient();
  const redisKey = `services:${serviceName}`;

  const instanceData: ServiceInstanceInfo = {
    instanceId,
    serviceName,
    host,
    port,
    status: 'UP',
    registeredAt: new Date().toISOString(),
    lastPing: Date.now(),
  };

  const updateHeartbeat = async () => {
    try {
      // Fetch latest state from Redis to preserve Gateway health probe status
      const existingRaw = await redis.hget(redisKey, instanceId);
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw) as ServiceInstanceInfo;
          if (parsed.status === 'DOWN') {
            // Keep status DOWN and preserve frozen lastPing timestamp when unhealthy
            instanceData.status = 'DOWN';
            instanceData.lastPing = parsed.lastPing;
          } else {
            instanceData.status = 'UP';
            instanceData.lastPing = Date.now();
          }
        } catch {
          instanceData.lastPing = Date.now();
        }
      } else {
        instanceData.lastPing = Date.now();
      }

      await redis.hset(redisKey, instanceId, JSON.stringify(instanceData));
    } catch (err: any) {
      logger.error(`Failed heartbeat for ${instanceId}`, { error: err.message });
    }
  };

  await updateHeartbeat();
  logger.info(`[Discovery] Registered service instance ${instanceId} under ${serviceName}`);

  const intervalId = setInterval(updateHeartbeat, 10000);

  const deregister = async () => {
    clearInterval(intervalId);
    try {
      await redis.hdel(redisKey, instanceId);
      logger.info(`[Discovery] Cleanly deregistered instance ${instanceId} from ${serviceName}`);
    } catch (err: any) {
      logger.error(`Failed to deregister ${instanceId}`, { error: err.message });
    }
  };

  const handleShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down instance ${instanceId}...`);
    await deregister();
    if (server) {
      server.close(() => {
        logger.info(`HTTP server closed for ${instanceId}`);
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 5000);
    } else {
      process.exit(0);
    }
  };

  process.once('SIGTERM', () => handleShutdown('SIGTERM'));
  process.once('SIGINT', () => handleShutdown('SIGINT'));

  return deregister;
};
