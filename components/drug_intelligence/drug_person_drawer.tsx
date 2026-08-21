/**
 * DrugPersonDrawer (Phase DI-1 Round 2, Section 18).
 *
 * Opens on top of the Case Workspace (never navigates away — Section 18:
 * "เปิด Drawer / Side panel") showing name/aliases/masked identifiers/role in
 * this case/case count/phones/devices/vehicles. Reuses the shared Drawer
 * primitive. "Open Person Profile" is a clearly-labeled placeholder pointing
 * at DI-2 (never a dead button — Section 18's explicit instruction: clicking
 * it explains WHY it doesn't do anything yet, rather than doing nothing).
 */
"use client";

import { Drawer } from "@/components/ui/drawer";
import { Tooltip } from "@/components/ui/tooltip";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { useDrugPerson } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { DRUG_PERSON_IDENTIFIER_TYPE_LABELS, isValidDrugPersonIdentifierType } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";

function identifierTypeLabel(type: string, language: "th" | "en"): string {
  if (!isValidDrugPersonIdentifierType(type)) return type;
  const meta = DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

function roleLabel(role: string, language: "th" | "en"): string {
  if (!isValidDrugCasePersonRole(role)) return role;
  const meta = DRUG_CASE_PERSON_ROLE_LABELS[role];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

export function DrugPersonDrawer({
  personId,
  roleInCase,
  onClose,
}: {
  /** Empty string closes the drawer (matches the parent's "no selection" state). */
  personId: string;
  roleInCase?: string;
  onClose: () => void;
}) {
  const { t, language } = useT();
  const { user, can } = useAuth();
  const canViewFull = can("drug.edit");
  const detail = useDrugPerson(user?.id ?? null, personId);
  const open = personId.length > 0;

  return (
    <Drawer open={open} onClose={onClose} titleId="drug-person-drawer-title" title={t("di.person.drawer.title")}>
      {detail.isPending ? (
        <LoadingState rows={4} />
      ) : detail.isError ? (
        <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{detail.data.person.primaryFullName}</h3>
            {detail.data.person.nationality ? <p className="text-sm text-muted">{detail.data.person.nationality}</p> : null}
          </div>

          {roleInCase ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.drawer.roleInCase")}</p>
              <p className="mt-1 text-sm text-foreground">{roleLabel(roleInCase, language)}</p>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.casesInvolved")}</p>
            <p className="mt-1 text-sm text-foreground">{detail.data.caseCount}</p>
          </div>

          {detail.data.aliases.length > 1 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.aliases")}</p>
              <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                {detail.data.aliases.map((alias) => (
                  <li key={alias.id}>{alias.fullName}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.drawer.identifiers")}</p>
            {detail.data.identifiers.length === 0 ? (
              <p className="mt-1 text-sm text-muted">—</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-foreground">
                {detail.data.identifiers.map((identifier) => (
                  <li key={identifier.id} className="flex items-center justify-between gap-2">
                    <span className="text-muted">{identifierTypeLabel(identifier.type, language)}</span>
                    <span className="font-mono">{presentIdentifierValue(identifier.value, canViewFull)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.drawer.phones")}</p>
            {detail.data.phones.length === 0 ? (
              <p className="mt-1 text-sm text-muted">—</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                {detail.data.phones.map((phone) => (
                  <li key={`${phone.caseId}-${phone.phoneNumberId}`} className="font-mono">
                    {phone.phoneNumber ? presentPhoneNumber(phone.phoneNumber.normalizedNumber, canViewFull) : "—"}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.drawer.devices")}</p>
            {detail.data.devices.length === 0 ? (
              <p className="mt-1 text-sm text-muted">—</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                {detail.data.devices.map((d) => (
                  <li key={`${d.deviceId}`}>
                    {[d.device?.brand, d.device?.model].filter(Boolean).join(" ") || "—"}
                    {d.device?.imei1 ? <span className="ml-1 font-mono text-muted">{presentIdentifierValue(d.device.imei1, canViewFull)}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.drawer.vehicles")}</p>
            {detail.data.vehicles.length === 0 ? (
              <p className="mt-1 text-sm text-muted">—</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                {detail.data.vehicles.map((v) => (
                  <li key={v.vehicleId}>{v.vehicle?.registrationNumber || "—"}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border pt-4">
            {/* Section 18: never a dead button — disabled with a tooltip
                explaining exactly why (arrives in DI-2's full Person
                Profile), rather than a click that silently does nothing. */}
            <Tooltip label={t("di.person.viewProfileComingSoon")}>
              <button type="button" disabled className="text-sm text-muted cursor-not-allowed opacity-60">
                {t("di.person.viewProfile")}
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </Drawer>
  );
}
