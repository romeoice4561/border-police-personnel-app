/**
 * Gallery asset search contract (Phase 49A.3 / 49A.3A).
 *
 * Deterministic, explainable matching shared by the repository and tests.
 * Numeric organization codes (e.g. "414") require a standalone token match in
 * approved organization/path fields — they must not match "41", "4140",
 * "1414", or a free-text keyword that happens to contain the digits.
 */

/** Normalize whitespace + case for comparison. */
export function normalizeGallerySearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when the trimmed query is digits only (org-code style). */
export function isNumericOrgCodeQuery(query: string): boolean {
  return /^\d+$/.test(query.trim());
}

/**
 * Standalone token match for a numeric org code inside free text.
 * Matches: "414", "ร้อย ตชด.414", "กองร้อย 414", "path/414/file.jpg"
 * Does not match: "41", "4140", "1414"
 */
export function textHasStandaloneNumericToken(haystack: string, token: string): boolean {
  const t = token.trim();
  if (!/^\d+$/.test(t)) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^0-9])${escaped}([^0-9]|$)`);
  return re.test(haystack);
}

/** Case-insensitive substring match for ordinary (non-numeric-only) text. */
export function textContainsNormalized(haystack: string, needle: string): boolean {
  const n = normalizeGallerySearchQuery(needle);
  if (!n) return false;
  return normalizeGallerySearchQuery(haystack).includes(n);
}

export interface GallerySearchableFields {
  folderName?: string | null;
  relativePath?: string | null;
  region?: string | null;
  company?: string | null;
  battalion?: string | null;
  unitName?: string | null;
  unitNumber?: string | null;
  keywords?: string | null | readonly string[];
  description?: string | null;
  remarks?: string | null;
}

/**
 * Organization / path fields approved for numeric org-code queries.
 * Editorial free-text (keywords / description / remarks) is excluded so a
 * mis-tagged keyword like "414" on a ภาค 1 / ตชด.115 card cannot produce a
 * false hit.
 */
export const GALLERY_NUMERIC_SEARCH_FIELDS = [
  "folderName",
  "relativePath",
  "region",
  "company",
  "battalion",
  "unitName",
  "unitNumber",
] as const;

/** All default searchable fields for ordinary (non-numeric) text queries. */
export const GALLERY_TEXT_SEARCH_FIELDS = [
  ...GALLERY_NUMERIC_SEARCH_FIELDS,
  "keywords",
  "description",
  "remarks",
] as const;

export type GallerySearchFieldName =
  | (typeof GALLERY_TEXT_SEARCH_FIELDS)[number];

function keywordValues(keywords: GallerySearchableFields["keywords"]): string[] {
  if (Array.isArray(keywords)) {
    return keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
  }
  if (typeof keywords === "string" && keywords.trim()) {
    return keywords.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function valuesForFields(
  fields: GallerySearchableFields,
  keys: readonly GallerySearchFieldName[]
): Array<{ field: GallerySearchFieldName; value: string }> {
  const out: Array<{ field: GallerySearchFieldName; value: string }> = [];
  for (const key of keys) {
    if (key === "keywords") {
      for (const k of keywordValues(fields.keywords)) out.push({ field: "keywords", value: k });
      continue;
    }
    const v = fields[key];
    if (typeof v === "string" && v.trim()) out.push({ field: key, value: v });
  }
  return out;
}

/**
 * Explains which approved field caused a search hit (for tests / audits).
 * Returns null when the query does not match.
 */
export function explainGallerySearchMatch(
  fields: GallerySearchableFields,
  query: string | null | undefined
): { field: GallerySearchFieldName; value: string } | null {
  const raw = (query ?? "").trim();
  if (!raw) return { field: "folderName", value: "" };
  const numeric = isNumericOrgCodeQuery(raw);
  const keys = numeric ? GALLERY_NUMERIC_SEARCH_FIELDS : GALLERY_TEXT_SEARCH_FIELDS;
  const values = valuesForFields(fields, keys);
  for (const entry of values) {
    const hit = numeric
      ? textHasStandaloneNumericToken(entry.value, raw)
      : textContainsNormalized(entry.value, raw);
    if (hit) return entry;
  }
  return null;
}

/**
 * Returns true when `query` legitimately matches at least one searchable field.
 * Empty/whitespace query matches everything (unfiltered set).
 */
export function assetMatchesSearch(fields: GallerySearchableFields, query: string | null | undefined): boolean {
  const raw = (query ?? "").trim();
  if (!raw) return true;
  return explainGallerySearchMatch(fields, raw) !== null;
}

/**
 * Canonical Gallery verification predicate (Phase 49A.3A).
 *
 * Source of truth: Asset.verified boolean (Phase 22A metadata editor).
 * Legacy precedence (documented for future representations):
 *   1. explicit boolean `verified === true`
 *   2. otherwise not verified
 *
 * Badge, API filter, counts, and tests MUST use this helper (or an equivalent
 * repository predicate that matches it exactly).
 */
export function isGalleryAssetVerified(asset: { verified?: boolean | null }): boolean {
  return asset.verified === true;
}
