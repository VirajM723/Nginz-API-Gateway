import { ServiceInstanceInfo } from '@nginz/middleware';
import crypto from 'node:crypto';

export type LoadBalancerStrategy = 'round-robin' | 'consistent-hash';

export interface LoadBalancerContext {
  clientIp?: string;
  userId?: string;
}

class LoadBalancer {
  private roundRobinCounters: Map<string, number> = new Map();

  selectInstance(
    serviceName: string,
    instances: ServiceInstanceInfo[],
    strategy: LoadBalancerStrategy = 'round-robin',
    context?: LoadBalancerContext
  ): ServiceInstanceInfo | null {
    if (!instances || instances.length === 0) return null;
    if (instances.length === 1) return instances[0];

    if (strategy === 'consistent-hash') {
      return this.selectConsistentHash(instances, context);
    }

    return this.selectRoundRobin(serviceName, instances);
  }

  private selectRoundRobin(serviceName: string, instances: ServiceInstanceInfo[]): ServiceInstanceInfo {
    const current = this.roundRobinCounters.get(serviceName) || 0;
    const selectedIndex = current % instances.length;
    this.roundRobinCounters.set(serviceName, (current + 1) % 1000000);
    return instances[selectedIndex];
  }

  private selectConsistentHash(instances: ServiceInstanceInfo[], context?: LoadBalancerContext): ServiceInstanceInfo {
    const key = context?.userId || context?.clientIp || 'default';
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const numericHash = parseInt(hash.substring(0, 8), 16);
    const index = numericHash % instances.length;
    return instances[index];
  }
}

export const loadBalancer = new LoadBalancer();
