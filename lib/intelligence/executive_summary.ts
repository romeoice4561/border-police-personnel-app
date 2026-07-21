/**
 * Executive Summary Builder (Phase 48C — spec §6).
 *
 * Turns already-computed KPI numbers (kpi_definitions.ts) into short,
 * plain-language summary lines — "85 officers ready", "12 pending review",
 * etc. Every number quoted in a line comes directly from a KPI function;
 * this module formats, it never computes. A line is omitted entirely when
 * its underlying count is 0 (spec's examples are all positive counts — an
 * empty summary should be a genuinely empty/short list, not a wall of
 * "0 X" lines).
 *
 * Pure — no I/O, no React.
 */

import {
  readyOfficerCount,
  officersNeedingReviewCount,
  officersBlockedCount,
  pendingReviewTotal,
  expiringSoonCount,
  unsupportedDocumentCount,
  type OfficerReadinessRecord,
} from "@/lib/intelligence/kpi_definitions";
import type { ReviewWorkload } from "@/lib/intelligence/review_workload";
import type { OfficerDocument } from "@/lib/database/query_types";

export interface ExecutiveSummaryLine {
  /** Stable identifier for the line's KPI, so a caller can style/sort/filter without parsing `text`. */
  code: string;
  text: string;
  count: number;
}

export interface ExecutiveSummaryInput {
  readinessRecords: readonly OfficerReadinessRecord[];
  workload: ReviewWorkload;
  documentListsForExpiry: readonly (readonly OfficerDocument[])[];
  asOf?: Date;
}

export function buildExecutiveSummary(input: ExecutiveSummaryInput): ExecutiveSummaryLine[] {
  const lines: ExecutiveSummaryLine[] = [];

  const ready = readyOfficerCount(input.readinessRecords);
  if (ready > 0) lines.push({ code: "OFFICERS_READY", text: `${ready} officer${ready === 1 ? "" : "s"} ready`, count: ready });

  const needsReview = officersNeedingReviewCount(input.readinessRecords);
  if (needsReview > 0) lines.push({ code: "OFFICERS_NEEDING_REVIEW", text: `${needsReview} officer${needsReview === 1 ? "" : "s"} needing review`, count: needsReview });

  const blocked = officersBlockedCount(input.readinessRecords);
  if (blocked > 0) lines.push({ code: "OFFICERS_BLOCKED", text: `${blocked} officer${blocked === 1 ? "" : "s"} blocked`, count: blocked });

  const pending = pendingReviewTotal(input.workload);
  if (pending > 0) lines.push({ code: "PENDING_REVIEW", text: `${pending} pending review${pending === 1 ? "" : "s"}`, count: pending });

  const expiring = expiringSoonCount(input.documentListsForExpiry, input.asOf);
  if (expiring > 0) lines.push({ code: "DOCUMENTS_EXPIRING", text: `${expiring} document${expiring === 1 ? "" : "s"} expiring`, count: expiring });

  const unsupported = unsupportedDocumentCount(input.workload);
  if (unsupported > 0) lines.push({ code: "UNSUPPORTED_DOCUMENTS", text: `${unsupported} unsupported document${unsupported === 1 ? "" : "s"}`, count: unsupported });

  return lines;
}
