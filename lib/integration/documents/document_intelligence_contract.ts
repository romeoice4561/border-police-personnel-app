/**
 * Canonical officer-level document intelligence contract (Phase 49A — §3).
 *
 * The ONE shape every UI surface (Commander Dashboard KPIs, Commander
 * Search filters/columns, Officer Profile card, e-PF summary) reads to
 * display an officer's document-readiness picture. This module computes
 * NOTHING new — it is a thin, pure composition over Phase 48A-C's already-
 * accepted engines:
 *   - lib/intelligence/document_readiness.ts   (readiness level + reasons)
 *   - lib/intelligence/review_workload.ts      (pending review counts)
 *   - lib/intelligence/document_review_status.ts (optional per-doc OCR/AI status)
 *
 * Every page that needs a per-officer document-intelligence summary calls
 * `composeOfficerDocumentIntelligence()` exactly once per officer per
 * request (see document_intelligence_service.ts for the batch/per-officer
 * server entry points) — no page re-derives readiness, completeness, or
 * workload counts independently.
 *
 * Pure — no I/O, no React, no Prisma.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import { computeDocumentReadiness, type ReadinessLevel } from "@/lib/intelligence/document_readiness";
import { computeReviewWorkload } from "@/lib/intelligence/review_workload";
import type { DocumentReviewStatus } from "@/lib/intelligence/document_review_status";
import { DICTIONARY, type TranslationKey } from "@/lib/i18n/dictionary";

/**
 * Phase 49A.2 (§7): resolves a checklist document-type code (e.g. "GP7",
 * "HOUSE_REGISTRATION") to its Thai display label, reading DICTIONARY
 * directly rather than a React t() call — this module is pure/non-React
 * (same reasoning as lib/document/epf_status_copy.ts's precedent for
 * reading dictionary-adjacent data from a pure module). primaryActionLabelTh
 * is explicitly Thai-only by its own field name/contract (consumed as a
 * fixed-language string by three different UI surfaces), so reading the
 * "th" side specifically here — never re-derived, never guessed — is
 * consistent with that contract, not a new language decision.
 */
function checklistLabelTh(typeCode: string): string | null {
  const key = `epf.completeness.checklist.${typeCode}` as TranslationKey;
  return DICTIONARY[key]?.th ?? null;
}

/** Coarse completeness band for filtering/display — derived purely from CompletenessScore.overallScore, never a separate calculation. */
export type CompletenessLevel = "complete" | "partial" | "critical";

export function completenessLevelFromScore(overallScore: number): CompletenessLevel {
  if (overallScore >= 90) return "complete";
  if (overallScore >= 50) return "partial";
  return "critical";
}

const READINESS_LABEL_TH: Record<ReadinessLevel, string> = {
  READY: "พร้อมครบ",
  NEEDS_REVIEW: "ต้องตรวจสอบ",
  INCOMPLETE: "เอกสารไม่ครบ",
  BLOCKED: "มีรายการถูกระงับ",
  UNKNOWN: "ไม่ทราบสถานะ",
};

export type PrimaryAction =
  | "NONE"
  | "UPLOAD_MISSING"
  | "REVIEW_EXPIRED"
  | "REVIEW_EXPIRING"
  | "MANUAL_APPROVAL"
  | "RESOLVE_VALIDATION"
  | "RETAKE_UNSUPPORTED";

const PRIMARY_ACTION_LABEL_TH: Record<PrimaryAction, string> = {
  NONE: "ไม่ต้องดำเนินการ",
  UPLOAD_MISSING: "อัปโหลดเอกสารที่ขาด",
  REVIEW_EXPIRED: "ตรวจสอบเอกสารที่หมดอายุ",
  REVIEW_EXPIRING: "ตรวจสอบเอกสารใกล้หมดอายุ",
  MANUAL_APPROVAL: "อนุมัติเอกสารที่รอตรวจ",
  RESOLVE_VALIDATION: "แก้ไขข้อมูลที่ตรวจสอบไม่ผ่าน",
  RETAKE_UNSUPPORTED: "ถ่ายเอกสารใหม่ (รูปแบบไฟล์ไม่รองรับ)",
};

