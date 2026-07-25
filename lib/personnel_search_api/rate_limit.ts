/**
 * Injectable rate-limit policy interface (Phase 51.1).
 *
 * The repository has no production API rate limiter. This interface is ready
 * for infrastructure wiring; the default is a no-op allow-all.
 * Do not treat in-process counters as production-ready security.
 */
export interface PersonnelSearchRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface PersonnelSearchRateLimiter {
  check(key: string): PersonnelSearchRateLimitDecision | Promise<PersonnelSearchRateLimitDecision>;
}

export const allowAllPersonnelSearchRateLimiter: PersonnelSearchRateLimiter = {
  check() {
    return { allowed: true };
  },
};
