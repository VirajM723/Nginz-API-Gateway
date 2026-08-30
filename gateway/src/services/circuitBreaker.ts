import { getRedisClient } from '@nginz/redis';
import { createLogger } from '@nginz/logger';
import { discovery } from './discovery';

const logger = createLogger('gateway-circuit-breaker');

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

export interface CircuitBreakerStatus {
  serviceName: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastStateChange: number;
}

const defaultConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 3000, // 3s fast recovery
  halfOpenMaxAttempts: 1, // 1 success closes circuit
};

class CircuitBreakerManager {
  private localStates: Map<string, CircuitBreakerStatus> = new Map();

  private getStatus(serviceName: string): CircuitBreakerStatus {
    if (!this.localStates.has(serviceName)) {
      this.localStates.set(serviceName, {
        serviceName,
        state: 'CLOSED',
        failures: 0,
        successes: 0,
        lastStateChange: Date.now(),
      });
    }
    return this.localStates.get(serviceName)!;
  }

  async canExecute(serviceName: string, customConfig?: Partial<CircuitBreakerConfig>): Promise<boolean> {
    const status = this.getStatus(serviceName);
    const now = Date.now();

    const instances = discovery.getInstances(serviceName);
    const hasHealthyInstance = instances.some((i) => i.status === 'UP');
    const allInstancesDown = instances.length > 0 && instances.every((i) => i.status === 'DOWN');

    // If at least one instance is healthy UP, circuit breaker MUST BE CLOSED
    if (hasHealthyInstance) {
      if (status.state !== 'CLOSED') {
        status.state = 'CLOSED';
        status.failures = 0;
        status.successes = 0;
        status.lastStateChange = now;
        await this.syncToRedis(serviceName, status);
      }
      return true;
    }

    // If ALL instances in service domain are DOWN, circuit breaker trips to OPEN
    if (allInstancesDown) {
      if (status.state !== 'OPEN') {
        status.state = 'OPEN';
        status.failures = 5;
        status.lastStateChange = now;
        await this.syncToRedis(serviceName, status);
      }
      return false;
    }

    return status.state !== 'OPEN';
  }

  async recordSuccess(serviceName: string, customConfig?: Partial<CircuitBreakerConfig>): Promise<void> {
    const status = this.getStatus(serviceName);
    const cfg = { ...defaultConfig, ...customConfig };

    if (status.state === 'HALF_OPEN') {
      status.successes += 1;
      if (status.successes >= cfg.halfOpenMaxAttempts) {
        status.state = 'CLOSED';
        status.failures = 0;
        status.successes = 0;
        status.lastStateChange = Date.now();
        logger.info(`[CircuitBreaker] Transitioned ${serviceName} from HALF_OPEN to CLOSED`);
        await this.syncToRedis(serviceName, status);
      }
    } else if (status.state === 'CLOSED') {
      status.failures = 0;
    }
  }

  async recordFailure(serviceName: string, customConfig?: Partial<CircuitBreakerConfig>): Promise<void> {
    const status = this.getStatus(serviceName);
    const cfg = { ...defaultConfig, ...customConfig };

    status.failures += 1;
    logger.warn(`[CircuitBreaker] Failure recorded for ${serviceName} (${status.failures}/${cfg.failureThreshold})`);

    if (status.state === 'HALF_OPEN' || status.failures >= cfg.failureThreshold) {
      status.state = 'OPEN';
      status.lastStateChange = Date.now();
      logger.error(`[CircuitBreaker] Circuit OPENED for service ${serviceName}`);
      await this.syncToRedis(serviceName, status);
    }
  }

  async resetCircuit(serviceName: string): Promise<void> {
    const status = this.getStatus(serviceName);
    status.state = 'CLOSED';
    status.failures = 0;
    status.successes = 0;
    status.lastStateChange = Date.now();
    logger.info(`[CircuitBreaker] Reset ${serviceName} to CLOSED`);
    await this.syncToRedis(serviceName, status);
  }

  async resetAllCircuits(): Promise<void> {
    const defaultServices = ['auth-service', 'user-service', 'product-service', 'order-service', 'payment-service'];
    for (const svc of defaultServices) {
      await this.resetCircuit(svc);
    }
    for (const [key, val] of this.localStates.entries()) {
      val.state = 'CLOSED';
      val.failures = 0;
      val.successes = 0;
      val.lastStateChange = Date.now();
      await this.syncToRedis(key, val);
    }
  }

  private async syncToRedis(serviceName: string, status: CircuitBreakerStatus): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.hset(`cb:${serviceName}`, {
        state: status.state,
        failures: status.failures,
        successes: status.successes,
        lastStateChange: status.lastStateChange,
      });
    } catch {
      // Redis sync failsafe
    }
  }

  getAllStates(): Record<string, CircuitBreakerStatus> {
    const defaultServices = ['auth-service', 'user-service', 'product-service', 'order-service', 'payment-service'];
    const now = Date.now();

    for (const svc of defaultServices) {
      const status = this.getStatus(svc);
      const instances = discovery.getInstances(svc);
      const hasHealthyInstance = instances.some((i) => i.status === 'UP');
      const allInstancesDown = instances.length > 0 && instances.every((i) => i.status === 'DOWN');

      if (hasHealthyInstance) {
        status.state = 'CLOSED';
        status.failures = 0;
        status.successes = 0;
        status.lastStateChange = now;
      } else if (allInstancesDown) {
        status.state = 'OPEN';
        status.failures = 5;
      }
    }

    const result: Record<string, CircuitBreakerStatus> = {};
    for (const [key, val] of this.localStates.entries()) {
      result[key] = val;
    }
    return result;
  }
}

export const circuitBreaker = new CircuitBreakerManager();
