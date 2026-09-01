/**
 * Field-officer "why found" copy for Relationship result cards (Phase 1B.2.3).
 * Composed from real explanation metadata — never invents roles.
 */

import { explainDrugGraphEdgeClient } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugRelationshipSearchResultItem } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export function relationshipWhyFoundText(
  item: DrugRelationshipSearchResultItem,
  language: "th" | "en",
  roleLabel: (role: string) => string,
  t: (key: TranslationKey) => string
): string {
  const from = item.from.label;
  if (item.explanation.kind === "PATH") {
    return t("di.rel.whyPath").replace("{from}", from).replace("{to}", item.to.label);
  }
  if (item.explanation.kind === "PATH_NOT_FOUND") {
    return t("di.rel.pathNotFound");
  }
  if (item.explanation.kind === "DIRECT_ROLE") {
    return language === "th"
      ? `${from} มีชื่อเป็น${roleLabel(item.explanation.role)}ในรายการนี้`
      : `${from} is recorded as ${roleLabel(item.explanation.role)} on this record`;
  }
  if (item.explanation.kind === "DIRECT_LINK") {
    return language === "th"
      ? `${from} มีข้อมูลเชื่อมโยงกับรายการนี้โดยตรง`
      : `${from} has a directly recorded link to this result`;
  }
  // INFERRED / shared — reuse typed edge explanation (already neutral).
  return explainDrugGraphEdgeClient(item.explanation, roleLabel, language);
}

export function relationshipEvidenceText(
  item: DrugRelationshipSearchResultItem,
  language: "th" | "en",
  roleLabel: (role: string) => string,
  t: (key: TranslationKey) => string
): string {
  if (item.explanation.kind === "PATH") {
    return t("di.rel.pathHops").replace("{count}", String(item.explanation.hopCount));
  }
  if (item.explanation.kind === "PATH_NOT_FOUND") {
    return t("di.rel.pathNotFound");
  }
  if (item.explanation.kind === "DIRECT_ROLE") {
    return language === "th"
      ? `พบชื่อในข้อมูลผู้เกี่ยวข้องของรายการนี้ในฐานะ${roleLabel(item.explanation.role)}`
      : `Name appears among related parties as ${roleLabel(item.explanation.role)}`;
  }
  if (item.explanation.kind === "DIRECT_LINK") {
    return t("di.rel.evidenceDirectLink");
  }
  return explainDrugGraphEdgeClient(item.explanation, roleLabel, language);
}
