import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '@nginz/redis';
import { config } from '@nginz/config';
import { createLogger } from '@nginz/logger';
import { rateLimitedRequestsTotal } from '@nginz/metrics';

const logger = createLogger('gateway-rate-limiter');

const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local maxTokens = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if not tokens then
  tokens = maxTokens
  lastRefill = now
else
  local elapsed = now - lastRefill
  local addedTokens = math.floor((elapsed / windowMs) * refillRate)
  if addedTokens > 0 then
    tokens = math.min(maxTokens, tokens + addedTokens)
    lastRefill = now
  end
end

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
redis.call('PEXPIRE', key, windowMs)

return { allowed, tokens }
`;

export const rateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const redisKey = `ratelimit:${clientIp}`;
  const now = Date.now();

  const maxTokens = Number(process.env.RATE_LIMIT_MAX_TOKENS || config.rateLimitMaxTokens || 100);
  const refillRate = Number(process.env.RATE_LIMIT_REFILL_RATE || 100);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);

  try {
    const redis = getRedisClient();
    const result = (await redis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      redisKey,
      maxTokens.toString(),
      refillRate.toString(),
      windowMs.toString(),
      now.toString()
    )) as [number, number];

    const allowed = result[0] === 1;
    const remainingTokens = result[1];

    res.setHeader('X-RateLimit-Limit', maxTokens);
    res.setHeader('X-RateLimit-Remaining', remainingTokens);

    if (!allowed) {
      logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
      try { rateLimitedRequestsTotal.inc({ ip: clientIp }); } catch {}
      res.status(429).json({
        error: true,
        message: 'Too Many Requests — Rate limit exceeded',
        clientIp,
        requestId: req.headers['x-request-id'],
      });
      return;
    }

    next();
  } catch (err: any) {
    // If Redis fails, allow request but log warning
    logger.error('Rate limiter evaluation error', { error: err.message });
    next();
  }
};
