import client from 'prom-client';

client.collectDefaultMetrics({ prefix: 'nginz_' });

export const register = client.register;

export const httpRequestsTotal = new client.Counter({
  name: 'nginz_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDurationMs = new client.Histogram({
  name: 'nginz_http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const activeConnections = new client.Gauge({
  name: 'nginz_active_connections',
  help: 'Current active connections',
});

export const rateLimitedRequestsTotal = new client.Counter({
  name: 'nginz_rate_limited_requests_total',
  help: 'Total number of rate-limited requests',
  labelNames: ['ip'],
});

export const circuitBreakerOpenTotal = new client.Counter({
  name: 'nginz_circuit_breaker_open_total',
  help: 'Total number of circuit breaker open events',
  labelNames: ['service'],
});

export const retryAttemptsTotal = new client.Counter({
  name: 'nginz_retry_attempts_total',
  help: 'Total number of request retry attempts',
  labelNames: ['service'],
});

export const degradedRequestsTotal = new client.Counter({
  name: 'nginz_degraded_requests_total',
  help: 'Total number of degraded fallback responses served',
  labelNames: ['service', 'fallback'],
});
