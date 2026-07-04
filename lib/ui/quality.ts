/**
 * Quality banding helper (Phase 14 UI).
 *
 * The single definition of how a 0-100 quality score maps to a band + status
 * tone, mirroring the Phase 11B category thresholds (Excellent ≥90, Good ≥75,
 * Fair ≥60, Poor <60). Shared by QualityBadge and the Review page so the UI
 * never re-derives banding inconsistently. The tone drives a RESERVED status
 * color (good/warning/serious/critical), always paired with a text label —
 * never color alone.
 *
 * Pure; no React, no I/O.
 */

export type QualityBand = "Excellent" | "Good" | "Fair" | "Poor" | "Unknown";
export type StatusTone = "good" | "warning" | "serious" | "critical" | "neutral";

export interface QualityBanding {
  band: QualityBand;
  tone: StatusTone;
}

export function bandForScore(score: number | null | undefined): QualityBanding {
  if (score === null || score === undefined || Number.isNaN(score)) return { band: "Unknown", tone: "neutral" };
  if (score >= 90) return { band: "Excellent", tone: "good" };
  if (score >= 75) return { band: "Good", tone: "good" };
  if (score >= 60) return { band: "Fair", tone: "warning" };
  return { band: "Poor", tone: "critical" };
}

/** Low extraction confidence threshold (mirrors Phase 11B's rule) — used by the Review page. */
export const LOW_CONFIDENCE_THRESHOLD = 60;
