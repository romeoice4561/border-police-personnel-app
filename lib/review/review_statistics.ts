/**
 * ReviewStatisticsCalculator
 *
 * Aggregates statistics across a set of review sessions: approval rate,
 * rejection rate, correction rate, and average confidence. Pure
 * computation over in-memory sessions — no persistence, no database.
 */

import type { ReviewSession, ReviewStatistics } from "@/lib/review/review_types";

/** Contract for statistics calculation. Allows swapping in a persisted/incremental calculator later. */
export interface StatisticsCalculator {
  calculate(sessions: ReviewSession[]): ReviewStatistics;
}

/**
 * Default calculator, computing rates over all provided sessions
 * regardless of status (Pending sessions count toward `totalReviews` and
 * `averageConfidence` but not toward any rate numerator).
 *
 * Future extension point: time-windowed statistics (e.g. "this week"),
 * or per-reviewer / per-template breakdowns.
 */
export class DefaultStatisticsCalculator implements StatisticsCalculator {
  calculate(sessions: ReviewSession[]): ReviewStatistics {
    const totalReviews = sessions.length;

    if (totalReviews === 0) {
      return {
        totalReviews: 0,
        approvalRate: 0,
        rejectionRate: 0,
        correctionRate: 0,
        averageConfidence: 0,
      };
    }

    const approved = sessions.filter((s) => s.status === "Approved").length;
    const rejected = sessions.filter((s) => s.status === "Rejected").length;
    const corrected = sessions.filter((s) => s.status === "NeedsCorrection").length;

    const totalConfidence = sessions.reduce((sum, s) => sum + s.aiResult.confidence, 0);

    return {
      totalReviews,
      approvalRate: this.rate(approved, totalReviews),
      rejectionRate: this.rate(rejected, totalReviews),
      correctionRate: this.rate(corrected, totalReviews),
      averageConfidence: Math.round((totalConfidence / totalReviews) * 100) / 100,
    };
  }

  private rate(count: number, total: number): number {
    return Math.round((count / total) * 10000) / 100;
  }
}
