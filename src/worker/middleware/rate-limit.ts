import type { Context, MiddlewareHandler } from "hono";

import type { AppEnv } from "@/worker/env";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

const CLEANUP_THRESHOLD = 1000;

export function getClientIp(c: Context<AppEnv>): string {
  const connectingIp = c.req.header("CF-Connecting-IP");
  if (connectingIp) {
    return connectingIp;
  }

  const forwardedFor = c.req.header("X-Forwarded-For");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  if (firstForwarded) {
    return firstForwarded;
  }

  return "unknown";
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const hits = new Map<string, RateLimitEntry>();

  return async (c, next) => {
    const now = Date.now();

    if (hits.size >= CLEANUP_THRESHOLD) {
      for (const [key, entry] of hits) {
        if (entry.resetAt <= now) {
          hits.delete(key);
        }
      }
    }

    const key = getClientIp(c);
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (entry.count >= options.limit) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests" }, 429);
    }

    entry.count += 1;
    return next();
  };
}

export const authRateLimit = rateLimit({ limit: 10, windowMs: 60_000 });
