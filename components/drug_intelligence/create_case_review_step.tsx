/**
 * Create Case — Review Before Save step (Phase DI-1 Round 2, Section 14).
 */
"use client";

import { AlertTriangle, PhoneCall, Smartphone, Car } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { useDraftAlertSummary } from "@/components/drug_intelligence/use_draft_alert_summary";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
import { DRUG_CASE_OFFICER_ROLE_LABELS, isValidDrugCaseOfficerRole } from "@/lib/drug_intelligence/drug_case_officer_options";
import type { CreateCaseDraft, ValidationError } from "@/lib/drug_intelligence/create_case_draft";

/**
 * Section 14's Review step displays draft.persons[].role / draft.locations[].role
 * — plain `string` fields on the draft (the Select controls that write them are
 * bound to the enum options, but TypeScript can't narrow a form draft to a
 * literal union). Resolving the label via these two lookup maps (reusing the
 * SAME DRUG_CASE_PERSON_ROLE_LABELS / DRUG_LOCATION_ROLE_LABELS the Zod schema
 * and API validate against) avoids both an unsafe `t(`di.role.${role}`)`
 * dynamic-key call (TranslationKey must be a literal, so that string template
 * doesn't type-check) and any `as any`/`@ts-ignore` — falling back to the raw
 * value for any not-yet-recognized role rather than throwing.
 */
