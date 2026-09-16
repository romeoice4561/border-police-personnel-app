/**
 * Bounded seized-evidence kinds that are NOT canonical intelligence entities.
 * FIREARM / OTHER persist on DrugCaseEvidenceItem only — never Network nodes.
 */
export const DRUG_CASE_EVIDENCE_KINDS = ["FIREARM", "OTHER"] as const;
export type DrugCaseEvidenceKind = (typeof DRUG_CASE_EVIDENCE_KINDS)[number];
