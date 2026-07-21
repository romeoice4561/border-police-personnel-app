/**
 * Gallery asset search contract (Phase 49A.3).
 *
 * Deterministic, explainable matching shared by the repository and tests.
 * Numeric organization codes (e.g. "414") require a standalone token match —
 * they must not match "41", "4140", or "1414" via naive substring contains.
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

function fieldValues(fields: GallerySearchableFields): string[] {
  const out: string[] = [];
  for (const key of [
    "folderName",
    "relativePath",
    "region",
    "company",
    "battalion",
    "unitName",
    "unitNumber",
    "description",
    "remarks",
  ] as const) {
    const v = fields[key];
    if (typeof v === "string" && v.trim()) out.push(v);
  }
  if (Array.isArray(fields.keywords)) {
    for (const k of fields.keywords) if (k?.trim()) out.push(k);
  } else if (typeof fields.keywords === "string" && fields.keywords.trim()) {
    out.push(...fields.keywords.split(",").map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

/**
 * Returns true when `query` legitimately matches at least one searchable field.
 * Empty/whitespace query matches everything (unfiltered set).
 */
export function assetMatchesSearch(fields: GallerySearchableFields, query: string | null | undefined): boolean {
  const raw = (query ?? "").trim();
  if (!raw) return true;
  const values = fieldValues(fields);
  if (isNumericOrgCodeQuery(raw)) {
    return values.some((v) => textHasStandaloneNumericToken(v, raw));
  }
  return values.some((v) => textContainsNormalized(v, raw));
}
