import http from 'node:http';
import { getRedisClient } from '@nginz/redis';
import { createLogger } from '@nginz/logger';
import { ServiceInstanceInfo } from '@nginz/middleware';
import { circuitBreaker } from './circuitBreaker';

const logger = createLogger('gateway-discovery');

const checkInstanceHealth = (host: string, port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: host,
        port,
        path: '/health',
        method: 'GET',
        timeout: 1500,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
};

class ServiceDiscovery {
  private instancesMap: Map<string, ServiceInstanceInfo[]> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;

  async refreshRegistry(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      const redis = getRedisClient();
      const keys = await redis.keys('services:*');
      const newMap = new Map<string, ServiceInstanceInfo[]>();

      for (const key of keys) {
        const serviceName = key.replace('services:', '');
        const instancesData = await redis.hgetall(key);
        const instances: ServiceInstanceInfo[] = [];
        let hasHealthyUpInstance = false;

        for (const [id, rawJson] of Object.entries(instancesData)) {
          try {
            const parsed = JSON.parse(rawJson) as ServiceInstanceInfo;
            
            // Perform active HTTP health probe against instance /health endpoint
            const isHealthy = await checkInstanceHealth(parsed.host, parsed.port);
            parsed.status = isHealthy ? 'UP' : 'DOWN';

            if (isHealthy) {
              hasHealthyUpInstance = true;
              // Update lastPing ONLY when the health probe succeeds
              parsed.lastPing = Date.now();
            }

            // Sync updated status and lastPing back to Redis registry
            await redis.hset(key, id, JSON.stringify(parsed));

            instances.push(parsed);
          } catch {
            // Ignore malformed JSON
          }
        }

        if (instances.length > 0) {
          newMap.set(serviceName, instances);
        }

        // If at least one instance is restored healthy UP, automatically reset the circuit breaker for this service
        if (hasHealthyUpInstance) {
          const cbState = circuitBreaker.getAllStates()[serviceName];
          if (cbState && cbState.state === 'OPEN') {
            await circuitBreaker.resetCircuit(serviceName);
          }
        }
      }

      this.instancesMap = newMap;
    } catch (err: any) {
      logger.error('Failed to refresh service registry from Redis', { error: err.message });
    } finally {
      this.isRefreshing = false;
    }
  }

  start(intervalMs = 2000): void {
    if (this.intervalId) return;
    this.refreshRegistry();
    this.intervalId = setInterval(() => this.refreshRegistry(), intervalMs);
    logger.info(`[Discovery] Gateway discovery client started with active HTTP health probes (refresh rate: ${intervalMs}ms)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getInstances(serviceName: string): ServiceInstanceInfo[] {
    const list = this.instancesMap.get(serviceName) || [];
    return list;
  }

  getAllServices(): Record<string, ServiceInstanceInfo[]> {
    const result: Record<string, ServiceInstanceInfo[]> = {};
    for (const [key, value] of this.instancesMap.entries()) {
      result[key] = value;
    }
    return result;
  }
}

export const discovery = new ServiceDiscovery();
