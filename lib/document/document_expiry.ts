/**
 * Document Expiry Intelligence Engine (Phase 47 — Document Expiry
 * Intelligence).
 *
 * Pure computation module over OfficerDocument rows' optional
 * issueDate/expiryDate/renewalDate fields. No React, no database access, no
 * I/O. Every function here is a straightforward date computation — nothing
 * is inferred or fabricated. A document with no expiryDate is always
 * "unknown", never treated as expired or valid.
 *
 * All UI components MUST import from here rather than recomputing expiry
 * logic inline — this is the single source of truth for expiry status,
 * countdown, sorting, and grouping.
 */

import type { OfficerDocument } from "@/lib/database/query_types";

// ── Thresholds (spec §4) ─────────────────────────────────────────────────────

/** A document expiring within this many days (inclusive) is "Expiring Soon". */
export const EXPIRING_SOON_THRESHOLD_DAYS = 90;

// ── Status ────────────────────────────────────────────────────────────────────

export type ExpiryStatus = "valid" | "expiring_soon" | "expired" | "unknown";

/** Token tone per status (reuses existing Badge tones — no new colors). */
export const EXPIRY_STATUS_TONE: Record<ExpiryStatus, "good" | "warning" | "serious" | "neutral"> = {
  valid: "good",
  expiring_soon: "warning",
  expired: "serious",
  unknown: "neutral",
};

/**
 * Whole-day difference between `expiryDate` and `asOf` (expiryDate - asOf).
 * `expiryDate` is a date-only column (Prisma `@db.Date`) — comparing
 * calendar days must never depend on the server/browser's local timezone,
 * so both sides are normalized to UTC midnight before subtracting. Negative
 * means already expired. `asOf` defaults to the real current time;
 * injectable for tests.
 */
export function daysRemaining(expiryDate: Date | string, asOf: Date = new Date()): number {
  const expiry = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  const expiryUtcMidnight = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  const asOfUtcMidnight = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((expiryUtcMidnight - asOfUtcMidnight) / msPerDay);
}

/**
 * Derives expiry status from a document's `expiryDate` alone:
 *   no expiryDate           → "unknown"
 *   daysRemaining < 0       → "expired"
 *   daysRemaining <= 90     → "expiring_soon"
 *   daysRemaining > 90      → "valid"
 */
export function expiryStatus(expiryDate: Date | string | null | undefined, asOf: Date = new Date()): ExpiryStatus {
  if (!expiryDate) return "unknown";
  const remaining = daysRemaining(expiryDate, asOf);
  if (remaining < 0) return "expired";
  if (remaining <= EXPIRING_SOON_THRESHOLD_DAYS) return "expiring_soon";
  return "valid";
}

// ── Per-document derived record ─────────────────────────────────────────────

export interface DocumentExpiryInfo {
  document: OfficerDocument;
  status: ExpiryStatus;
  /** null when expiryDate is absent (status "unknown") — never a fabricated number. */
  daysRemaining: number | null;
}

function toExpiryInfo(doc: OfficerDocument, asOf: Date): DocumentExpiryInfo {
  const status = expiryStatus(doc.expiryDate, asOf);
  return {
    document: doc,
    status,
    daysRemaining: doc.expiryDate ? daysRemaining(doc.expiryDate, asOf) : null,
  };
}

/** Maps active documents to their expiry info. Inactive (superseded) versions are excluded — only the current version of a document is expiry-relevant. */
export function computeExpiryInfo(documents: readonly OfficerDocument[], asOf: Date = new Date()): DocumentExpiryInfo[] {
  return documents.filter((d) => d.isActive).map((d) => toExpiryInfo(d, asOf));
}

// ── Sorting ───────────────────────────────────────────────────────────────────

const URGENCY_RANK: Record<ExpiryStatus, number> = {
  expired: 0,
  expiring_soon: 1,
  valid: 2,
  unknown: 3,
};

/**
 * Sorts expiry info most-urgent-first: expired > expiring soon > valid >
 * unknown. Within expired/expiring_soon/valid, sorts by daysRemaining
 * ascending (soonest deadline first; most-overdue-expired first). Unknown
 * entries keep their relative input order (nothing to sort by). Does not
 * mutate the input array.
 */
export function sortByUrgency(items: readonly DocumentExpiryInfo[]): DocumentExpiryInfo[] {
  return [...items].sort((a, b) => {
    const rankDiff = URGENCY_RANK[a.status] - URGENCY_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    if (a.daysRemaining == null || b.daysRemaining == null) return 0;
    return a.daysRemaining - b.daysRemaining;
  });
}

// ── Grouping ──────────────────────────────────────────────────────────────────

export function groupByStatus(items: readonly DocumentExpiryInfo[]): Record<ExpiryStatus, DocumentExpiryInfo[]> {
  const groups: Record<ExpiryStatus, DocumentExpiryInfo[]> = { expired: [], expiring_soon: [], valid: [], unknown: [] };
  for (const item of items) groups[item.status].push(item);
  return groups;
}

// ── Timeline grouping (spec §6) ──────────────────────────────────────────────

export type TimelineBucketKey = "expired" | "next30" | "next60" | "next90" | "later" | "unknown";

export interface TimelineBucket {
  key: TimelineBucketKey;
  items: DocumentExpiryInfo[];
}

export const TIMELINE_BUCKET_ORDER: readonly TimelineBucketKey[] = ["expired", "next30", "next60", "next90", "later", "unknown"];

/** Buckets expiry-tracked documents into the spec §6 timeline groups, sorted by urgency within each bucket. Omits empty buckets. */
export function groupByTimelineBucket(items: readonly DocumentExpiryInfo[]): TimelineBucket[] {
  const buckets: Record<TimelineBucketKey, DocumentExpiryInfo[]> = {
    expired: [],
    next30: [],
    next60: [],
    next90: [],
    later: [],
    unknown: [],
  };

  for (const item of items) {
    if (item.status === "unknown") {
      buckets.unknown.push(item);
    } else if (item.status === "expired") {
      buckets.expired.push(item);
    } else if (item.daysRemaining! <= 30) {
      buckets.next30.push(item);
    } else if (item.daysRemaining! <= 60) {
      buckets.next60.push(item);
    } else if (item.daysRemaining! <= 90) {
      buckets.next90.push(item);
    } else {
      buckets.later.push(item);
    }
  }

  return TIMELINE_BUCKET_ORDER.map((key) => ({ key, items: sortByUrgency(buckets[key]) })).filter((b) => b.items.length > 0);
}

// ── Summary (spec §3/§5/§10) ─────────────────────────────────────────────────

export interface ExpirySummary {
  expiringSoonCount: number;
  expiredCount: number;
  unknownCount: number;
  validCount: number;
  totalTracked: number;
}

export function summary(items: readonly DocumentExpiryInfo[]): ExpirySummary {
  const groups = groupByStatus(items);
  return {
    expiringSoonCount: groups.expiring_soon.length,
    expiredCount: groups.expired.length,
    unknownCount: groups.unknown.length,
    validCount: groups.valid.length,
    totalTracked: items.length,
  };
}
