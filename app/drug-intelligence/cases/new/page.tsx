/**
 * Create Case (Phase DI-1 Round 2, Section 6).
 *
 * Step-navigated (not a single long form — Section 6's explicit
 * instruction), back-and-forth editable at any point before final save.
 * Round 1's POST /api/drug-intelligence/cases contract accepts the WHOLE
 * case (case info + persons + phones/SIM/devices/vehicles + seized items +
 * locations) in ONE transactional request, so this form collects everything
 * client-side into one draft and submits once — no draft-case-then-append
 * workaround needed (Round 1's transaction already covers every entity).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, FileSpreadsheet, Network as NetworkIcon, BellRing } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useOrganizationEngine } from "@/lib/ui/hooks";
import { useGenerateDrugAlerts } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { drugIntelligenceClient, ApiClientError, type DrugIntelligenceAlert } from "@/lib/drug_intelligence/drug_intelligence_client";
import { createEmptyDraft, buildCreateCaseRequest, validateDraft, type CreateCaseDraft } from "@/lib/drug_intelligence/create_case_draft";
import { CreateCaseArrestStep } from "@/components/drug_intelligence/create_case_arrest_step";
import { CreateCaseUnitsStep } from "@/components/drug_intelligence/create_case_units_step";
import { CreateCasePersonsStep } from "@/components/drug_intelligence/create_case_persons_step";
import { CreateCaseSeizedStep } from "@/components/drug_intelligence/create_case_seized_step";
import { CreateCaseLocationsStep } from "@/components/drug_intelligence/create_case_locations_step";
import { CreateCaseReviewStep } from "@/components/drug_intelligence/create_case_review_step";

const STEPS = [
  { key: "arrest", labelKey: "di.create.stepArrest" },
  { key: "units", labelKey: "di.create.stepUnits" },
  { key: "persons", labelKey: "di.create.stepPersons" },
  { key: "seized", labelKey: "di.create.stepSeized" },
  { key: "locations", labelKey: "di.create.stepLocations" },
  { key: "review", labelKey: "di.create.stepReview" },
] as const;

export default function CreateDrugCasePage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const { t } = useT();
  const organizationEngine = useOrganizationEngine();
  const [draft, setDraft] = useState<CreateCaseDraft>(createEmptyDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCase, setCreatedCase] = useState<{ caseId: string; alerts: DrugIntelligenceAlert[] } | null>(null);
  const generateAlerts = useGenerateDrugAlerts(user?.id ?? null, user?.displayName ?? "");

  if (!can("drug.create")) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-muted">{t("di.error.permissionDenied")}</p>
      </div>
    );
  }

  const currentStep = STEPS[stepIndex];
  const errors = validateDraft(draft);

  function patchDraft(patch: Partial<CreateCaseDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function jumpToStep(stepKey: string) {
    const idx = STEPS.findIndex((s) => s.key === stepKey);
    if (idx >= 0) setStepIndex(idx);
  }

  async function handleSubmit() {
    if (submitting) return; // double-submit guard
    if (errors.length > 0) {
      setStepIndex(STEPS.length - 1);
      return;
    }
    if (!user) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const request = buildCreateCaseRequest(draft, user.id, user.displayName);
      const result = await drugIntelligenceClient.createCase(request);
      // Section 7: generate alerts AFTER the case is already saved — a
      // failure here must never be treated as a case-creation failure,
      // never rolls back, never blocks reaching the success summary.
      const generated = await generateAlerts.mutateAsync(result.caseId).catch(() => ({ alerts: [] as DrugIntelligenceAlert[] }));
      setCreatedCase({ caseId: result.caseId, alerts: generated.alerts });
      setSubmitting(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 409) {
          setSubmitError(t("di.error.duplicate"));
          setStepIndex(STEPS.findIndex((s) => s.key === "persons"));
        } else if (error.status === 400) {
          setSubmitError(t("di.error.validation"));
        } else if (error.status === 403) {
          setSubmitError(t("di.error.permissionDenied"));
        } else {
          setSubmitError(t("di.error.saveFailed"));
        }
      } else {
        setSubmitError(t("di.error.saveFailed"));
      }
      setSubmitting(false);
    }
  }

  if (createdCase) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="border-good/40 bg-good/5">
          <CardBody className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-good" aria-hidden="true" />
            <p className="text-lg font-semibold text-foreground">{t("di.alert.postCreateTitle")}</p>
            {createdCase.alerts.length > 0 ? (
              <div className="space-y-2 text-left">
                <p className="text-sm font-medium text-foreground">{t("di.alert.postCreateFound")}</p>
                <ul className="space-y-1 text-sm text-muted">
                  {createdCase.alerts.map((alert) => (
                    <li key={alert.id}>• {alert.title}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted">{t("di.alert.postCreateNone")}</p>
            )}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button onClick={() => router.push(`/drug-intelligence/cases/${encodeURIComponent(createdCase.caseId)}`)}>
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                {t("di.alert.postCreateOpenCase")}
              </Button>
              {createdCase.alerts.length > 0 ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(createdCase.caseId)}`)}
                  >
                    <NetworkIcon className="h-4 w-4" aria-hidden="true" />
                    {t("di.alert.postCreateViewNetwork")}
                  </Button>
                  <Button variant="outline" onClick={() => router.push(`/drug-intelligence/alerts?currentCaseId=${encodeURIComponent(createdCase.caseId)}`)}>
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                    {t("di.alert.postCreateViewAlerts")}
                  </Button>
                </>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={t("di.create.title")}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/drug-intelligence/cases">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("common.cancel")}
            </Link>
          </Button>
        }
      />

      {/* Step navigation — horizontally scrollable on mobile so it never wraps awkwardly. */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5">
        {STEPS.map((step, idx) => (
          <button
            key={step.key}
            type="button"
            onClick={() => setStepIndex(idx)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              idx === stepIndex ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg hover:text-foreground"
            }`}
          >
            {idx + 1}. {t(step.labelKey)}
          </button>
        ))}
      </div>

      {submitError ? <div className="rounded-xl border border-critical/40 bg-critical/5 p-4 text-sm text-critical">{submitError}</div> : null}

      <div>
        {currentStep.key === "arrest" ? (
          <CreateCaseArrestStep draft={draft} onChange={patchDraft} organizationEngine={organizationEngine} />
        ) : null}
        {currentStep.key === "units" ? (
          <CreateCaseUnitsStep draft={draft} onChange={patchDraft} organizationEngine={organizationEngine} />
        ) : null}
        {currentStep.key === "persons" ? <CreateCasePersonsStep persons={draft.persons} onChange={(persons) => patchDraft({ persons })} /> : null}
        {currentStep.key === "seized" ? <CreateCaseSeizedStep items={draft.seizedItems} onChange={(seizedItems) => patchDraft({ seizedItems })} /> : null}
        {currentStep.key === "locations" ? <CreateCaseLocationsStep locations={draft.locations} onChange={(locations) => patchDraft({ locations })} /> : null}
        {currentStep.key === "review" ? <CreateCaseReviewStep draft={draft} errors={errors} onJumpToStep={jumpToStep} /> : null}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("di.create.back")}
        </Button>
        {stepIndex < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}>
            {t("di.create.next")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? t("di.create.saving") : t("di.create.saveCase")}
          </Button>
        )}
      </div>
    </div>
  );
}
