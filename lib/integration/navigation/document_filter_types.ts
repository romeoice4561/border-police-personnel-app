/**
 * Document-intelligence filter fields for Commander Search (Phase 49A — §5).
 *
 * These fields extend components/commander/query/types.ts's
 * CommanderQueryFilters — declared here, in the integration layer, rather
 * than inline in that file, so the navigation/query-builder contract
 * (drilldown_contract.ts) and the filter-application logic
 * (document_filter_matching.ts) share one canonical field/value list. Only
 * data CommanderQueryOfficer.documentIntelligence (the canonical contract)
 * can actually answer is exposed here — no filter is added for a value the
 * system cannot reliably compute today.
 *
 * Pure types — no I/O, no React.
 */
import type { ReadinessLevel } from "@/lib/intelligence/document_readiness";
import type { CompletenessLevel } from "@/lib/integration/documents/document_intelligence_contract";

export const DOCUMENT_READINESS_VALUES: readonly ReadinessLevel[] = ["READY", "NEEDS_REVIEW", "INCOMPLETE", "BLOCKED", "UNKNOWN"];

export const DOCUMENT_COMPLETENESS_VALUES: readonly CompletenessLevel[] = ["complete", "partial", "critical"];

/**
 * Expiry status as exposed to Commander Search filtering — a superset of
 * document_expiry.ts's own ExpiryStatus ("valid" is renamed "upcoming" for
 * commander-facing clarity, and "critical" is added as a near-term expired
 * subset commanders specifically asked for: expiring within 30 days, the
 * same threshold epf_expiry_timeline.ts's "next30" bucket already uses —
 * no new threshold invented). Never a fabricated status: every value maps
 * 1:1 onto a real document_expiry.ts computation.
 */
export type CommanderExpiryFilterStatus = "expired" | "critical" | "warning" | "upcoming" | "unknown";

export const DOCUMENT_EXPIRY_FILTER_VALUES: readonly CommanderExpiryFilterStatus[] = ["expired", "critical", "warning", "upcoming", "unknown"];

export interface DocumentIntelligenceFilters {
  documentReadiness?: ReadinessLevel;
  documentCompleteness?: CompletenessLevel;
  expiryStatus?: CommanderExpiryFilterStatus;
  pendingOcrReview?: boolean;
  unsupportedDocument?: boolean;
  missingRequiredDocument?: boolean;
  qualityWarning?: boolean;
}

export const DOCUMENT_FILTER_QUERY_KEYS: readonly (keyof DocumentIntelligenceFilters)[] = [
  "documentReadiness",
  "documentCompleteness",
  "expiryStatus",
  "pendingOcrReview",
  "unsupportedDocument",
  "missingRequiredDocument",
  "qualityWarning",
];
