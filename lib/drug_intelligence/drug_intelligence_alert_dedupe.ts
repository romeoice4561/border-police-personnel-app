/**
 * Alert deduplication key (Phase DI-6, Section 11). One meaningful event
 * produces exactly one alert row — re-running generation against the same
 * underlying facts must always compute the SAME key, so the repository's
 * upsert-by-dedupeKey finds and refreshes the existing row instead of
 * inserting a duplicate. Pure — no I/O.
 */

import type { DrugAlertType } from "@/lib/drug_intelligence/drug_intelligence_alert_types";

/**
 * `currentCaseId` is part of the key for REPEAT_* alert types (Section 2:
 * "currentCaseId?" — the same entity showing up in a DIFFERENT new case is
 * a distinct, separately-reviewable event, not a refresh of the earlier
 * one) but deliberately excluded for REPEAT_PERSON, which is a property of
 * the person itself, not tied to any one case.
 */
export function computeDrugAlertDedupeKey(params: {
  alertType: DrugAlertType;
  entityType: string;
  entityId: string;
  currentCaseId: string | null;
}): string {
  if (params.alertType === "REPEAT_PERSON") return `${params.alertType}:${params.entityType}:${params.entityId}`;
  // `currentCaseId` is prefixed with its own presence marker ("case:"/"nocase")
  // rather than substituting a bare "none" sentinel string, so a case whose
  // real id literally were "none" (never possible with generateDrugId()'s
  // randomUUID() ids today, but not a guarantee this key format should rely
  // on) could never collide with the "no case" state.
  const caseSegment = params.currentCaseId !== null ? `case:${params.currentCaseId}` : "nocase";
  return `${params.alertType}:${params.entityType}:${params.entityId}:${caseSegment}`;
}

/**
 * HIGH_CONFIDENCE_DUPLICATE alerts represent an unordered PAIR of persons —
 * one alert row's `entityId` is the lexicographically-smaller person id
 * (matching DrugPersonMatchReview's orderPersonPair convention exactly),
 * with the other person's id carried in `relatedPersonIds`. Ordering here
 * ensures the same real-world pair always dedupes to the same key
 * regardless of which person the matching engine happened to name "from"
 * vs "to" on a later run.
 */
export function orderDrugDuplicatePair(personIdA: string, personIdB: string): [string, string] {
  return personIdA <= personIdB ? [personIdA, personIdB] : [personIdB, personIdA];
}
