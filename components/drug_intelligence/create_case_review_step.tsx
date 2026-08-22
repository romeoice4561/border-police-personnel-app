/**
 * Create Case — Review Before Save step (Phase DI-1 Round 2, Section 14).
 */
"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("di.review.title")}</h2>

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