export interface OfficerDocumentIntelligence {
  officerId: string;
  readinessLevel: ReadinessLevel;
  readinessLabelTh: string;
  completenessScore: number;
  completenessLevel: CompletenessLevel;
  missingRequiredCount: number;
  missingRequiredDocuments: string[];
  expiringSoonCount: number;
  expiredCount: number;
  pendingReviewCount: number;
  unsupportedCount: number;
  /** Count of active documents with a caller-supplied quality-warning reason (see document_review_status.ts) — 0 when no per-document review status was supplied, never fabricated. */
  qualityWarningCount: number;
  primaryAction: PrimaryAction;
  primaryActionLabelTh: string;
  /** Query params for the Commander Search drill-down that reproduces "this officer's specific problem" — built by navigation/drilldown_contract.ts, never a hand-built string here. */
  drillDownQuery: Record<string, string>;
}

export interface ComposeOfficerDocumentIntelligenceInput {
  /** The human-facing officer code (Officer.officerId) — used only for the contract's own `officerId` field and drill-down query, never for correlating documents (documents are matched by the numeric `officerPk` below, which is what OfficerDocument.officerId actually stores). */
  officerId: string;
  /** Officer.id (numeric PK) — matches OfficerDocument.officerId. Required by review_workload.ts's per-officer aggregation; kept out of the public OfficerDocumentIntelligence shape since UI consumers only ever need the human-facing officerId code. */
  officerPk: number;
  documents: readonly OfficerDocument[];
  /** Optional caller-supplied per-document OCR/AI review status (session-local — see document_review_status.ts's header). Omitted entirely -> every OCR/AI-derived count is 0, honestly reflecting "no transient intelligence available," never guessed. */
  reviewStatusByDocumentId?: ReadonlyMap<number, DocumentReviewStatus>;
  /** Optional caller-supplied quality-warning reasons per document (mirrors officer_readiness.ts's qualityWarningsByDocumentId). */
  qualityWarningsByDocumentId?: ReadonlyMap<number, string>;
  asOf?: Date;
}

/**
 * Picks ONE primary action from the readiness reasons, in the same fixed
 * severity order document_readiness.ts uses for the overall level (blocked
 * reasons first, since those are the most urgent) — never independently
 * re-prioritized.
 */
function pickPrimaryAction(readiness: ReturnType<typeof computeDocumentReadiness>): PrimaryAction {
  const reasons = readiness.reasons;
  if (reasons.some((r) => r.code === "VALIDATION_FAILED")) return "RESOLVE_VALIDATION";
  if (reasons.some((r) => r.code === "FORMAT_UNSUPPORTED")) return "RETAKE_UNSUPPORTED";
  if (reasons.some((r) => r.code === "DOCUMENT_EXPIRED")) return "REVIEW_EXPIRED";
  if (reasons.some((r) => r.code === "MISSING_REQUIRED_DOCUMENT" || r.code === "ZERO_COMPLETENESS")) return "UPLOAD_MISSING";
  if (reasons.some((r) => r.code === "DOCUMENT_EXPIRING_SOON")) return "REVIEW_EXPIRING";
  if (reasons.some((r) => r.code === "NOT_MANUALLY_APPROVED")) return "MANUAL_APPROVAL";
  return "NONE";
}

