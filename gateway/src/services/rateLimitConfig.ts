import { config } from '@nginz/config';

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  windowMs: number;
}

// Runtime token bucket policy: seeded from env, updatable via /api/gateway/rate-limiter
let current: RateLimitConfig = {
  maxTokens: Number(process.env.RATE_LIMIT_MAX_TOKENS || config.rateLimitMaxTokens || 100),
  refillRate: Number(process.env.RATE_LIMIT_REFILL_RATE || 100),
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
};

export const getRateLimitConfig = (): RateLimitConfig => ({ ...current });

export const updateRateLimitConfig = (update: Partial<RateLimitConfig>): RateLimitConfig => {
  current = { ...current, ...update };
  return getRateLimitConfig();
};
