/**
 * Alert severity model (Phase DI-6, Section 3). Deterministic — the same
 * input facts always produce the same severity, no scoring model, no
 * probability, no LLM (Section 24). Pure — no I/O.
 *
 * Rules (exact, documented per the DI-6 spec):
 *
 * REPEAT_PHONE / REPEAT_SIM / REPEAT_DEVICE / REPEAT_VEHICLE / REPEAT_CASE_ENTITY:
 *   - priorCaseCount <= 1            -> INFO    (appeared once before)
 *   - priorCaseCount >= 2            -> NOTICE  (multiple cases/persons)
 *   - priorCaseCount >= 2 AND relatedPersonCount >= 2 -> HIGH (reused
 *     identifier/device/entity creates a meaningful cross-case linkage
 *     between MULTIPLE distinct people, not just repeat case filing)
 *
 * REPEAT_PERSON:
 *   - caseCount <= 1  -> never generated (not a repeat)
 *   - caseCount == 2  -> NOTICE
 *   - caseCount >= 3  -> HIGH (appears across 3+ cases)
 *
 * NEW_NETWORK_CONNECTION:
 *   - always NOTICE — a newly-entered record connecting to prior data is
 *     always worth a look, never escalated to HIGH purely by this signal
 *     alone (HIGH is reserved for identity duplicates or multi-person
 *     entity reuse, per the two rules above).
 *
 * HIGH_CONFIDENCE_DUPLICATE:
 *   - always HIGH — mirrors DrugPersonMatchingService's own "HIGH"
 *     confidence tier 1:1; this alert type only ever fires for a
 *     DrugMatchConfidence "HIGH" candidate pair, never MEDIUM/LOW (those
 *     stay in the existing Duplicate Review Queue, not the alert stream).
 *
 * Never "critical criminal network" — HIGH is the ceiling.
 */

import type { DrugAlertSeverity } from "@/lib/drug_intelligence/drug_intelligence_alert_types";

export function deriveRepeatEntitySeverity(priorCaseCount: number, relatedPersonCount: number): DrugAlertSeverity {
  if (priorCaseCount <= 1) return "INFO";
  if (relatedPersonCount >= 2) return "HIGH";
  return "NOTICE";
}

export function deriveRepeatPersonSeverity(caseCount: number): DrugAlertSeverity {
  if (caseCount >= 3) return "HIGH";
  return "NOTICE";
}

export function deriveNewNetworkConnectionSeverity(): DrugAlertSeverity {
  return "NOTICE";
}

export function deriveHighConfidenceDuplicateSeverity(): DrugAlertSeverity {
  return "HIGH";
}
