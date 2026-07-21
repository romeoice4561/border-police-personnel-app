/**
 * Extraction pipeline orchestrator (Phase 48 — spec §1).
 *
 * Wires the full cost-first flow:
 *   fingerprint -> cache lookup -> OCR -> normalize -> detect type ->
 *   deterministic extraction -> validate -> score confidence -> AI gate ->
 *   (optional AI fallback, only when the gate says so AND the caller has
 *   explicitly confirmed or the budget allows it) -> result.
 *
 * This function NEVER calls AI on its own initiative for a first pass —
 * `runExtractionPipeline` always stops at the gate's decision and returns
 * it; a SEPARATE, explicit call (`runAiFallback`) performs the actual paid
 * call, and only the API route layer decides to invoke it, after the gate
 * says so AND (per spec §5) the user has confirmed. This split is what
 * makes "AI is never called before OCR and rule-based extraction complete"
 * and "no React component decides independently" both structurally
 * enforced rather than just documented.
 */

import type { OCREngine } from "@/lib/ocr/ocr_types";
import { fingerprintBytes, buildCacheKey } from "@/lib/extraction/fingerprint";
import type { ExtractionCache } from "@/lib/extraction/extraction_cache";
import { normalizeOcrText } from "@/lib/extraction/normalization";
import { detectDocumentType } from "@/lib/extraction/document_type_detection";
import { getExtractorForType } from "@/lib/extraction/field_extractors/extractor_registry";
import { computeOverallConfidence } from "@/lib/extraction/confidence_scoring";
import { classifyConfidence, type ConfidencePolicy } from "@/lib/extraction/confidence";
import { shouldUseAiFallback, type AiGateDecision } from "@/lib/extraction/ai_gate";
import type { AiUsagePolicy } from "@/lib/extraction/budget_policy";
import type { AiCallHistory } from "@/lib/extraction/budget_policy";
import type { GovernancePolicy } from "@/lib/extraction/governance_policy";
import type { AiExtractionProvider } from "@/lib/extraction/providers/extraction_provider_types";
import type { ExtractionPipelineResult, ExtractedField } from "@/lib/extraction/extraction_pipeline_types";
import { validateIsoDate } from "@/lib/extraction/field_validation";
import { classifyDocumentRisk } from "@/lib/extraction/risk_classification";
import { analyzeOcrQuality } from "@/lib/extraction/ocr_quality_analyzer";

/** Bump whenever normalization/detection/extractor/validation logic changes meaningfully — part of the cache key. */
export const EXTRACTION_RULES_VERSION = "1.0.0";
export const OCR_PROVIDER_NAME = "tesseract";

export interface RunExtractionPipelineInput {
  imageBytes: Uint8Array;
  imagePath: string;
  mimeType: string;
  documentTypeHint?: string;
  /** True only when the user explicitly clicked "re-analyze" for an already-processed document — used solely for the gate's USER_REQUESTED reason, never to force a NEW OCR pass on a cache hit (cache still wins first). */
  userRequestedReanalysis?: boolean;
  confidencePolicy?: ConfidencePolicy;
  usagePolicy?: AiUsagePolicy;
  callHistory?: AiCallHistory;
  governancePolicy?: GovernancePolicy;
}

export interface RunExtractionPipelineDependencies {
  ocrEngine: OCREngine;
  cache: ExtractionCache;
}

