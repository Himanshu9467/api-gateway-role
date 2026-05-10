import type { NextFunction, Request, Response } from "express";
import type { Logger } from "../observability/logger";

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RedisRateLimitClient {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  pttl(key: string): Promise<number>;
}

export interface RateLimiterOptions {
  redis?: RedisRateLimitClient;
  logger?: Logger;
  keyPrefix?: string;
}

export function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  options: RateLimiterOptions = {}
) {
  const buckets = new Map<string, Bucket>();
  const keyPrefix = options.keyPrefix ?? "gateway:rate-limit";

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, windowMs).unref();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identity = req.user?.id ?? req.ip ?? "unknown";

    if (options.redis) {
      try {
        const key = `${keyPrefix}:${identity}`;
        const count = await options.redis.incr(key);
        if (count === 1) {
          await options.redis.pexpire(key, windowMs);
        }

        const ttlMs = await options.redis.pttl(key);
        const resetAt = Date.now() + (ttlMs > 0 ? ttlMs : windowMs);
        writeHeaders(res, maxRequests, count, resetAt);
        if (count > maxRequests) {
          reject(req, res);
          return;
        }

        next();
        return;
      } catch (error) {
        options.logger?.warn("rate_limit.redis_unavailable", {
          requestId: req.requestId,
          error: error instanceof Error ? error.message : "Redis rate limiter failed",
          status: "fallback"
        });
      }
    }

    const now = Date.now();
    const existing = buckets.get(identity);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : {
            count: 0,
            resetAt: now + windowMs
          };

    bucket.count += 1;
    buckets.set(identity, bucket);

    writeHeaders(res, maxRequests, bucket.count, bucket.resetAt);

    if (bucket.count > maxRequests) {
      reject(req, res);
      return;
    }

    next();
  };
}

function writeHeaders(
  res: Response,
  maxRequests: number,
  count: number,
  resetAt: number
): void {
  res.setHeader("x-ratelimit-limit", String(maxRequests));
  res.setHeader("x-ratelimit-remaining", String(Math.max(0, maxRequests - count)));
  res.setHeader("x-ratelimit-reset", new Date(resetAt).toISOString());
}

function reject(req: Request, res: Response): void {
  res.status(429).json({
    error: "rate_limit_exceeded",
    message: "Too many requests",
    requestId: req.requestId
  });
}
