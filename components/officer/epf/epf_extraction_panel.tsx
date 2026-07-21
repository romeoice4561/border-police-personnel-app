/**
 * EpfExtractionPanel (Phase 48 — Cost-Efficient OCR & Selective AI
 * Extraction, spec §14).
 *
 * The OCR/Extraction workspace inside the e-PF Detail Drawer. Replaces the
 * previous static "AI Analysis — coming in a future phase" placeholder
 * section. This component NEVER decides whether to call AI — it only:
 *   1. Triggers /extract (Tier 1: OCR + deterministic rules, no AI).
 *   2. Renders whatever the server's AI gate decision (aiFallbackReason,
 *      confidenceLevel) already computed.
 *   3. For a medium/low-confidence result, shows the optional
 *      "ใช้ AI ช่วยตรวจเพิ่มเติม" button — clicking it opens a confirmation
 *      dialog (spec §5's required disclosure) and only THEN calls
 *      /extract/ai-fallback with `userConfirmed: true`. The server
 *      re-verifies the gate/budget itself; this component's job is only to
 *      get the user's explicit, informed confirmation before asking.
 *   4. Lets the user accept/reject each field and Approve & Save only the
 *      supported metadata fields (issueDate/expiryDate/renewalDate/title/
 *      description) — identity-like fields (name, national ID) are shown
 *      as suggestions only, never wired to a save action in this phase.
 */
"use client";

