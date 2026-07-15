/**
 * Document display status (Phase 45A, Part 4/8).
 *
 * Pure derivation of a document's presentation status from the fields that
 * ACTUALLY exist on OfficerDocument today (verifiedAt / isActive). No schema
 * change — this is a read-only view over existing data.
 *
 * The status set is intentionally OPEN/extensible: "expired" and "rejected"
 * are declared in the type union (with token tones ready) but are never
 * produced by `documentStatus()` yet, because there is no backing column for
 * them. A future schema phase that adds an expiry date / a rejected flag only
 * needs to extend `documentStatus()` — the badge, the filter, and every caller
 * keep working with zero redesign.
 *
 * Pure — no I/O, no React.
 */

import type { OfficerDocument } from "@/lib/database/query_types";

/** All possible document statuses. Only the first three are produced today. */
export type DocumentStatus = "verified" | "pending" | "missing" | "expired" | "rejected";

/** The statuses the current schema can actually produce — used to build the filter options. */
export const ACTIVE_DOCUMENT_STATUSES: readonly DocumentStatus[] = ["verified", "pending", "missing"];

/** Token tone per status (reuses the existing Badge tones — no new colors). */
export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, "good" | "warning" | "neutral" | "serious" | "critical"> = {
  verified: "good",
  pending: "warning",
  missing: "neutral",
  expired: "serious",
  rejected: "critical",
};

/**
 * Derives the display status of the CURRENT (active) document for a type:
 *   • null doc      → "missing"  (nothing uploaded for this type yet)
 *   • verifiedAt set → "verified"
 *   • otherwise      → "pending" (uploaded, awaiting verification)
 * `expired`/`rejected` are never returned yet (no backing field).
 */
export function documentStatus(doc: OfficerDocument | null | undefined): DocumentStatus {
  if (!doc) return "missing";
  if (doc.verifiedAt) return "verified";
  return "pending";
}
