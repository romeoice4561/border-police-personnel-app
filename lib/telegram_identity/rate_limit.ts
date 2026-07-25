/**
 * Injectable rate limiter for Telegram identity flows (Phase 51.3).
 * In-process limiter is development-only — not multi-instance production-ready.
 */

export interface TelegramRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface TelegramRateLimiter {
  check(key: string): TelegramRateLimitDecision | Promise<TelegramRateLimitDecision>;
}

export const allowAllTelegramRateLimiter: TelegramRateLimiter = {
  check() {
    return { allowed: true };
  },
};

/** Simple sliding window for local/dev. Do not claim multi-instance safety. */
export function createInProcessTelegramRateLimiter(args: {
  max: number;
  windowMs: number;
}): TelegramRateLimiter {
  const hits = new Map<string, number[]>();
  return {
    check(key) {
      const now = Date.now();
      const windowStart = now - args.windowMs;
      const arr = (hits.get(key) ?? []).filter((t) => t >= windowStart);
      if (arr.length >= args.max) {
        hits.set(key, arr);
        return { allowed: false, retryAfterSeconds: Math.ceil(args.windowMs / 1000) };
      }
      arr.push(now);
      hits.set(key, arr);
      return { allowed: true };
    },
  };
}
