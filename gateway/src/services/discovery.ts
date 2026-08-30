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
  private fallbackServicesState: Record<string, ServiceInstanceInfo[]> | null = null;
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
          await circuitBreaker.resetCircuit(serviceName);
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

  setInstanceStatus(hostOrId: string, status: 'UP' | 'DOWN'): void {
    if (!this.fallbackServicesState) {
      this.fallbackServicesState = this.getDefaultFallbackServices();
    }

    let matchedService = '';

    // Update in fallback state
    for (const [svcName, list] of Object.entries(this.fallbackServicesState)) {
      for (const inst of list) {
        if (inst.instanceId === hostOrId || inst.host === hostOrId) {
          inst.status = status;
          matchedService = svcName;
        }
      }
    }

    // Update in instancesMap if present
    for (const [svcName, list] of this.instancesMap.entries()) {
      for (const inst of list) {
        if (inst.instanceId === hostOrId || inst.host === hostOrId) {
          inst.status = status;
          matchedService = svcName;
        }
      }
    }

    // Automatically reset circuit breaker for service domain when instance is restored to UP
    if (status === 'UP' && matchedService) {
      circuitBreaker.resetCircuit(matchedService);
    }
  }

  getInstances(serviceName: string): ServiceInstanceInfo[] {
    const list = this.instancesMap.get(serviceName) || [];
    if (list.length === 0) {
      const all = this.getAllServices();
      return all[serviceName] || [];
    }
    return list;
  }

  private getDefaultFallbackServices(): Record<string, ServiceInstanceInfo[]> {
    const now = Date.now();
    return {
      'auth-service': [
        { instanceId: 'auth-service-1', serviceName: 'auth-service', host: 'auth-service-1', port: 3001, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
        { instanceId: 'auth-service-2', serviceName: 'auth-service', host: 'auth-service-2', port: 3001, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
      ],
      'user-service': [
        { instanceId: 'user-service-1', serviceName: 'user-service', host: 'user-service-1', port: 3002, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
        { instanceId: 'user-service-2', serviceName: 'user-service', host: 'user-service-2', port: 3002, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
      ],
      'product-service': [
        { instanceId: 'product-service-1', serviceName: 'product-service', host: 'product-service-1', port: 3003, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
        { instanceId: 'product-service-2', serviceName: 'product-service', host: 'product-service-2', port: 3003, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
      ],
      'order-service': [
        { instanceId: 'order-service-1', serviceName: 'order-service', host: 'order-service-1', port: 3004, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
        { instanceId: 'order-service-2', serviceName: 'order-service', host: 'order-service-2', port: 3004, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
      ],
      'payment-service': [
        { instanceId: 'payment-service-1', serviceName: 'payment-service', host: 'payment-service-1', port: 3005, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
        { instanceId: 'payment-service-2', serviceName: 'payment-service', host: 'payment-service-2', port: 3005, status: 'UP', registeredAt: new Date(now - 1200000).toISOString(), lastPing: now },
      ],
    };
  }

  getAllServices(): Record<string, ServiceInstanceInfo[]> {
    const result: Record<string, ServiceInstanceInfo[]> = {};
    for (const [key, value] of this.instancesMap.entries()) {
      result[key] = value;
    }

    if (Object.keys(result).length === 0) {
      if (!this.fallbackServicesState) {
        this.fallbackServicesState = this.getDefaultFallbackServices();
      }
      return this.fallbackServicesState;
    }

    return result;
  }
}

export const discovery = new ServiceDiscovery();
