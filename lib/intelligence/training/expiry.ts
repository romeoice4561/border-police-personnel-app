/**
 * Expiry/refresh awareness (Phase 45, Task 6).
 *
 * `Training` has NO expiry/valid-until column today (docs/TRAINING_INTELLIGENCE.md)
 * — this module's bands are never reachable from real `Training` rows in
 * production right now. It exists so that IF a future schema/data source
 * supplies an expiry date (e.g. a certificate-tracking extension, out of
 * scope for this phase), no new calculation needs to be invented — only a
 * new caller. Never stores a countdown; always computed dynamically from a
 * deterministic `asOfDate`.
 *
 * Default presentation bands (used unless a real policy overrides them —
 * none does today):
 *   valid          > 90 days remaining
 *   expiring_soon  31-90 days remaining
 *   urgent         1-30 days remaining
 *   expires_today  0 days
 *   expired        negative days
 *
 * Pure — no I/O, no React.
 */
import type { ExpiryBand, ExpirySummary } from "@/lib/intelligence/training/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function bandForRemainingDays(remainingDays: number): ExpiryBand {
  if (remainingDays < 0) return "expired";
  if (remainingDays === 0) return "expires_today";
  if (remainingDays <= 30) return "urgent";
  if (remainingDays <= 90) return "expiring_soon";
  return "valid";
}

/**
 * Computes the expiry band + remaining days for an expiry date, as of
 * `asOf`. `available: false` (not a fabricated band) when `expiryDate` is
 * null — i.e. every real `Training` row today, since the schema has no
 * expiry column. Never mutates or persists a countdown value.
 */
export function computeExpirySummary(expiryDate: Date | string | null, asOf: Date): ExpirySummary {
  if (!expiryDate) {
    return { available: false, band: null, remainingDays: null };
  }
  const expiry = typeof expiryDate === "string" ? new Date(`${expiryDate}T00:00:00.000Z`) : expiryDate;
  if (Number.isNaN(expiry.getTime())) {
    return { available: false, band: null, remainingDays: null };
  }
  const remainingDays = Math.round((dateOnly(expiry).getTime() - dateOnly(asOf).getTime()) / MS_PER_DAY);
  return { available: true, band: bandForRemainingDays(remainingDays), remainingDays };
}
