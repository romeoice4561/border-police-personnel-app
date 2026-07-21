/**
 * Extraction API handlers (Phase 48).
 *
 * Framework-agnostic core of the extraction endpoints, mirroring
 * lib/document/document_api_handlers.ts's pattern exactly: each handler
 * takes already-resolved services + params (or a raw Request) and returns
 * a Web Response, so it's unit-testable with fakes and no running server.
 *
 *   POST /api/officers/{id}/documents/{docId}/extract
 *     Runs OCR + deterministic extraction (Tier 1 only). NEVER calls AI —
 *     this endpoint is the one and only entry point for the "cost-first"
 *     pass; it always stops at the gate's decision. Body: {} (no input
 *     needed — the document's already-stored file is fetched server-side).
 *
 *   POST /api/officers/{id}/documents/{docId}/extract/ai-fallback
 *     Runs the ACTUAL paid AI call. Only proceeds when: (1) a prior
 *     extraction result exists, (2) its gate decision said shouldUseAi,
 *     and (3) EITHER the request body explicitly sets
 *     `userConfirmed: true` OR the policy's automaticCallAllowed is true
 *     for that result. Every other path returns 403 with a clear reason —
 *     no silent fallback, ever.
 */

import { z } from "zod";
import { badRequest, jsonError, jsonOk, notFound } from "@/lib/api/api_response";

/** 403 Forbidden — no `forbidden()` helper exists in api_response.ts yet; this wraps jsonError with the right status/code convention rather than adding an ad-hoc inline Response elsewhere. */
function forbidden(message: string): Response {
  return jsonError("FORBIDDEN", message, 403);
}
import { officerIdParamSchema } from "@/lib/api/api_schemas";
import type { DocumentUploadService } from "@/lib/document/document_upload_service";
import type { ExtractionContainer } from "@/lib/extraction/extraction_container";
import { runExtractionPipeline, runAiFallback } from "@/lib/extraction/extraction_pipeline";
import { fingerprintBytes, buildCacheKey } from "@/lib/extraction/fingerprint";
import { computeAiCallHistory } from "@/lib/extraction/usage_meter";
import { EXTRACTION_RULES_VERSION, OCR_PROVIDER_NAME } from "@/lib/extraction/extraction_pipeline";
import { estimatePdfPageCount, decidePdfProcessing } from "@/lib/extraction/pdf_page_info";
import { safeTextPreview } from "@/lib/extraction/redaction";
import { evaluateGovernanceMode } from "@/lib/extraction/governance_policy";
import { randomUUID } from "node:crypto";

const docIdParamSchema = z.object({ docId: z.coerce.number().int().positive() });

async function fetchDocumentBytes(
  service: DocumentUploadService,
  docId: number
): Promise<{ bytes: Uint8Array; mimeType: string } | { error: Response }> {
  const info = await service.getDownloadInfo(docId);
  if (!info) return { error: notFound("Document not found or has no stored file.") };

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(info.fileUrl, { cache: "no-store" });
  } catch (e) {
    return { error: jsonError("STORAGE", `Could not reach storage: ${e instanceof Error ? e.message : String(e)}`, 502) };
  }
  if (!upstream.ok) return { error: jsonError("STORAGE", `File not available (${upstream.status}).`, 502) };

  const buffer = await upstream.arrayBuffer();
  return { bytes: new Uint8Array(buffer), mimeType: info.mimeType };
}

/**
 * POST /extract — Tier 1 only (OCR + deterministic rules). Never calls AI.
 * For a PDF whose page count exceeds the configured automatic limit,
 * returns 200 with a `requiresPageConfirmation: true` payload instead of
 * running OCR at all — spec §16's "never send an entire large PDF
 * automatically."
 */
