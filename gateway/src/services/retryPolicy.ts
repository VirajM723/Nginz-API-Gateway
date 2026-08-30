import { createLogger } from '@nginz/logger';

const logger = createLogger('gateway-retry-policy');

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export const isIdempotentMethod = (method: string, headers?: Record<string, any>): boolean => {
  const upper = method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(upper)) return true;
  if (headers && (headers['x-idempotent'] === 'true' || headers['idempotency-key'])) return true;
  return false;
};

export const calculateBackoffDelay = (attempt: number, baseDelayMs = 500, maxDelayMs = 5000): number => {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * (baseDelayMs * 0.5);
  return Math.min(exponential + jitter, maxDelayMs);
};

export const executeWithRetry = async <T>(
  operationName: string,
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 5000;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err: any) {
      lastError = err;
      if (attempt === maxRetries) break;

      const delay = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} for ${operationName} in ${Math.round(delay)}ms`, {
        error: err.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};