import { useState } from "react";
import { ScanSearch, Sparkles, CheckCircle2, AlertTriangle, HelpCircle, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import type { ExtractionPipelineResult } from "@/lib/extraction/extraction_pipeline_types";
import type { ConfidenceLevel } from "@/lib/extraction/confidence";

const CONFIDENCE_LABEL_KEY: Record<ConfidenceLevel, TranslationKey> = {
  high: "epf.extraction.confidenceHigh",
  medium: "epf.extraction.confidenceMedium",
  low: "epf.extraction.confidenceLow",
  unknown: "epf.extraction.confidenceUnknown",
};
const CONFIDENCE_TONE: Record<ConfidenceLevel, "good" | "warning" | "serious" | "neutral"> = {
  high: "good",
  medium: "warning",
  low: "serious",
  unknown: "neutral",
};
const PROVIDER_LABEL_KEY: Record<ExtractionPipelineResult["providerUsed"], TranslationKey> = {
  local_ocr: "epf.extraction.providerLocalOcr",
  ocr_service: "epf.extraction.providerOcrService",
  paid_ai: "epf.extraction.providerPaidAi",
  cache_reused: "epf.extraction.providerCacheReused",
};
const STATUS_LABEL_KEY: Record<ExtractionPipelineResult["status"], TranslationKey> = {
  not_processed: "epf.extraction.statusNotProcessed",
  ocr_complete: "epf.extraction.statusOcrComplete",
  needs_review: "epf.extraction.statusNeedsReview",
  ai_suggested: "epf.extraction.statusAiSuggested",
  ai_used: "epf.extraction.statusAiUsed",
  approved: "epf.extraction.statusApproved",
  failed: "epf.extraction.statusFailed",
};

/** Fields whose approved value is allowed to save into OfficerDocument metadata this phase (spec §15). Everything else is a suggestion-only display. */
const SAVABLE_FIELD_CODES = new Set(["issueDate", "expiryDate", "renewalDate", "title", "description"]);

export function EpfExtractionPanel({
  officerId,
  docId,
  hasDocument,
  onApprovedFieldsSave,
}: {
  officerId: string;
  docId: number | null;
  hasDocument: boolean;
  /** Called with the accepted-and-savable fields (issueDate/expiryDate/renewalDate/title/description only) when the user clicks Approve & Save. */
  onApprovedFieldsSave: (fields: Record<string, string>) => void;
}) {
  const { t } = useT();
  const [result, setResult] = useState<ExtractionPipelineResult | null>(null);
  const [requiresPageConfirmation, setRequiresPageConfirmation] = useState<{ pageCount: number; reason: string } | null>(null);
  const [pdfUnsupported, setPdfUnsupported] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [acceptedFieldCodes, setAcceptedFieldCodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function runExtraction() {
    if (!docId) return;
    setProcessing(true);
    setError(null);
    setRequiresPageConfirmation(null);
    setPdfUnsupported(null);
    try {
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/documents/${docId}/extract`, { method: "POST" });
      if (!res.ok) throw new Error(`Extraction failed (${res.status}).`);
      const body = await res.json();
      if (body.data?.pdfOcrUnsupported) {
        setPdfUnsupported(body.data.reason);
        return;
      }
      if (body.data?.requiresPageConfirmation) {
        setRequiresPageConfirmation({ pageCount: body.data.pageCount, reason: body.data.reason });
        return;
      }
      setResult(body.data as ExtractionPipelineResult);
      setAcceptedFieldCodes(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function confirmAiFallback() {
    if (!docId) return;
    setAiConfirmOpen(false);
    setAiProcessing(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/documents/${docId}/extract/ai-fallback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userConfirmed: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setAiError(body?.error?.message ?? `AI fallback failed (${res.status}).`);
        return;
      }
      if (body.data?.aiFallbackFailed) {
        setAiError(body.data.aiFailureMessage ?? t("epf.extraction.aiFailed"));
      }
      setResult(body.data as ExtractionPipelineResult);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t("epf.extraction.aiFailed"));
    } finally {
      setAiProcessing(false);
    }
  }

  function toggleAccept(code: string) {
    setAcceptedFieldCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleApproveAndSave() {
    if (!result) return;
    const fieldsToSave: Record<string, string> = {};
    for (const field of result.fields) {
      if (!acceptedFieldCodes.has(field.code)) continue;
      if (!SAVABLE_FIELD_CODES.has(field.code)) continue;
      if (field.normalizedValue) fieldsToSave[field.code] = field.normalizedValue;
    }
    onApprovedFieldsSave(fieldsToSave);
  }

  const confidenceLevel = result?.confidenceLevel ?? "unknown";
  const showAiOption = result && !result.aiWasUsed && (confidenceLevel === "medium" || confidenceLevel === "low" || confidenceLevel === "unknown") && !result.fromCache;

  return (
    <section aria-labelledby="epf-extraction-heading" className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <h3 id="epf-extraction-heading" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ScanSearch className="h-4 w-4 text-muted" aria-hidden="true" />
        {t("epf.extraction.heading")}
      </h3>

      {!hasDocument ? (
        <p className="text-xs text-muted">—</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={processing || !docId} onClick={() => void runExtraction()}>
              {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />}
              {processing ? t("epf.extraction.processing") : result ? t("epf.extraction.reprocessButton") : t("epf.extraction.runButton")}
            </Button>
            {result ? (
              <Badge tone="neutral">{t(STATUS_LABEL_KEY[result.status])}</Badge>
            ) : (
              <Badge tone="neutral">{t("epf.extraction.statusNotProcessed")}</Badge>
            )}
          </div>

          {error ? (
            <p className="flex items-center gap-1 text-xs text-serious" role="alert">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          {requiresPageConfirmation ? (
            <p className="flex items-start gap-1.5 rounded-md bg-warning-bg/40 px-2.5 py-2 text-xs text-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
              {t("epf.extraction.pdfPageLimitNotice")} ({requiresPageConfirmation.pageCount} pages)
            </p>
          ) : null}

          {pdfUnsupported ? (
            <p className="flex items-start gap-1.5 rounded-md bg-neutral-bg px-2.5 py-2 text-xs text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {pdfUnsupported}
            </p>
          ) : null}

          {result ? (
            <div className="space-y-3">
              {/* Provider transparency — spec §14's required status/provider display. */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">{t("epf.extraction.documentTypeLabel")}:</span>
                <span className="font-medium text-foreground">{result.documentType.type}</span>
                <Badge tone={CONFIDENCE_TONE[confidenceLevel]}>
                  {t("epf.extraction.confidenceLabel")}: {t(CONFIDENCE_LABEL_KEY[confidenceLevel])}
                  {result.overallConfidence !== null ? ` (${Math.round(result.overallConfidence * 100)}%)` : ""}
                </Badge>
                <Badge tone="neutral">{t(PROVIDER_LABEL_KEY[result.providerUsed])}</Badge>
              </div>

              {result.fromCache ? (
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t("epf.extraction.cachedNotice")}
                </p>
              ) : !result.aiWasUsed ? (
                <p className="flex items-center gap-1.5 text-xs text-good">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t("epf.extraction.noAiUsedNotice")}
                </p>
              ) : null}

              {/* Field review table — spec §14: label, raw, normalized, confidence, validation, accept/reject. */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">{t("epf.extraction.fieldsHeading")}</p>
                {result.fields.length === 0 ? (
                  <p className="text-xs text-muted">{t("epf.extraction.noFieldsFound")}</p>
                ) : (
                  <ul className="space-y-2">
                    {result.fields.map((field) => {
                      const isIdentityLike = !SAVABLE_FIELD_CODES.has(field.code);
                      return (
                        <li key={field.code} className="rounded-md border border-border bg-neutral-bg p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground">{field.label}</p>
                              <p className="text-xs text-muted">
                                {t("epf.extraction.normalizedValue")}: <span className="text-foreground">{field.normalizedValue ?? "—"}</span>
                              </p>
                              {field.normalizedValue !== field.rawValue && field.rawValue ? (
                                <p className="text-[11px] text-muted">
                                  {t("epf.extraction.rawValue")}: {field.rawValue}
                                </p>
                              ) : null}
                              {isIdentityLike ? (
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted italic">
                                  <HelpCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  {t("epf.extraction.identitySuggestionNotice")}
                                </p>
                              ) : null}
                              {!field.validation.valid
                                ? field.validation.warnings.map((w, i) => (
                                    <p key={i} className="mt-0.5 flex items-center gap-1 text-[11px] text-serious">
                                      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                                      {w}
                                    </p>
                                  ))
                                : null}
                            </div>
                            {!isIdentityLike && field.normalizedValue ? (
                              <Button
                                type="button"
                                variant={acceptedFieldCodes.has(field.code) ? "accent" : "outline"}
                                size="sm"
                                onClick={() => toggleAccept(field.code)}
                              >
                                {acceptedFieldCodes.has(field.code) ? t("epf.extraction.accept") : t("epf.extraction.reject")}
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {showAiOption ? (
                <div className="space-y-2 rounded-md bg-neutral-bg p-2.5">
                  {confidenceLevel === "low" || confidenceLevel === "unknown" ? (
                    <p className="flex items-center gap-1.5 text-xs text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {t("epf.extraction.aiRecommendedNotice")}
                    </p>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" disabled={aiProcessing} onClick={() => setAiConfirmOpen(true)}>
                    {aiProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t("epf.extraction.aiOptionalButton")}
                  </Button>
                </div>
              ) : null}

              {aiError ? (
                <p className="flex items-center gap-1 text-xs text-serious" role="alert">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {aiError}
                </p>
              ) : null}

              {acceptedFieldCodes.size > 0 ? (
                <div className="space-y-1.5 border-t border-border pt-2.5">
                  <p className="text-[11px] text-muted">{t("epf.extraction.approveNote")}</p>
                  <Button type="button" size="sm" onClick={handleApproveAndSave}>
                    {t("epf.extraction.approveAndSave")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {/* AI confirmation dialog — spec §5's required disclosure before any paid call. */}
      {aiConfirmOpen ? (
        <div role="dialog" aria-modal="true" aria-label={t("epf.extraction.aiConfirmTitle")} className="rounded-lg border border-accent bg-surface p-3">
          <p className="text-sm font-semibold text-foreground">{t("epf.extraction.aiConfirmTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("epf.extraction.aiConfirmBody1")}</p>
          <p className="text-xs text-muted">{t("epf.extraction.aiConfirmBody2")}</p>
          <p className="mt-2 text-xs">
            <span className="text-muted">{t("epf.extraction.aiConfirmProviderLabel")}:</span> <span className="font-medium text-foreground">OpenAI</span>
          </p>
          <p className="text-xs">
            <span className="text-muted">{t("epf.extraction.aiConfirmUsageLabel")}:</span>{" "}
            <span className="font-medium text-foreground">
              {confidenceLevel === "low" || confidenceLevel === "unknown" ? t("epf.extraction.usageMedium") : t("epf.extraction.usageLow")}
            </span>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => void confirmAiFallback()}>
              {t("epf.extraction.aiConfirmButton")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAiConfirmOpen(false)}>
              {t("epf.extraction.aiCancelButton")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
