/**
 * Plain-language Relationship Search result summaries (Phase 1B.2.3).
 * Uses catalog target type + count — never invents roles or overclaims.
 */

import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugControlledRelationDefinition } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export function relationshipResultSummaryKey(
  relation: DrugControlledRelationDefinition | null | undefined,
  targetType: DrugGraphNodeType | "" | undefined
): TranslationKey {
  if (relation?.queryMode === "PATH" || relation?.edgeKind === "PATH") {
    return "di.rel.summaryPath";
  }
  const tt = targetType || relation?.targetTypes[0];
  switch (tt) {
    case "CASE":
      return "di.rel.summaryCases";
    case "PHONE":
      return "di.rel.summaryPhones";
    case "PERSON":
      return "di.rel.summaryPersons";
    case "VEHICLE":
      return "di.rel.summaryVehicles";
    case "DEVICE":
      return "di.rel.summaryDevices";
    case "SIM":
      return "di.rel.summarySims";
    case "LOCATION":
      return "di.rel.summaryLocations";
    default:
      return "di.rel.summaryGeneric";
  }
}

/** Contextual “กับ …” fragment key by source entity type (optional suffix). */
export function relationshipResultSummaryWithSourceKey(
  sourceType: DrugGraphNodeType | undefined
): TranslationKey | null {
  switch (sourceType) {
    case "PERSON":
      return "di.rel.summaryWithPerson";
    case "PHONE":
      return "di.rel.summaryWithPhone";
    case "VEHICLE":
      return "di.rel.summaryWithVehicle";
    case "DEVICE":
      return "di.rel.summaryWithDevice";
    case "SIM":
      return "di.rel.summaryWithSim";
    case "CASE":
      return "di.rel.summaryWithCase";
    default:
      return null;
  }
}

export function formatRelationshipResultSummary(args: {
  count: number;
  relation: DrugControlledRelationDefinition | null | undefined;
  targetType: DrugGraphNodeType | "" | undefined;
  sourceType?: DrugGraphNodeType;
  sourceLabel?: string;
  t: (key: TranslationKey) => string;
  locale?: string;
}): string {
  const { count, relation, targetType, sourceType, sourceLabel, t, locale = "th-TH" } = args;
  if (relation?.queryMode === "PATH" || relation?.edgeKind === "PATH") {
    return t("di.rel.summaryPath");
  }
  const base = t(relationshipResultSummaryKey(relation, targetType)).replace(
    "{count}",
    count.toLocaleString(locale)
  );
  const withKey = relationshipResultSummaryWithSourceKey(sourceType);
  if (!withKey) return base;
  if (sourceType === "PERSON" || sourceType === "CASE") {
    if (!sourceLabel?.trim()) return base;
    return `${base}${t(withKey).replace("{label}", sourceLabel.trim())}`;
  }
  return `${base}${t(withKey)}`;
}

/** Card ordinal label e.g. "คดีที่ 1" when target is CASE. */
export function relationshipResultOrdinalKey(targetType: DrugGraphNodeType | undefined): TranslationKey {
  switch (targetType) {
    case "CASE":
      return "di.rel.cardOrdinalCase";
    case "PHONE":
      return "di.rel.cardOrdinalPhone";
    case "PERSON":
      return "di.rel.cardOrdinalPerson";
    case "VEHICLE":
      return "di.rel.cardOrdinalVehicle";
    case "DEVICE":
      return "di.rel.cardOrdinalDevice";
    case "SIM":
      return "di.rel.cardOrdinalSim";
    default:
      return "di.rel.cardOrdinalGeneric";
  }
}
