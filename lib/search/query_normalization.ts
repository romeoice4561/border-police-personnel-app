/**
 * Global Search query normalization (Phase 26B Part B).
 *
 * "Case insensitive. Thai insensitive. Whitespace insensitive. Should
 * behave similar to Google search." Thai script has no letter case, so
 * "Thai insensitive" here means: normalize whitespace (collapse runs,
 * trim) and strip characters that don't carry search meaning, so a query
 * or a stored value with extra/irregular spacing (e.g. "ร้อย  ตชด.434" vs
 * "ร้อยตชด.434") still matches. Case-folding still applies for the Latin
 * text mixed into real records (officerId, phone, rank abbreviations).
 *
 * Pure — no I/O, no React.
 */

/** Collapses runs of whitespace to a single space, trims, and lowercases (Latin case-fold; Thai is unaffected by lowercasing). */
export function normalizeSearchText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * A whitespace-STRIPPED variant (no spaces at all), for the "Google-like"
 * behavior the spec calls out explicitly: typing "434" must find "ร้อย
 * ตชด.434" even though the stored value has a space before the digits the
 * query doesn't. Contains-matching against this stripped form catches
 * queries/values that only differ by spacing, without over-matching (still
 * requires every character of the query to appear in the stored text, in
 * order).
 */
export function stripAllWhitespace(value: string): string {
  return value.replace(/\s+/g, "");
}

/** True when `haystack` contains `needle`, ignoring case/whitespace-run differences and pure spacing differences. */
export function fuzzyContains(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) return false;
  const normalizedHaystack = normalizeSearchText(haystack);
  if (normalizedHaystack.includes(normalizedNeedle)) return true;
  return stripAllWhitespace(normalizedHaystack).includes(stripAllWhitespace(normalizedNeedle));
}
