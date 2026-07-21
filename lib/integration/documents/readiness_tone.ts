/**
 * Readiness/completeness status-tone mappings (Phase 49A), following the
 * exact established convention (EXPIRY_STATUS_TONE, DOCUMENT_STATUS_TONE,
 * PROMOTION_STATUS_TONE, TRAINING_STATUS_TONE — one Record<Status, Tone>
 * per status type, consumed by the shared <Badge tone=...> component).
 *
 * Pure — no I/O, no React.
 */
import type { ReadinessLevel } from "@/lib/intelligence/document_readiness";
import type { CompletenessLevel } from "@/lib/integration/documents/document_intelligence_contract";
import type { StatusTone } from "@/lib/ui/quality";

export const READINESS_LEVEL_TONE: Record<ReadinessLevel, StatusTone> = {
  READY: "good",
  NEEDS_REVIEW: "warning",
  INCOMPLETE: "warning",
  BLOCKED: "serious",
  UNKNOWN: "neutral",
};

export const COMPLETENESS_LEVEL_TONE: Record<CompletenessLevel, StatusTone> = {
  complete: "good",
  partial: "warning",
  critical: "serious",
};
