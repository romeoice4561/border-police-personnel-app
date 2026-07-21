/**
 * OCR text normalization (Phase 48 — spec §12).
 *
 * Pure text transforms applied AFTER OCR and BEFORE field extraction/type
 * detection. Every transform here is deterministic and safe — spec's rule
 * "never silently change uncertain values" means these functions only fix
 * things that are unambiguous given the surrounding context (Thai digit
 * glyphs, repeated whitespace, common OCR punctuation slips), never guess at
 * an ambiguous character.
 *
 * Field-level normalization (e.g. "this specific date string becomes this
 * ISO date, for this reason") is tracked per-field in field_extractors/ —
 * this module handles page-level TEXT normalization the extractors then
 * read from.
 *
 * Pure — no I/O, no React.
 */

const THAI_DIGIT_TO_ARABIC: Record<string, string> = {
  "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
  "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9",
};

/** Converts Thai numeral glyphs (๐-๙) to Arabic digits (0-9). Every other character is left untouched. */
export function thaiNumeralsToArabic(text: string): string {
  return text.replace(/[๐-๙]/g, (glyph) => THAI_DIGIT_TO_ARABIC[glyph] ?? glyph);
}

/** Collapses runs of whitespace (including line breaks) to a single space, and trims the ends. Line-break-sensitive callers should normalize BEFORE this if they need line boundaries — this is for single-line field matching. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Normalizes line breaks to a single "\n" (handles \r\n and \r), without collapsing them entirely — used when line structure matters (e.g. GP7's row-based layout). */
export function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Fixes a small, deliberately conservative set of OCR punctuation slips
 * that are unambiguous given Thai document conventions:
 *   - a stray space before a Thai honorific period cluster ("นาย ." -> "นาย")
 *     is NOT touched (too ambiguous) — only literal double punctuation and
 *     obviously-duplicated separators are fixed.
 *   - repeated separator characters ("--", "//", "..") collapse to one.
 */
export function fixCommonPunctuation(text: string): string {
  return text
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/\.{2,}(?!\.\.)/g, ".") // collapse repeated periods, but leave a genuine ellipsis "..." (3) as one visual unit rather than mangling it further
    .replace(/\s+([,.:;])/g, "$1"); // no space before common punctuation
}

/**
 * Normalizes spacing around Thai honorifics (นาย/นาง/นางสาว/ด.ต./ร.ต.อ./etc.)
 * so "นาย สมชาย" and "นายสมชาย" (both seen from OCR depending on source
 * kerning) become a single consistent "นาย สมชาย" form — one space after the
 * honorific, never zero, never multiple. Only recognized honorific prefixes
 * are touched; anything else in the text is left alone.
 */
const THAI_HONORIFICS = ["นาย", "นาง", "นางสาว", "ด.ต.", "ด.ต.หญิง", "ส.ต.ต.", "ส.ต.อ.", "ร.ต.ต.", "ร.ต.อ.", "พ.ต.ท.", "พ.ต.อ.", "พล.ต.ต.", "พล.ต.ท."];

export function normalizeHonorificSpacing(text: string): string {
  let result = text;
  for (const honorific of THAI_HONORIFICS) {
    const escaped = honorific.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`${escaped}\\s*`, "g"), `${honorific} `);
  }
  return result;
}

/**
 * Standardizes document-number separators (spaces/dashes/dots between
 * groups of digits, e.g. a license number "12 345 678" / "12-345-678" /
 * "12.345.678") to a single "-" — used only where the caller already knows
 * it's looking at a document-number-shaped field, never applied to free
 * text globally (a date like "01.01.2568" would be mangled by this if run
 * indiscriminately, so field_extractors call this explicitly per-field,
 * never as part of the page-level pipeline).
 */
export function standardizeDocumentNumberSeparators(value: string): string {
  return value.trim().replace(/[\s.]+/g, "-").replace(/-{2,}/g, "-");
}

export interface NormalizationResult {
  normalizedText: string;
  /** Which transforms were actually applied (had a visible effect), for the review UI / debugging — never the raw text itself in this list, just transform names. */
  appliedTransforms: string[];
}

/**
 * The full page-level normalization pipeline, applied once to raw OCR text
 * before type detection and field extraction run. Order matters: numerals
 * first (so downstream date/number regexes see Arabic digits), then line
 * breaks, then punctuation, then honorific spacing, then whitespace
 * collapse last (so multi-line structure used by GP7/table extractors is
 * preserved as long as possible before finally collapsing for
 * single-line field matches elsewhere).
 */
export function normalizeOcrText(rawText: string): NormalizationResult {
  const applied: string[] = [];
  let text = rawText;

  const afterNumerals = thaiNumeralsToArabic(text);
  if (afterNumerals !== text) applied.push("thai_numerals_to_arabic");
  text = afterNumerals;

  const afterLineBreaks = normalizeLineBreaks(text);
  if (afterLineBreaks !== text) applied.push("normalize_line_breaks");
  text = afterLineBreaks;

  const afterPunctuation = fixCommonPunctuation(text);
  if (afterPunctuation !== text) applied.push("fix_common_punctuation");
  text = afterPunctuation;

  const afterHonorifics = normalizeHonorificSpacing(text);
  if (afterHonorifics !== text) applied.push("normalize_honorific_spacing");
  text = afterHonorifics;

  return { normalizedText: text, appliedTransforms: applied };
}
