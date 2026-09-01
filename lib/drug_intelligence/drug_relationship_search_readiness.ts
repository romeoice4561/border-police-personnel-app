/**
 * Pure readiness helpers for Relationship Search guided UX (Phase 1B.2.2).
 * UI orchestration only — does not change catalog/API semantics.
 */
import type { DrugSearchMatchStrength, DrugSearchResult } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugControlledRelationDefinition } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";

export type RelationshipSearchDisabledReason =
  | "need_source"
  | "need_relation"
  | "need_target_type"
  | "need_target_entity"
  | null;

export function flattenSearchResults(
  groups: Array<{ entityType: string; results: DrugSearchResult[] }> | undefined,
  allowed?: Set<string> | null
): DrugSearchResult[] {
  if (!groups) return [];
  const out: DrugSearchResult[] = [];
  for (const group of groups) {
    if (allowed && !allowed.has(group.entityType)) continue;
    for (const row of group.results) out.push(row);
  }
  return out;
}

/** Safe auto-confirm: exactly one EXACT match. Never auto-select PARTIAL / multi-hit lists. */
export function shouldAutoConfirmExactMatch(results: DrugSearchResult[]): boolean {
  if (results.length !== 1) return false;
  return results[0]!.strength === ("EXACT" as DrugSearchMatchStrength);
}

export function canSubmitRelationshipQuery(input: {
  sourceSelected: boolean;
  relationId: string;
  targetType: string;
  targetSelected: boolean;
  relation: DrugControlledRelationDefinition | null;
}): boolean {
  if (!input.sourceSelected) return false;
  if (!input.relationId || !input.relation) return false;
  if (!input.targetType) return false;
  if (!input.relation.targetOptional && !input.targetSelected) return false;
  return true;
}

export function getRelationshipSearchDisabledReason(input: {
  sourceSelected: boolean;
  relationId: string;
  targetType: string;
  targetSelected: boolean;
  relation: DrugControlledRelationDefinition | null;
}): RelationshipSearchDisabledReason {
  if (!input.sourceSelected) return "need_source";
  if (!input.relationId || !input.relation) return "need_relation";
  if (!input.targetType) return "need_target_type";
  if (!input.relation.targetOptional && !input.targetSelected) return "need_target_entity";
  return null;
}

export type GuidedStepStatus = "completed" | "active" | "waiting";

export function getGuidedStepStatuses(input: {
  sourceSelected: boolean;
  relationSelected: boolean;
  targetReady: boolean;
}): { step1: GuidedStepStatus; step2: GuidedStepStatus; step3: GuidedStepStatus } {
  const step1: GuidedStepStatus = input.sourceSelected ? "completed" : "active";
  const step2: GuidedStepStatus = !input.sourceSelected
    ? "waiting"
    : input.relationSelected
      ? "completed"
      : "active";
  const step3: GuidedStepStatus = !input.relationSelected
    ? "waiting"
    : input.targetReady
      ? "completed"
      : "active";
  return { step1, step2, step3 };
}

export function resolveAutoTargetType(
  relation: DrugControlledRelationDefinition | null
): DrugGraphNodeType | "" {
  if (!relation) return "";
  if (relation.targetTypes.length === 1) return relation.targetTypes[0]!;
  return relation.targetTypes[0] ?? "";
}