function personRoleLabel(role: string, language: "th" | "en"): string {
  if (!isValidDrugCasePersonRole(role)) return role;
  const meta = DRUG_CASE_PERSON_ROLE_LABELS[role];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

function locationRoleLabel(role: string, language: "th" | "en"): string {
  if (!isValidDrugLocationRole(role)) return role;
  const meta = DRUG_LOCATION_ROLE_LABELS[role];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

function officerRoleLabel(role: string, language: "th" | "en"): string {
  if (!isValidDrugCaseOfficerRole(role)) return role;
  const meta = DRUG_CASE_OFFICER_ROLE_LABELS[role];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

/** Section 10: the same derivation buildCreateCaseRequest() uses for the wire-level leadUnitText, kept in sync so the review summary never disagrees with what will actually be submitted. */
function leadUnitDisplayText(draft: CreateCaseDraft): string | null {
  if (draft.sameAsReportingUnit) {
    return draft.useManualUnit
      ? (draft.manualUnitText.trim() || null)
      : (draft.companyText || draft.battalionText || draft.regionText || draft.headquartersText || null);
  }
  return draft.useLeadManualUnit
    ? (draft.leadManualUnitText.trim() || null)
    : (draft.leadCompanyText || draft.leadBattalionText || draft.leadRegionText || draft.leadHeadquartersText || null);
}

export function CreateCaseReviewStep({
  draft,
  errors,
  onJumpToStep,
}: {
  draft: CreateCaseDraft;
  errors: ValidationError[];
  onJumpToStep: (step: string) => void;
}) {
  const { t, language } = useT();
  const { user } = useAuth();
  const alertSummary = useDraftAlertSummary(user?.id ?? null, draft.persons);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("di.review.title")}</h2>

      {alertSummary.totalCount > 0 ? (
        <Card className="border-warning/40 bg-warning-bg/40">
          <CardBody className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-warning">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {t("di.alert.reviewSummaryTitle")}
            </p>
            <p className="text-sm text-foreground">
              {t("di.alert.reviewSummaryCount")} {alertSummary.totalCount.toLocaleString("th-TH")} {t("di.alert.reviewSummaryItems")}
            </p>
            <ul className="space-y-1.5 text-sm text-foreground">
              {alertSummary.phoneMatches.length > 0 ? (
                <li className="flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                  {t("di.alert.typeRepeatPhone")}: {alertSummary.phoneMatches.length.toLocaleString("th-TH")}
                </li>
              ) : null}
              {alertSummary.deviceMatches.length > 0 ? (
                <li className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                  {t("di.alert.typeRepeatDevice")}: {alertSummary.deviceMatches.length.toLocaleString("th-TH")}
                </li>
              ) : null}
              {alertSummary.vehicleMatches.length > 0 ? (
                <li className="flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                  {t("di.alert.typeRepeatVehicle")}: {alertSummary.vehicleMatches.length.toLocaleString("th-TH")}
                </li>
              ) : null}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {errors.length > 0 ? (
        <Card className="border-critical/40 bg-critical/5">
          <CardBody>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-critical">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {t("di.review.validationErrors")}
            </p>
            <ul className="space-y-1">
              {errors.map((err, i) => (
                <li key={i}>
                  <button type="button" onClick={() => onJumpToStep(err.step)} className="text-sm text-critical underline hover:no-underline">
                    {err.message}
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.review.arrestInfo")}</p>
          <p className="text-sm text-foreground">
            <strong>{draft.caseNumber || "—"}</strong> — {draft.title || "—"}
          </p>
          <p className="text-sm text-muted">
            {draft.arrestDate || "—"} {draft.arrestTime ? `(${draft.arrestTime})` : ""} · {draft.province || "—"}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.review.unitsAndTeamTitle")}</p>
          <p className="text-sm text-foreground">
            <span className="text-muted">{t("di.review.reportingUnitLabel")}: </span>
            {draft.useManualUnit ? (draft.manualUnitText || "—") : (draft.companyText || draft.battalionText || draft.regionText || draft.headquartersText || "—")}
          </p>
          <p className="text-sm text-foreground">
            <span className="text-muted">{t("di.review.leadUnitLabel")}: </span>
            {leadUnitDisplayText(draft) || "—"}
          </p>
          <div>
            <p className="text-sm text-muted">{t("di.review.participatingUnitsLabel")}:</p>
            {draft.participatingUnits.length === 0 ? (
              <p className="text-sm text-foreground">{t("di.review.none")}</p>
            ) : (
              <ul className="space-y-0.5 text-sm text-foreground">
                {draft.participatingUnits.map((u) => (
                  <li key={u.key}>
                    - {u.useManualUnit ? (u.manualUnitText || "—") : (u.companyText || u.battalionText || u.regionText || u.headquartersText || "—")}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-sm text-muted">{t("di.review.arrestTeamLabel")}:</p>
            {draft.officers.length === 0 ? (
              <p className="text-sm text-foreground">{t("di.review.none")}</p>
            ) : (
              <ul className="space-y-0.5 text-sm text-foreground">
                {draft.officers.map((o) => (
                  <li key={o.key}>
                    - {o.officerId ? o.officerLabel : o.manualFullName || "—"} — {officerRoleLabel(o.role, language)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.review.personsSummary").replace("{count}", String(draft.persons.length))}</p>
          {draft.persons.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {draft.persons.map((p) => (
                <li key={p.key} className="text-foreground">
                  {p.existingPersonId ? p.existingPersonLabel : p.primaryFullName || "—"} — {personRoleLabel(p.role, language)}
                  {p.phones.length ? ` · ${t("di.create.stepPhones")} ${p.phones.length}` : ""}
                  {p.devices.length ? ` · ${t("di.create.stepDevices")} ${p.devices.length}` : ""}
                  {p.vehicles.length ? ` · ${t("di.create.stepVehicles")} ${p.vehicles.length}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.review.seizedSummary")}</p>
          {draft.seizedItems.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <p className="text-sm text-foreground">
              {draft.seizedItems
                .map((item) => {
                  const amount = item.measurementKind === "MASS" ? (item.weightKilograms ? `${item.weightKilograms} กก.` : "") : `${item.quantity || ""} ${item.unit || ""}`.trim();
                  return `${item.drugType} ${amount}`.trim();
                })
                .join(" • ")}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.review.locationsSummary")}</p>
          {draft.locations.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {draft.locations.map((loc) => (
                <li key={loc.key}>
                  {locationRoleLabel(loc.role, language)}: {loc.name || loc.addressText || loc.province || "—"}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
