/**
 * DrugPersonDrawer (Phase DI-1 Round 2, Section 18; DI-2 Round B Section 20).
 *
 * Opens on top of the Case Workspace (never navigates away — Section 18:
 * "เปิด Drawer / Side panel") showing name/aliases/masked identifiers/role in
 * this case/case count/phones/devices/vehicles. Reuses the shared Drawer
 * primitive. "Open Person Profile" now navigates to the real DI-2 canonical
 * Person Intelligence Profile route — the Case Workspace never implements
 * its own full profile (Section 20's explicit instruction).
 */
"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { useDrugPerson } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { casePersonInvestigationHref } from "@/lib/drug_intelligence/drug_entity_routes";
import { presentDrawerPhones } from "@/lib/drug_intelligence/person_entity_provenance";
import { Button } from "@/components/ui/button";
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
  caseId,
  returnTo,
  onClose,
}: {
  /** Empty string closes the drawer (matches the parent's "no selection" state). */
  personId: string;
  roleInCase?: string;
  /** Validated later on the Person Profile; URL case-context only. */
  caseId?: string | null;
  returnTo?: string | null;
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
              <ul className="mt-1 space-y-2 text-sm text-foreground" data-testid="person-drawer-phones">
                {presentDrawerPhones(detail.data.phones, caseId ?? null).map((phone) => (
                  <li key={phone.phoneNumberId} className="min-w-0">
                    <p className="break-all font-mono">{phone.normalizedNumber ? presentPhoneNumber(phone.normalizedNumber, canViewFull) : "—"}</p>
                    <p className="text-xs text-muted">
                      {caseId && phone.inCurrentCase
                        ? phone.uniqueCaseCount > 1
                          ? t("di.profile.drawerSeenInCurrentAndTotal").replace("{count}", String(phone.uniqueCaseCount))
                          : t("di.profile.drawerSeenInCurrent")
                        : caseId
                          ? t("di.profile.drawerSeenInOther")
                          : t("di.profile.seenInNCases").replace("{count}", String(phone.uniqueCaseCount))}
                    </p>
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
            <Button asChild className="w-full" data-testid="open-person-profile">
              <Link href={casePersonInvestigationHref(personId, caseId, returnTo)}>
                {t("di.person.viewProfile")}
              </Link>
            </Button>
            <p className="mt-1.5 text-[11px] text-muted">{t("di.person.drawer.opensWithOrigin")}</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
