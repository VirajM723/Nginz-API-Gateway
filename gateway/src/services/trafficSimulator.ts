import http from 'node:http';
import { createLogger } from '@nginz/logger';
import { generateDevJwtToken } from '../middlewares/auth';

const logger = createLogger('gateway-traffic-simulator');

export interface RequestLogEntry {
  id: string;
  timestamp: string;
  clientIp: string;
  service: string;
  instanceId: string;
  endpoint: string;
  statusCode: number;
  statusText: 'ALLOWED' | 'RATE_LIMITED' | 'DEGRADED' | 'FAILED';
  latencyMs: number;
}

export interface SimulationResult {
  totalRequests: number;
  allowedRequests: number;
  rateLimitedRequests: number;
  degradedRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p95Ms: number;
  p99Ms: number;
  isRunning: boolean;
  activeRps: number;
  durationSeconds: number;
  startedAt: string | null;
  recentLogs: RequestLogEntry[];
}

const FIVE_UNIQUE_IPS = [
  '198.51.100.10',
  '198.51.100.20',
  '198.51.100.30',
  '198.51.100.40',
  '198.51.100.50',
];

class TrafficSimulatorEngine {
  private isRunning: boolean = false;
  private activeRps: number = 50;
  private durationSeconds: number = 30;
  private startedAt: number | null = null;
  private results: Array<{ statusCode: number; latencyMs: number; degraded: boolean; clientIp: string }> = [];
  private recentLogs: RequestLogEntry[] = [];
  private loopInterval: NodeJS.Timeout | null = null;

  startSimulation(rps: number = 50, durationSeconds: number = 30): SimulationResult {
    if (this.isRunning) {
      this.stopSimulation();
    }

    this.isRunning = true;
    this.activeRps = rps;
    this.durationSeconds = durationSeconds;
    this.startedAt = Date.now();
    this.results = [];
    this.recentLogs = [];

    logger.info(`[TrafficSimulator] Starting load test: ${rps} RPS for ${durationSeconds}s across 5 fixed unique IPs`);

    const endTime = Date.now() + durationSeconds * 1000;
    const devToken = generateDevJwtToken();

    const endpoints = [
      { path: '/api/products', service: 'product-service' },
      { path: '/api/orders', service: 'order-service' },
      { path: '/api/users/1234', service: 'user-service' },
      { path: '/api/payments', service: 'payment-service' },
    ];

    const batchSize = Math.max(1, Math.round(rps / 10));

    this.loopInterval = setInterval(() => {
      if (!this.isRunning || Date.now() >= endTime) {
        this.stopSimulation();
        return;
      }

      for (let i = 0; i < batchSize; i++) {
        const clientIp = FIVE_UNIQUE_IPS[Math.floor(Math.random() * FIVE_UNIQUE_IPS.length)];
        const targetTarget = endpoints[Math.floor(Math.random() * endpoints.length)];
        const port = Number(process.env.PORT || 3000);
        const startMs = Date.now();
        const requestId = `sim-${Math.random().toString(36).substring(2, 8)}`;

        const reqOptions = {
          hostname: 'localhost',
          port,
          path: targetTarget.path,
          method: targetTarget.path === '/api/orders' || targetTarget.path === '/api/payments' ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': clientIp,
            'X-Simulated-Traffic': 'true',
            Authorization: `Bearer ${devToken}`,
            'X-Request-ID': requestId,
          },
          timeout: 4000,
        };

        const req = http.request(reqOptions, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            const latencyMs = Date.now() - startMs;
            let degraded = false;
            let responseInstance = (res.headers['x-served-by'] as string) || '';
            const failedHeader = (res.headers['x-failed-instances'] as string) || '';

            try {
              const parsed = JSON.parse(body);
              if (parsed.degraded) degraded = true;
              if (parsed.instance && !responseInstance) responseInstance = parsed.instance;
            } catch {
              // ignore
            }

            if (!responseInstance) {
              responseInstance = `${targetTarget.service}-1`;
            }

            const statusCode = res.statusCode || 500;
            this.results.push({
              statusCode,
              latencyMs,
              degraded,
              clientIp,
            });

            let statusText: RequestLogEntry['statusText'] = 'ALLOWED';
            if (statusCode === 429) {
              statusText = 'RATE_LIMITED';
            } else if (degraded || res.headers['x-degraded-payment'] === 'true') {
              statusText = 'DEGRADED';
            } else if (statusCode >= 400) {
              statusText = 'FAILED';
            }

            // 1. If any instance failed during round-robin failover, log the 500 FAILED entry first
            if (failedHeader) {
              const failedList = failedHeader.split(',').map((s) => s.trim()).filter(Boolean);
              for (const failedInst of failedList) {
                this.recentLogs.unshift({
                  id: `${requestId}-fail-${failedInst}`,
                  timestamp: new Date().toLocaleTimeString(),
                  clientIp,
                  service: targetTarget.service,
                  instanceId: failedInst,
                  endpoint: targetTarget.path,
                  statusCode: 500,
                  statusText: 'FAILED',
                  latencyMs: Math.max(5, Math.round(latencyMs / 2)),
                });
              }
            }

            // 2. Log final served instance result (e.g. product-service-2 200 ALLOWED)
            const logEntry: RequestLogEntry = {
              id: requestId,
              timestamp: new Date().toLocaleTimeString(),
              clientIp,
              service: targetTarget.service,
              instanceId: responseInstance,
              endpoint: targetTarget.path,
              statusCode,
              statusText,
              latencyMs,
            };

            this.recentLogs.unshift(logEntry);
            while (this.recentLogs.length > 50) {
              this.recentLogs.pop();
            }
          });
        });

