/**
 * Gallery Battalion normalization (Phase 27 Part 8).
 *
 * The Gallery Battalion filter UI shows only canonical labels from the
 * shared organization framework (organization_master.ts's "กก.ตชด.NN"), but
 * Asset.battalion is free text populated from Drive folder names/OCR, so a
 * real stored value can differ in spacing/punctuation from the canonical
 * label (e.g. "กก.ตชด. 44", "กก ตชด.44", "กองกำกับการ ตชด.44"). This module
 * maps a canonical battalion code to every text variant the backend should
 * treat as equivalent when filtering, so the strict canonical dropdown still
 * matches real legacy/OCR data instead of silently returning zero results.
 *
 * Pure text normalization — no I/O, no DB. If organization_master.ts is
 * later replaced by a real master-data table, only getBattalionOptions()'s
 * source changes; this module's normalization logic is independent of where
 * the canonical code list comes from.
 */

import { BATTALION_CODES } from "@/lib/organization/organization_master";

/** Collapses whitespace and strips spaces immediately after "." so formatting-only OCR variance doesn't matter. */
function normalizeForComparison(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.\s+/g, ".")
    .toLowerCase();
}

/**
 * Every text variant that should be treated as equivalent to the canonical
 * "กก.ตชด.NN" label for battalion code NN — the canonical label itself, plus
 * common spacing/wording variants seen in imported Drive/OCR data. This is a
 * FIXED set of formatting rules (not a duplicated battalion list — every
 * variant is still derived from the same battalion code out of
 * organization_master.ts).
 */
function variantsForBattalionCode(code: string): string[] {
  return [
    `กก.ตชด.${code}`,
    `กก.ตชด. ${code}`,
    `กก ตชด.${code}`,
    `กองกำกับการ ตชด.${code}`,
    `กองกำกับ ตชด.${code}`,
  ];
}

/** canonical battalion label -> every equivalent stored-text variant, keyed by the exact dropdown value (so a lookup is a single map access). */
const VARIANTS_BY_CANONICAL_LABEL: ReadonlyMap<string, readonly string[]> = new Map(
  BATTALION_CODES.map((code) => [`กก.ตชด.${code}`, variantsForBattalionCode(code)])
);

/**
 * Given the canonical battalion label selected in the filter dropdown,
 * returns every stored-text variant the backend should match against
 * (case-insensitive exact match against any of these) — or just the input
 * value unchanged if it isn't a recognized canonical label (a custom/legacy
 * value typed elsewhere should still filter by itself, exact match, same as
 * before this normalization layer existed).
 */
export function battalionQueryVariants(canonicalOrRawValue: string): readonly string[] {
  const variants = VARIANTS_BY_CANONICAL_LABEL.get(canonicalOrRawValue);
  return variants ?? [canonicalOrRawValue];
}

/** True when `stored` (a raw Asset.battalion value) is equivalent to `canonicalLabel` under the normalization rules above. */
export function isBattalionVariantOf(stored: string, canonicalLabel: string): boolean {
  const normalizedStored = normalizeForComparison(stored);
  return battalionQueryVariants(canonicalLabel).some((variant) => normalizeForComparison(variant) === normalizedStored);
}
