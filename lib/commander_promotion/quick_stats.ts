/**
 * Filtered quick statistics (Phase 50) — pure, over prepared rows only.
 */
import type { PreparedPromotionRow } from "@/lib/commander_promotion/types";
import { BLOCKER_LABEL_TH } from "@/lib/commander_promotion/types";

export interface FilteredQuickStats {
  averageReadiness: number | null;
  knownReadinessCount: number;
  medianRemainingYears: number | null;
  highestReadyOrgLabel: string | null;
  largestBlockerLabel: string | null;
  promotionReadyPercent: number | null;
  totalRows: number;
  promotionReadyCount: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function computeFilteredQuickStats(rows: readonly PreparedPromotionRow[]): FilteredQuickStats {
  const known = rows.filter((r) => r.readinessPercent != null);
  const averageReadiness =
    known.length > 0 ? known.reduce((sum, r) => sum + (r.readinessPercent ?? 0), 0) / known.length : null;

  const remaining = rows.map((r) => r.remainingTenureYears).filter((v): v is number => v != null);
  const medianRemainingYears = median(remaining);

  const readyByOrg = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    if (!row.isPromotionReady) continue;
    const key = row.companyKey ?? row.divisionKey ?? row.regionKey ?? "unknown";
    const label = row.companyLabel || row.divisionLabel || row.regionLabel || "ไม่ระบุ";
    const prev = readyByOrg.get(key) ?? { label, count: 0 };
    prev.count += 1;
    readyByOrg.set(key, prev);
  }
  let highestReadyOrgLabel: string | null = null;
  let best = -1;
  for (const entry of readyByOrg.values()) {
    if (entry.count > best) {
      best = entry.count;
      highestReadyOrgLabel = entry.label;
    }
  }

  const blockerCounts = new Map<string, number>();
  for (const row of rows) {
    for (const key of row.blockerKeys) {
      blockerCounts.set(key, (blockerCounts.get(key) ?? 0) + 1);
    }
  }
  let largestBlockerLabel: string | null = null;
  let largest = -1;
  for (const [key, count] of blockerCounts) {
    if (count > largest) {
      largest = count;
      largestBlockerLabel = BLOCKER_LABEL_TH[key as keyof typeof BLOCKER_LABEL_TH] ?? key;
    }
  }

  const promotionReadyCount = rows.filter((r) => r.isPromotionReady).length;
  const promotionReadyPercent = rows.length > 0 ? (promotionReadyCount / rows.length) * 100 : null;

  return {
    averageReadiness,
    knownReadinessCount: known.length,
    medianRemainingYears,
    highestReadyOrgLabel,
    largestBlockerLabel,
    promotionReadyPercent,
    totalRows: rows.length,
    promotionReadyCount,
  };
}
