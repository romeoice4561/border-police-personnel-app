/**
 * Generic document extraction prompt (Phase 48 — Tier 3 AI fallback).
 *
 * Distinct from lib/ai/prompt_builder.ts's `buildVisionPrompt()`, which is
 * hardcoded to the personnel-profile-image schema (rank/name/position/
 * unit/timeline) used by the bulk-import feature — that prompt does not
 * fit generic document field extraction (ID card, license, certificate)
 * and is not reused here. This is the ONE prompt for Phase 48's Tier 3
 * calls; bump PROMPT_SCHEMA_VERSION whenever the instructions or expected
 * JSON shape change (it's part of the cache key — fingerprint.ts's
 * aiPromptSchemaVersion).
 */

/** Bump on any change to the prompt text or the expected response JSON shape. */
export const PROMPT_SCHEMA_VERSION = "1.0.0";

export function buildGenericDocumentExtractionPrompt(documentTypeHint: string | null): string {
  const hintLine = documentTypeHint
    ? `The document is expected to be of type: ${documentTypeHint}. Confirm or correct this if the image shows otherwise.`
    : "The document type is unknown — identify it as part of your response.";

  return [
    "You are extracting structured fields from a single official Thai personnel document image.",
    hintLine,
    "Return ONLY a JSON object (no markdown fences, no explanatory prose) with exactly this shape:",
    "{",
    '  "documentType": string,',
    '  "confidence": number between 0 and 1,',
    '  "fields": { [fieldName: string]: string | null }',
    "}",
    "Rules:",
    "- Use ISO yyyy-mm-dd for any date field. Thai documents use the Buddhist Era (พ.ศ.) — convert to Gregorian before returning (Buddhist year minus 543).",
    "- If a field is not visible or not present on the document, return null for it — never invent a value.",
    "- Do not include any field not actually visible on the document.",
    "- confidence reflects your own certainty about the extraction as a whole, not per-field.",
  ].join("\n");
}
