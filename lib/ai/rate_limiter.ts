/**
 * RateLimiter
 *
 * Enforces a requests-per-minute ceiling and a concurrent-request ceiling
 * for outbound Vision API calls, so a large batch import (Phase 3) cannot
 * overwhelm the provider's own rate limits. In-process only; a future
 * queue-backed implementation is a named extension point for scaling
 * across multiple worker processes.
 */

export interface RateLimiterConfig {
  requestsPerMinute?: number;
  maxConcurrentRequests?: number;
}

/** Contract for a rate limiter. Allows swapping in a distributed/queue-backed limiter later. */
export interface RateLimiter {
  /** Resolves once it is this caller's turn to proceed; must be paired with `release()`. */
  acquire(): Promise<void>;
  /** Releases a concurrency slot acquired via `acquire()`. */
  release(): void;
}

/**
 * Sliding-window RPM limiter combined with a concurrency semaphore.
 *
 * Future extension point: back this with a shared/distributed queue (e.g.
 * Redis-backed token bucket) so rate limits are enforced across multiple
 * processes/machines rather than per-process.
 */
export class InProcessRateLimiter implements RateLimiter {
  private readonly requestsPerMinute: number;
  private readonly maxConcurrentRequests: number;
  private requestTimestamps: number[] = [];
  private activeRequests = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(config: RateLimiterConfig = {}) {
    this.requestsPerMinute = config.requestsPerMinute ?? 60;
    this.maxConcurrentRequests = config.maxConcurrentRequests ?? 5;
  }

  async acquire(): Promise<void> {
    await this.waitForRpmWindow();
    await this.waitForConcurrencySlot();
    this.requestTimestamps.push(Date.now());
    this.activeRequests += 1;
  }

  release(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const next = this.waiters.shift();
    if (next) next();
  }

  private async waitForRpmWindow(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter((ts) => now - ts < 60_000);

    if (this.requestTimestamps.length < this.requestsPerMinute) return;

    const oldest = this.requestTimestamps[0];
    const waitMs = 60_000 - (now - oldest);
    await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 0)));
    return this.waitForRpmWindow();
  }

  private async waitForConcurrencySlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrentRequests) return;

    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }
}
