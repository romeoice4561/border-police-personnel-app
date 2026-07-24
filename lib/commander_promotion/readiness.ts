/**
 * Tenure readiness helpers (Phase 50) — pure presentation math over already-
 * composed year counts. Not appointment probability.
 */
export type ReadinessBand = "complete" | "high" | "medium" | "developing" | "early" | "unknown";

export function computeTenureReadinessPercent(
  completedYears: number | null | undefined,
  requiredYears: number | null | undefined
): number | null {
  if (completedYears == null || requiredYears == null || requiredYears <= 0 || !Number.isFinite(completedYears) || !Number.isFinite(requiredYears)) {
    return null;
  }
  return Math.min(completedYears / requiredYears, 1) * 100;
}

export function readinessBandFromPercent(percent: number | null): ReadinessBand {
  if (percent == null || !Number.isFinite(percent)) return "unknown";
  if (percent >= 100) return "complete";
  if (percent >= 80) return "high";
  if (percent >= 60) return "medium";
  if (percent >= 40) return "developing";
  if (percent >= 0) return "early";
  return "unknown";
}

export const READINESS_BAND_ORDER: readonly ReadinessBand[] = [
  "complete",
  "high",
  "medium",
  "developing",
  "early",
  "unknown",
] as const;

export const READINESS_BAND_LABEL_TH: Record<ReadinessBand, string> = {
  complete: "100%",
  high: "80–99%",
  medium: "60–79%",
  developing: "40–59%",
  early: "0–39%",
  unknown: "ประเมินไม่ได้",
};