export async function runExtractionPipeline(
  input: RunExtractionPipelineInput,
  deps: RunExtractionPipelineDependencies
): Promise<ExtractionPipelineResult> {
  const startedAt = new Date();
  const fileFingerprint = fingerprintBytes(input.imageBytes);
  const cacheKey = buildCacheKey({
    fileFingerprint,
    ocrProvider: OCR_PROVIDER_NAME,
    extractionRulesVersion: EXTRACTION_RULES_VERSION,
  });

  // ── Cache lookup — never OCR/AI a file already successfully processed ──
  const cacheLookup = deps.cache.get(cacheKey);
  if (cacheLookup.hit && cacheLookup.entry) {
    return { ...cacheLookup.entry.result, fromCache: true, providerUsed: "cache_reused" };
  }

  // ── OCR (Tier 1) ──
  const ocrResult = await deps.ocrEngine.recognize(input.imagePath, { hash: fileFingerprint });
  const ocrConfidence0to100 = ocrResult.confidence > 0 || ocrResult.fullText.length > 0 ? ocrResult.confidence : null;

  // ── Normalize ──
  const { normalizedText } = normalizeOcrText(ocrResult.fullText);

  // ── Detect type ──
  const detected = detectDocumentType(normalizedText);

  // ── Deterministic extraction ──
  const extractor = getExtractorForType(detected.type);
  const fields: ExtractedField[] = extractor ? extractor.extract(normalizedText) : [];
  const requiredFieldCodes = extractor?.requiredFieldCodes ?? [];

  // ── Confidence ──
  const overallConfidence = computeOverallConfidence({
    ocrConfidence0to100,
    documentTypeConfidence: detected.confidence,
    fields,
    requiredFieldCodes,
  });
  const confidenceLevel = classifyConfidence(overallConfidence, input.confidencePolicy);

  // ── Decision gate ──
  const requiredFieldsPresent = requiredFieldCodes.filter((code) =>
    fields.some((f) => f.code === code && f.normalizedValue !== null && f.normalizedValue.trim().length > 0)
  );
  const hasValidationFailures = fields.some((f) => f.normalizedValue !== null && !f.validation.valid);

  const gateDecision: AiGateDecision = shouldUseAiFallback(
    {
      ocrConfidence: ocrConfidence0to100 !== null ? ocrConfidence0to100 / 100 : null,
      documentTypeKnown: detected.type !== "UNKNOWN",
      requiredFieldsPresent,
      requiredFieldsExpected: requiredFieldCodes,
      hasValidationFailures,
      complexLayoutDetected: fields.some((f) => f.code === "complexTablesDetected" && f.rawValue !== null),
      userRequestedAi: input.userRequestedReanalysis ?? false,
      isCacheHit: false,
      isExactDuplicate: false,
    },
    {
      confidencePolicy: input.confidencePolicy,
      usagePolicy: input.usagePolicy,
      callHistory: input.callHistory,
      governancePolicy: input.governancePolicy,
    }
  );

  const completedAt = new Date();

  // "failed" means OCR itself produced nothing usable (empty text) — NOT
  // merely "no deterministic extractor exists for this type" (that's a
  // legitimate ai_suggested/UNKNOWN_DOCUMENT_TYPE outcome, not a failure).
  const status = ocrResult.fullText.trim().length === 0 ? "failed" : gateDecision.shouldUseAi ? "ai_suggested" : "needs_review";

  const risk = classifyDocumentRisk({ documentType: detected.type, confidenceLevel, hasValidationFailures });
  const presentFieldCodes = fields.filter((f) => f.normalizedValue !== null && f.normalizedValue.trim().length > 0).map((f) => f.code);
  const ocrQuality = analyzeOcrQuality(ocrResult, { expectedFieldCodes: requiredFieldCodes, presentFieldCodes });

  const result: ExtractionPipelineResult = {
    status,
    providerUsed: "local_ocr",
    documentType: detected,
    fields,
    overallConfidence,
    confidenceLevel,
    aiFallbackReason: gateDecision.reason,
    aiWasUsed: false,
    aiProviderModel: null,
    fromCache: false,
    processingStartedAt: startedAt.toISOString(),
    processingCompletedAt: completedAt.toISOString(),
    rulesVersion: EXTRACTION_RULES_VERSION,
    risk,
    ocrQuality,
  };

  // Cache the deterministic result immediately — a subsequent identical
  // upload never re-runs OCR, even before any AI decision is acted on.
  deps.cache.set(cacheKey, result);

  return result;
}

export interface RunAiFallbackInput {
  imageBytes: Uint8Array;
  mimeType: string;
  baseResult: ExtractionPipelineResult;
}

export interface RunAiFallbackDependencies {
  aiProvider: AiExtractionProvider;
  cache: ExtractionCache;
  cacheKey: string;
}

/**
 * Performs the ACTUAL paid AI call. Only ever invoked by the API route
 * layer, and only after: (1) runExtractionPipeline already ran, (2) its
 * gate decision said shouldUseAi=true, and (3) the user has explicitly
 * confirmed (or an admin policy has explicitly enabled automatic
 * fallback — checked by the caller before this function is even called).
 * This function does not re-check the gate itself; it trusts the caller
 * already did, keeping the "who decides" logic in exactly one place
 * (ai_gate.ts) while this function only "does."
 */
export async function runAiFallback(input: RunAiFallbackInput, deps: RunAiFallbackDependencies): Promise<ExtractionPipelineResult> {
  const startedAt = new Date();
  const aiResponse = await deps.aiProvider.extractDocumentFields(input.imageBytes, input.mimeType, input.baseResult.documentType.type);

  const aiFields: ExtractedField[] = Object.entries(aiResponse.fields).map(([code, value]) => {
    const validation = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? validateIsoDate(value) : { valid: true, warnings: [] };
    return {
      code,
      label: code,
      rawValue: value,
      normalizedValue: value,
      normalizationReason: null,
      confidence: aiResponse.confidence,
      validation,
    };
  });

  const completedAt = new Date();
  const result: ExtractionPipelineResult = {
    ...input.baseResult,
    status: "ai_used",
    providerUsed: "paid_ai",
    fields: aiFields.length > 0 ? aiFields : input.baseResult.fields,
    overallConfidence: aiResponse.confidence ?? input.baseResult.overallConfidence,
    confidenceLevel: classifyConfidence(aiResponse.confidence ?? input.baseResult.overallConfidence),
    aiWasUsed: true,
    aiProviderModel: `${deps.aiProvider.providerName}/${deps.aiProvider.modelName}`,
    fromCache: false,
    processingStartedAt: startedAt.toISOString(),
    processingCompletedAt: completedAt.toISOString(),
  };

  deps.cache.set(deps.cacheKey, result);
  return result;
}