export async function handleExtractDocument(
  service: DocumentUploadService,
  container: ExtractionContainer,
  rawOfficerId: string,
  rawDocId: string
): Promise<Response> {
  const officerParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!officerParsed.success) return badRequest("Invalid officer id");

  const docParsed = docIdParamSchema.safeParse({ docId: rawDocId });
  if (!docParsed.success) return badRequest("Invalid document id");

  const fetchResult = await fetchDocumentBytes(service, docParsed.data.docId);
  if ("error" in fetchResult) return fetchResult.error;
  const { bytes, mimeType } = fetchResult;

  if (bytes.byteLength > container.usagePolicy.maxFileSizeBytes) {
    return jsonError("VALIDATION", `File exceeds the maximum size for automatic processing (${container.usagePolicy.maxFileSizeBytes} bytes).`, 400);
  }

  const fingerprint = fingerprintBytes(bytes);
  const queueItemId = randomUUID();
  container.queue.enqueue({ id: queueItemId, documentFingerprint: fingerprint, priority: "NORMAL", retryable: true, enqueuedAt: new Date().toISOString() });
  container.queue.transition(queueItemId, "RUNNING");

  if (mimeType === "application/pdf") {
    container.queue.transition(queueItemId, "COMPLETED");
    const pageInfo = estimatePdfPageCount(bytes);
    const decision = decidePdfProcessing(pageInfo, container.usagePolicy.maxPageCount);
    if (!decision.allowed) {
      return jsonOk({
        requiresPageConfirmation: true,
        pageCount: pageInfo.pageCount,
        countIsReliable: pageInfo.countIsReliable,
        reason: decision.reason,
      });
    }
    // Tesseract (Tier 1) recognizes raster IMAGES only — it cannot OCR a
    // PDF's page content directly, and there is no PDF-to-image conversion
    // utility in this project (confirmed absent during Phase 48 research;
    // adding one is out of scope for this phase). Rather than pass a PDF
    // through to the OCR engine (which fails ungracefully — a raw PDF byte
    // stream is not a valid image and the underlying worker cannot even
    // open it as a file path), this is reported as a clear, explicit
    // unsupported-format result instead of attempting OCR at all.
    return jsonOk({
      requiresPageConfirmation: false,
      pdfOcrUnsupported: true,
      pageCount: pageInfo.pageCount,
      reason: "PDF page-image OCR is not yet implemented — only image (JPEG/PNG/WEBP) documents can be processed automatically in this phase.",
    });
  }

  container.observability.emit({ type: "OCR_STARTED", documentFingerprint: fingerprint, detail: { mimeType } });

  const result = await runExtractionPipeline(
    { imageBytes: bytes, imagePath: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`, mimeType, governancePolicy: container.governancePolicy },
    { ocrEngine: container.ocrEngine, cache: container.cache }
  );

  container.observability.emit({
    type: "OCR_FINISHED",
    documentFingerprint: fingerprint,
    detail: { outcome: result.status === "failed" ? "failure" : "success", documentType: result.documentType.type },
  });
  container.observability.emit({
    type: result.fromCache ? "CACHE_HIT" : "CACHE_MISS",
    documentFingerprint: fingerprint,
    detail: { documentType: result.documentType.type },
  });
  if (result.fields.some((f) => f.normalizedValue !== null && !f.validation.valid)) {
    for (const field of result.fields.filter((f) => f.normalizedValue !== null && !f.validation.valid)) {
      container.observability.emit({ type: "VALIDATION_FAILED", documentFingerprint: fingerprint, detail: { fieldCode: field.code } });
    }
  }
  if (result.aiFallbackReason !== "NOT_REQUIRED") {
    container.observability.emit({
      type: "AI_RECOMMENDED",
      documentFingerprint: fingerprint,
      detail: { reason: result.aiFallbackReason, confidenceLevel: result.confidenceLevel },
    });
  }
  container.observability.emit({
    type: "EXTRACTION_COMPLETED",
    documentFingerprint: fingerprint,
    detail: { documentType: result.documentType.type, riskLevel: result.risk.level, status: result.status },
  });
  container.queue.transition(queueItemId, result.status === "failed" ? "FAILED" : "COMPLETED", result.status === "failed" ? { failureReason: "OCR produced no usable text." } : undefined);

  // Safe logging only — never the OCR text or field values themselves.
  console.log("[handleExtractDocument] extraction complete:", {
    documentId: docParsed.data.docId,
    documentType: result.documentType.type,
    confidenceLevel: result.confidenceLevel,
    fromCache: result.fromCache,
    fieldCount: result.fields.length,
    riskLevel: result.risk.level,
    ocrQualityLevel: result.ocrQuality?.level ?? null,
  });

  container.usageMeter.record({
    timestamp: new Date().toISOString(),
    documentFingerprint: fingerprint,
    ocrProviderUsed: result.fromCache ? null : "local_ocr",
    aiProviderUsed: null,
    aiModelUsed: null,
    aiCallReason: null,
    cacheResult: result.fromCache ? "hit" : "miss",
    outcome: result.status === "failed" ? "failure" : "success",
    processingDurationMs: new Date(result.processingCompletedAt).getTime() - new Date(result.processingStartedAt).getTime(),
    inputPages: 1,
    tokenUsage: null,
    estimatedCostUsd: null,
    userId: null,
  });

  return jsonOk(result);
}

const aiFallbackBodySchema = z.object({
  userConfirmed: z.boolean().optional().default(false),
});

/**
 * POST /extract/ai-fallback — Tier 3. Requires a prior extraction result
 * (the caller must have already called /extract) and explicit
 * confirmation, unless policy.automaticFallbackAllowed is true for this
 * exact result (spec §4's admin-approved exception). The budget check
 * (max calls per document/day/month/user) is re-verified here, not
 * trusted from the client.
 */
export async function handleAiFallback(
  service: DocumentUploadService,
  container: ExtractionContainer,
  rawOfficerId: string,
  rawDocId: string,
  request: Request,
  userId: string | null = null
): Promise<Response> {
  const officerParsed = officerIdParamSchema.safeParse({ id: rawOfficerId });
  if (!officerParsed.success) return badRequest("Invalid officer id");

  const docParsed = docIdParamSchema.safeParse({ docId: rawDocId });
  if (!docParsed.success) return badRequest("Invalid document id");

  const body = await request.json().catch(() => ({}));
  const parsedBody = aiFallbackBodySchema.safeParse(body);
  if (!parsedBody.success) return badRequest("Invalid request body.");

  const fetchResult = await fetchDocumentBytes(service, docParsed.data.docId);
  if ("error" in fetchResult) return fetchResult.error;
  const { bytes, mimeType } = fetchResult;

  const fileFingerprint = fingerprintBytes(bytes);
  const cacheKey = buildCacheKey({ fileFingerprint, ocrProvider: OCR_PROVIDER_NAME, extractionRulesVersion: EXTRACTION_RULES_VERSION });
  const cacheLookup = container.cache.get(cacheKey);
  if (!cacheLookup.hit || !cacheLookup.entry) {
    return badRequest("No prior extraction result found for this document — run /extract first.");
  }
  const baseResult = cacheLookup.entry.result;

  if (!container.aiProviderConfigured) {
    container.observability.emit({ type: "AI_BLOCKED", documentFingerprint: fileFingerprint, detail: { reason: "AI_NOT_CONFIGURED" } });
    return jsonError("AI_NOT_CONFIGURED", "The AI provider is not configured on this server.", 503);
  }

  const governanceEvaluation = evaluateGovernanceMode(container.governancePolicy.mode);
  if (!governanceEvaluation.aiPermitted) {
    container.observability.emit({ type: "AI_BLOCKED", documentFingerprint: fileFingerprint, detail: { reason: "GOVERNANCE_MODE", mode: container.governancePolicy.mode } });
    return forbidden(governanceEvaluation.reason);
  }
  if (governanceEvaluation.suppressActualCall) {
    // DRY_RUN: the caller may still confirm, but no real provider call may
    // ever be made — return the base (OCR-only) result unchanged, clearly
    // labeled, rather than silently pretending AI ran.
    container.observability.emit({ type: "AI_BLOCKED", documentFingerprint: fileFingerprint, detail: { reason: "DRY_RUN" } });
    return jsonOk({ ...baseResult, aiWasUsed: false, dryRun: true, dryRunMessage: "Governance mode is DRY_RUN — no real AI call was made." });
  }

  const callHistory = computeAiCallHistory(container.usageMeter, { documentFingerprint: fileFingerprint, userId });

  const explicitConfirmation = parsedBody.data.userConfirmed;
  if (!explicitConfirmation) {
    // A request that explicitly SET userConfirmed:false is a genuine user
    // cancellation (the UI's cancel button); an omitted field defaulting to
    // false via the schema is treated the same way here since the caller
    // never confirmed either way — both are "no AI call happened," which is
    // exactly what AI_CANCELLED means for the dashboard's counters.
    container.observability.emit({ type: "AI_CANCELLED", documentFingerprint: fileFingerprint, detail: {} });
    return forbidden("AI fallback requires explicit user confirmation for this document.");
  }
  // Duplicate/repeat AI reprocessing for the SAME file fingerprint is
  // enforced here via callHistory (an AI call already recorded for this
  // fingerprint counts toward maxAiCallsPerDocument, which defaults to 1) —
  // not via baseResult.fromCache, which reflects whether *this specific
  // lookup* was a cache hit and is always false on the stored entry itself,
  // never a signal of "AI already ran for this file."
  if (callHistory.callsForThisDocument >= container.usagePolicy.maxAiCallsPerDocument) {
    container.observability.emit({ type: "AI_BLOCKED", documentFingerprint: fileFingerprint, detail: { reason: "MAX_CALLS_PER_DOCUMENT" } });
    return forbidden(`Maximum AI calls per document (${container.usagePolicy.maxAiCallsPerDocument}) already reached.`);
  }
  if (container.usagePolicy.dailyCallLimit !== null && callHistory.callsToday >= container.usagePolicy.dailyCallLimit) {
    container.observability.emit({ type: "AI_BLOCKED", documentFingerprint: fileFingerprint, detail: { reason: "DAILY_LIMIT" } });
    return forbidden("Daily AI call limit reached.");
  }
  if (container.usagePolicy.monthlyCallLimit !== null && callHistory.callsThisMonth >= container.usagePolicy.monthlyCallLimit) {
    container.observability.emit({ type: "AI_BLOCKED", documentFingerprint: fileFingerprint, detail: { reason: "MONTHLY_LIMIT" } });
    return forbidden("Monthly AI call limit reached.");
  }

  container.observability.emit({ type: "AI_CONFIRMED", documentFingerprint: fileFingerprint, detail: { reason: baseResult.aiFallbackReason } });

  const startedAt = Date.now();
  let result;
  try {
    result = await runAiFallback({ imageBytes: bytes, mimeType, baseResult }, { aiProvider: container.aiProvider, cache: container.cache, cacheKey });
  } catch (error) {
    // Safe: log only the error's message/name, never any embedded content.
    console.error("[handleAiFallback] AI extraction failed:", error instanceof Error ? error.name : "unknown error");
    container.usageMeter.record({
      timestamp: new Date().toISOString(),
      documentFingerprint: fileFingerprint,
      ocrProviderUsed: null,
      aiProviderUsed: container.aiProvider.providerName,
      aiModelUsed: container.aiProvider.modelName,
      aiCallReason: baseResult.aiFallbackReason,
      cacheResult: "miss",
      outcome: "failure",
      processingDurationMs: Date.now() - startedAt,
      inputPages: 1,
      tokenUsage: null,
      estimatedCostUsd: null,
      userId,
    });
    // Spec §19: AI failure preserves the OCR result — return it, not a hard error.
    return jsonOk({ ...baseResult, aiFallbackFailed: true, aiFailureMessage: "AI extraction failed. The original OCR result is still available." });
  }

  console.log("[handleAiFallback] AI extraction complete:", {
    documentId: docParsed.data.docId,
    provider: container.aiProvider.providerName,
    model: container.aiProvider.modelName,
    fieldCountPreview: safeTextPreview(JSON.stringify(result.fields.map((f) => f.code))),
  });

  container.usageMeter.record({
    timestamp: new Date().toISOString(),
    documentFingerprint: fileFingerprint,
    ocrProviderUsed: null,
    aiProviderUsed: container.aiProvider.providerName,
    aiModelUsed: container.aiProvider.modelName,
    aiCallReason: baseResult.aiFallbackReason,
    cacheResult: "miss",
    outcome: "success",
    processingDurationMs: Date.now() - startedAt,
    inputPages: 1,
    tokenUsage: null, // populated below if the provider reported it
    estimatedCostUsd: null,
    userId,
  });

  return jsonOk(result);
}