export function composeOfficerDocumentIntelligence(input: ComposeOfficerDocumentIntelligenceInput): OfficerDocumentIntelligence {
  const asOf = input.asOf ?? new Date();
  const readiness = computeDocumentReadiness({
    documents: input.documents,
    reviewStatusByDocumentId: input.reviewStatusByDocumentId,
    asOf,
  });
  const workload = computeReviewWorkload(
    { officerId: input.officerPk, documents: input.documents, reviewStatusByDocumentId: input.reviewStatusByDocumentId },
    asOf
  );

  const expiredCount = readiness.expiryInfo.filter((i) => i.status === "expired").length;
  const expiringSoonCount = readiness.expiryInfo.filter((i) => i.status === "expiring_soon").length;
  const pendingReviewCount = workload.pendingOcrReviews.length + workload.pendingManualApprovals.length + workload.pendingAiSuggestions.length;

  let qualityWarningCount = 0;
  if (input.qualityWarningsByDocumentId) {
    const activeIds = new Set(input.documents.filter((d) => d.isActive).map((d) => d.id));
    for (const documentId of input.qualityWarningsByDocumentId.keys()) {
      if (activeIds.has(documentId)) qualityWarningCount += 1;
    }
  }

  const primaryAction = pickPrimaryAction(readiness);
  const primaryActionLabelTh = resolvePrimaryActionLabelTh(primaryAction, readiness.completeness.missingRequiredDocuments);

  return {
    officerId: input.officerId,
    readinessLevel: readiness.level,
    readinessLabelTh: READINESS_LABEL_TH[readiness.level],
    completenessScore: readiness.completeness.overallScore,
    completenessLevel: completenessLevelFromScore(readiness.completeness.overallScore),
    missingRequiredCount: readiness.completeness.missingRequiredDocuments.length,
    missingRequiredDocuments: readiness.completeness.missingRequiredDocuments,
    expiringSoonCount,
    expiredCount,
    pendingReviewCount,
    unsupportedCount: workload.unsupportedDocuments.length,
    qualityWarningCount,
    primaryAction,
    primaryActionLabelTh,
    drillDownQuery: buildDrillDownQueryForOfficer(input.officerId, readiness.level),
  };
}

/**
 * Phase 49A.2 (§7): names the ACTUAL missing document when there is exactly
 * one (e.g. "อัปโหลดทะเบียนบ้าน" instead of the generic "อัปโหลดเอกสารที่ขาด")
 * — the same fix applied to epf_next_actions_card.tsx, mirrored here since
 * this contract's primaryActionLabelTh feeds a SEPARATE set of UI surfaces
 * (Commander Search table, Officer Profile card, e-PF intelligence summary)
 * that don't go through that component. When 2+ documents are missing, the
 * label stays the generic phrase — naming an arbitrary "first" one would
 * misrepresent how many are actually needed; callers that want the full
 * list already have missingRequiredDocuments for that.
 */
function resolvePrimaryActionLabelTh(action: PrimaryAction, missingRequiredDocuments: readonly string[]): string {
  if (action === "UPLOAD_MISSING" && missingRequiredDocuments.length === 1) {
    const label = checklistLabelTh(missingRequiredDocuments[0]);
    // "อัปโหลด" (the same prefix epf_next_actions_card.tsx uses) + the
    // specific document name — e.g. "อัปโหลดทะเบียนบ้าน", matching spec §7's
    // exact requested phrasing, not the generic PRIMARY_ACTION_LABEL_TH text.
    if (label) return `${DICTIONARY["epf.action.uploadMissingNamed"].th}${label}`;
  }
  return PRIMARY_ACTION_LABEL_TH[action];
}

/**
 * The officer-specific drill-down (Commander Search filtered to just this
 * officer's readiness bucket) — a thin wrapper so this file doesn't need to
 * import the full navigation contract module (avoiding a circular-import
 * risk between documents/ and navigation/); navigation/drilldown_contract.ts
 * re-exports the richer department-wide builders.
 */
function buildDrillDownQueryForOfficer(officerId: string, readinessLevel: ReadinessLevel): Record<string, string> {
  if (readinessLevel === "READY") return {};
  return { documentReadiness: readinessLevel, officerId };
}
