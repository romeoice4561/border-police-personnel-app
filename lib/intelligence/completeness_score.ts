/**
 * Document completeness score (Phase 48C — spec §2).
 *
 * A deterministic scoring model over an officer's documents, grouped into
 * the categories spec §2 names (Identity, Training, Awards, Education,
 * Medical, Financial, Operational). Built on top of
 * lib/document/epf_intelligence.ts's `computeCategoryRollups()` /
 * `computeCompleteness()` — this module does NOT recompute per-type
 * presence itself; it re-labels and re-groups epf_intelligence's existing,
 * already-tested category rollups into the spec's category names (which
 * don't map 1:1 onto document_categories.ts's registry — see
 * SPEC_CATEGORY_MAP below) rather than duplicating that logic.
 *
 * Pure — no I/O, no React. Operates on OfficerDocument[] already loaded by
 * the caller (OfficerWithRelations.documents) — no new queries.
 */

import type { OfficerDocument } from "@/lib/database/query_types";
import { computeCategoryRollups, RECOMMENDED_CHECKLIST_CODES, type CategoryRollup } from "@/lib/document/epf_intelligence";

/** Spec §2's category names, mapped onto document_categories.ts's real registry codes — "Operational" combines WEAPONS_QUALIFICATION (firearms + annual evaluation) with OFFICIAL_PERSONNEL (GP7/appointment orders etc.), the closest real-registry fit for "operational readiness" documents. */
export type CompletenessCategory = "IDENTITY" | "TRAINING" | "AWARDS" | "EDUCATION" | "MEDICAL" | "FINANCIAL" | "OPERATIONAL";

const SPEC_CATEGORY_MAP: Record<CompletenessCategory, readonly string[]> = {
  IDENTITY: ["IDENTITY"],
  TRAINING: ["TRAINING"],
  AWARDS: ["AWARDS"],
  EDUCATION: ["EDUCATION"],
  MEDICAL: ["MEDICAL"],
  FINANCIAL: ["FINANCIAL"],
  OPERATIONAL: ["OFFICIAL_PERSONNEL", "WEAPONS_QUALIFICATION"],
};

export const COMPLETENESS_CATEGORY_ORDER: readonly CompletenessCategory[] = [
  "IDENTITY",
  "OPERATIONAL",
  "EDUCATION",
  "TRAINING",
  "AWARDS",
  "MEDICAL",
  "FINANCIAL",
];

export interface CategoryScore {
  category: CompletenessCategory;
  presentCount: number;
  totalCount: number;
  /** Integer 0-100. 0 when totalCount is 0 (a category with no checklist items in this registry — never a fabricated ratio). */
  percent: number;
}

export interface CompletenessScore {
  /** Integer 0-100, the unweighted average of category percents that have at least one checklist item. 0 when no category has any checklist items at all. */
  overallScore: number;
  categoryScores: CategoryScore[];
  /** Categories with percent === 0 and totalCount > 0 — i.e. categories that have checklist items but none present. Categories with totalCount === 0 are never listed here (nothing to be "missing"). */
  missingCategories: CompletenessCategory[];
  /** Document type codes from the recommended checklist (epf_intelligence.ts's RECOMMENDED_CHECKLIST_CODES) that are absent, across every category. */
  missingRequiredDocuments: string[];
}

function mergeRollupsForCategory(rollups: readonly CategoryRollup[], registryCategoryCodes: readonly string[]): { presentCount: number; totalCount: number } {
  let presentCount = 0;
  let totalCount = 0;
  for (const code of registryCategoryCodes) {
    const rollup = rollups.find((r) => r.categoryCode === code);
    if (!rollup) continue;
    presentCount += rollup.presentCount;
    totalCount += rollup.totalCount;
  }
  return { presentCount, totalCount };
}

export function computeCompletenessScore(documents: readonly OfficerDocument[]): CompletenessScore {
  const rollups = computeCategoryRollups(documents);

  const categoryScores: CategoryScore[] = COMPLETENESS_CATEGORY_ORDER.map((category) => {
    const { presentCount, totalCount } = mergeRollupsForCategory(rollups, SPEC_CATEGORY_MAP[category]);
    const percent = totalCount === 0 ? 0 : Math.round((presentCount / totalCount) * 100);
    return { category, presentCount, totalCount, percent };
  });

  const scoredCategories = categoryScores.filter((c) => c.totalCount > 0);
  const overallScore =
    scoredCategories.length === 0 ? 0 : Math.round(scoredCategories.reduce((sum, c) => sum + c.percent, 0) / scoredCategories.length);

  const missingCategories = categoryScores.filter((c) => c.totalCount > 0 && c.percent === 0).map((c) => c.category);

  const active = new Map<string, OfficerDocument>();
  for (const doc of documents) {
    if (!doc.isActive) continue;
    const existing = active.get(doc.documentType);
    if (!existing || doc.version > existing.version) active.set(doc.documentType, doc);
  }
  // RECOMMENDED_CHECKLIST_CODES (epf_intelligence.ts) minus OFFICIAL_PORTRAIT
  // (a synthetic non-document code resolved from the portrait pipeline, not
  // an OfficerDocument row — this module only reports document gaps).
  const missingRequiredDocuments = RECOMMENDED_CHECKLIST_CODES.filter((code) => code !== "OFFICIAL_PORTRAIT" && !active.has(code));

  return { overallScore, categoryScores, missingCategories, missingRequiredDocuments };
}