        req.on('error', () => {
          const latencyMs = Date.now() - startMs;
          this.results.push({
            statusCode: 503,
            latencyMs,
            degraded: true,
            clientIp,
          });

          this.recentLogs.unshift({
            id: requestId,
            timestamp: new Date().toLocaleTimeString(),
            clientIp,
            service: targetTarget.service,
            instanceId: `${targetTarget.service}-fallback`,
            endpoint: targetTarget.path,
            statusCode: 503,
            statusText: 'DEGRADED',
            latencyMs,
          });
          while (this.recentLogs.length > 50) {
            this.recentLogs.pop();
          }
        });

        if (reqOptions.method === 'POST') {
          req.write(JSON.stringify({ totalAmount: 99.99, amount: 99.99, orderId: 'sim-order-1' }));
        }

        req.end();
      }
    }, 100);

    return this.getResults();
  }

  stopSimulation(): void {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.isRunning = false;
    logger.info('[TrafficSimulator] Simulation stopped.');
  }

  getResults(): SimulationResult {
    const latencies = this.results.map((r) => r.latencyMs).sort((a, b) => a - b);
    const total = this.results.length;
    const allowed = this.results.filter((r) => r.statusCode < 400).length;
    const rateLimited = this.results.filter((r) => r.statusCode === 429).length;
    const degraded = this.results.filter((r) => r.degraded).length;
    const failed = this.results.filter((r) => r.statusCode >= 500).length;

    const avgLatencyMs = total > 0 ? latencies.reduce((a, b) => a + b, 0) / total : 0;
    const p95Ms = total > 0 ? latencies[Math.floor(total * 0.95)] || 0 : 0;
    const p99Ms = total > 0 ? latencies[Math.floor(total * 0.99)] || 0 : 0;

    return {
      totalRequests: total,
      allowedRequests: allowed,
      rateLimitedRequests: rateLimited,
      degradedRequests: degraded,
      failedRequests: failed,
      avgLatencyMs: Number(avgLatencyMs.toFixed(2)),
      p95Ms,
      p99Ms,
      isRunning: this.isRunning,
      activeRps: this.activeRps,
      durationSeconds: this.durationSeconds,
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      recentLogs: this.recentLogs,
    };
  }
}

export const trafficSimulator = new TrafficSimulatorEngine();
