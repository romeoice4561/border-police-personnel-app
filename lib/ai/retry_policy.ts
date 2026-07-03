/**
 * RetryPolicy
 *
 * Exponential backoff retry logic for transient Vision API failures
 * (HTTP 429, 500, 502, 503, 504). Interface-first so the policy can be
 * swapped or tuned per environment without touching OpenAIClient.
 */

export interface RetryPolicyConfig {
  maxRetries?: number;
  /** Base delay in ms; actual delay is baseDelayMs * 2^attempt, capped at maxDelayMs. */
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Contract for a retry policy. Allows swapping in a different backoff/jitter strategy later. */
export interface RetryPolicy {
  isRetryable(statusCode: number): boolean;
  getDelayMs(attempt: number, retryAfterMs?: number): number;
  readonly maxRetries: number;
}

/**
 * Exponential backoff with an optional server-provided `Retry-After` override
 * (used for 429 responses that specify a wait time).
 */
export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(config: RetryPolicyConfig = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.baseDelayMs = config.baseDelayMs ?? 500;
    this.maxDelayMs = config.maxDelayMs ?? 8000;
  }

  isRetryable(statusCode: number): boolean {
    return RETRYABLE_STATUS_CODES.has(statusCode);
  }

  getDelayMs(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined) return Math.min(retryAfterMs, this.maxDelayMs);
    const exponential = this.baseDelayMs * 2 ** attempt;
    return Math.min(exponential, this.maxDelayMs);
  }
}

/**
 * Runs `operation`, retrying on retryable failures per `policy` with
 * exponential backoff. `operation` should throw an error carrying a
 * `statusCode` property (see VisionProviderError/VisionRateLimit) for retry
 * classification; non-retryable or unrecognized errors propagate
 * immediately.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  sleep: (ms: number) => Promise<void> = defaultSleep
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const statusCode = (error as { statusCode?: number }).statusCode;
      const retryAfterMs = (error as { retryAfterMs?: number }).retryAfterMs;

      const canRetry = statusCode !== undefined && policy.isRetryable(statusCode) && attempt < policy.maxRetries;
      if (!canRetry) throw error;

      await sleep(policy.getDelayMs(attempt, retryAfterMs));
    }
  }

  throw lastError;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
