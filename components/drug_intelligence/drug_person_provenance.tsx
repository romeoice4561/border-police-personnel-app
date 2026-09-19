/**
 * Reusable Person Intelligence provenance + investigation-story presentation.
 *
 * Case lists come from factual DrugCase* associations already loaded on the
 * profile — this module does not fetch or infer new links.
 */
"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import { drugNetworkFocusPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { withReturnTo } from "@/lib/ui/return_context";
import {
  buildInvestigationConclusionModel,
  partitionEntityCasesByOrigin,
  type StoryEntityForConclusion,
  type StoryEntityKind,
} from "@/lib/drug_intelligence/drug_person_investigation_origin";
import { preferHumanCaseLabel } from "@/lib/drug_intelligence/drug_person_relationship_explain";
import {
  buildPersonIntelligenceFacts,
  entityAppearsInMultipleCases,
  otherCaseLabel,
  splitRelatedByCurrentCase,
} from "@/lib/drug_intelligence/person_entity_provenance";
import type {
  DrugPersonProvenanceCaseRef,
  DrugPersonRelatedDevice,
  DrugPersonRelatedLocation,
  DrugPersonRelatedPhone,
  DrugPersonRelatedSim,
  DrugPersonRelatedVehicle,
} from "@/lib/drug_intelligence/drug_intelligence_client";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";

export interface ProvenanceListItem {
  id: string;
  href?: string | null;
  title: ReactNode;
  subtitle?: ReactNode;
  firstSeenAt?: string | Date | null;
  lastSeenAt?: string | Date | null;
  cases: DrugPersonProvenanceCaseRef[];
}

/** Compact investigation-origin strip — case / person / role / date only (no entity dump). */
export function DrugPersonContextBanner({
  currentCaseId,
  currentCaseNumber,
  arrestDate,
  province,
  personName,
  personRoleLabel,
}: {
  currentCaseId: string | null;
  currentCaseNumber: string | null;
  arrestDate?: string | Date | null;
  province?: string | null;
  personName?: string | null;
  personRoleLabel?: string | null;
  /** @deprecated entity counts belong in the Overview investigation story */
  sourceCounts?: {
    phones: number;
    sims: number;
    devices: number;
    vehicles: number;
    locations: number;
  } | null;
}) {
  const { t } = useT();
  if (currentCaseId) {
    const meta = [arrestDate ? formatDiDate(String(arrestDate)) : null, province].filter(Boolean).join(" · ");
    return (
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2"
        data-testid="person-investigation-origin"
      >
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
          <span aria-hidden="true">📁</span>
          {t("di.profile.startedFromCase").replace("{case}", currentCaseNumber || currentCaseId)}
        </span>
        {personName ? (
          <span className="inline-flex items-center gap-1 text-sm text-foreground">
            <span aria-hidden="true">👤</span>
            <span className="font-medium">{personName}</span>
          </span>
        ) : null}
        {personRoleLabel ? (
          <span className="inline-flex rounded-full border border-critical/30 bg-critical/10 px-2 py-0.5 text-[11px] font-medium text-critical">
            {personRoleLabel}
          </span>
        ) : null}
        {meta ? <span className="text-xs text-muted">{meta}</span> : null}
      </div>
    );
  }
  return (
    <div
      className="rounded-xl border border-border bg-neutral-bg/40 px-3 py-2"
      data-testid="person-aggregate-banner"
    >
      <p className="text-sm font-semibold text-foreground">{t("di.profile.aggregateNoOriginNotice")}</p>
    </div>
  );
}

type StoryEntity = StoryEntityForConclusion & { icon: string };

const KIND_ICON: Record<StoryEntityKind, string> = {
  PHONE: "📞",
  SIM: "💳",
  DEVICE: "📱",
  VEHICLE: "🚗",
  LOCATION: "📍",
};

/** Source-case entities for investigation story + post-scan conclusion (same provenance). */
export function buildSourceCaseStoryEntities(args: {
  currentCaseId: string;
  phones: DrugPersonRelatedPhone[];
  sims: DrugPersonRelatedSim[];
  devices: DrugPersonRelatedDevice[];
  vehicles: DrugPersonRelatedVehicle[];
  locations: DrugPersonRelatedLocation[];
  canViewFull: boolean;
}): StoryEntity[] {
  const phoneSplit = splitRelatedByCurrentCase(args.phones, args.currentCaseId);
  const simSplit = splitRelatedByCurrentCase(args.sims, args.currentCaseId);
  const deviceSplit = splitRelatedByCurrentCase(args.devices, args.currentCaseId);
  const vehicleSplit = splitRelatedByCurrentCase(args.vehicles, args.currentCaseId);
  const locationSplit = splitRelatedByCurrentCase(args.locations, args.currentCaseId);

  return [
    ...phoneSplit.inCurrentCase.map((phone) => ({
      id: phone.phoneNumberId,
      kind: "PHONE" as const,
      icon: KIND_ICON.PHONE,
      label: phone.phoneNumber ? presentPhoneNumber(phone.phoneNumber.normalizedNumber, args.canViewFull) : "—",
      href: `/drug-intelligence/phones/${encodeURIComponent(phone.phoneNumberId)}`,
      cases: phone.cases,
    })),
    ...simSplit.inCurrentCase.map((row) => ({
      id: row.simId,
      kind: "SIM" as const,
      icon: KIND_ICON.SIM,
      label: row.sim?.iccid ? `SIM ${presentIdentifierValue(row.sim.iccid, args.canViewFull)}` : "SIM",
      href: row.sim ? `/drug-intelligence/sims/${encodeURIComponent(row.sim.id)}` : null,
      cases: row.cases,
    })),
    ...deviceSplit.inCurrentCase.map((row) => ({
      id: row.deviceId,
      kind: "DEVICE" as const,
      icon: KIND_ICON.DEVICE,
      label:
        [row.device?.brand, row.device?.model].filter(Boolean).join(" ") ||
        (row.device?.imei1 ? presentIdentifierValue(row.device.imei1, args.canViewFull) : "—"),
      href: `/drug-intelligence/devices/${encodeURIComponent(row.deviceId)}`,
      cases: row.cases,
    })),
    ...vehicleSplit.inCurrentCase.map((row) => ({
      id: row.vehicleId,
      kind: "VEHICLE" as const,
      icon: KIND_ICON.VEHICLE,
      label: row.vehicle?.registrationNumber || "—",
      href: `/drug-intelligence/vehicles/${encodeURIComponent(row.vehicleId)}`,
      cases: row.cases,
    })),
    ...locationSplit.inCurrentCase.map((row) => ({
      id: row.locationId,
      kind: "LOCATION" as const,
      icon: KIND_ICON.LOCATION,
      label: row.location?.name || row.location?.addressText || "—",
      href: null,
      cases: row.cases,
    })),
  ];
}

function entityNounKey(kind: StoryEntityKind): "di.profile.conclusionNounPhone" | "di.profile.conclusionNounSim" | "di.profile.conclusionNounDevice" | "di.profile.conclusionNounVehicle" | "di.profile.conclusionNounLocation" {
  switch (kind) {
    case "PHONE":
      return "di.profile.conclusionNounPhone";
    case "SIM":
      return "di.profile.conclusionNounSim";
    case "DEVICE":
      return "di.profile.conclusionNounDevice";
    case "VEHICLE":
      return "di.profile.conclusionNounVehicle";
    case "LOCATION":
      return "di.profile.conclusionNounLocation";
  }
}

/**
 * One-line human conclusion under post-scan KPIs — derived from provenance,
 * never hardcoded. Does not duplicate discovery cards.
 */
export function DrugPersonInvestigationConclusion({
  currentCaseId,
  currentCaseNumber,
  phones,
  sims,
  devices,
  vehicles,
  locations,
  canViewFull,
}: {
  currentCaseId: string;
  currentCaseNumber: string | null;
  phones: DrugPersonRelatedPhone[];
  sims: DrugPersonRelatedSim[];
  devices: DrugPersonRelatedDevice[];
  vehicles: DrugPersonRelatedVehicle[];
  locations: DrugPersonRelatedLocation[];
  canViewFull: boolean;
}) {
  const { t } = useT();
  const sourceLabel = currentCaseNumber || preferHumanCaseLabel(null, currentCaseId);
  const sourceEntities = buildSourceCaseStoryEntities({
    currentCaseId,
    phones,
    sims,
    devices,
    vehicles,
    locations,
    canViewFull,
  });
  const model = buildInvestigationConclusionModel(sourceEntities, currentCaseId);
  if (!model) return null;

  if (model.status === "no_discoveries") {
    return (
      <p
        className="text-sm leading-snug text-foreground"
        data-testid="person-investigation-conclusion"
        data-conclusion="none"
      >
        <span className="font-semibold">{t("di.profile.conclusionLabel")}</span>{" "}
        {t("di.profile.conclusionNoRepeat")}
      </p>
    );
  }

  const { primary, discoveryEntityCount } = model;
  const entityNode = primary.href ? (
    <Link href={primary.href} className="font-semibold text-accent hover:underline">
      {primary.label}
    </Link>
  ) : (
    <span className="font-semibold text-foreground">{primary.label}</span>
  );

  return (
    <div className="space-y-1.5" data-testid="person-investigation-conclusion" data-conclusion="has">
      <p className="text-sm leading-snug text-foreground">
        <span className="font-semibold">{t("di.profile.conclusionLabel")}</span>{" "}
        {t("di.profile.conclusionStartedFrom")}{" "}
        <span className="font-semibold text-accent" data-testid="conclusion-source-case">
          {sourceLabel}
        </span>{" "}
        {t("di.profile.conclusionFoundThat")}
        {t(entityNounKey(primary.kind))}{" "}
        <span data-testid="conclusion-entity">{entityNode}</span>{" "}
        {t("di.profile.conclusionLinkedMore")}{" "}
        <span className="font-semibold text-accent" data-testid="conclusion-count">
          {primary.discoveredCount}
        </span>{" "}
        {t("di.profile.conclusionCasesIncluding")}{" "}
        <span className="inline-flex flex-wrap items-center gap-1 align-middle" data-testid="conclusion-case-chips">
          {primary.discoveredCases.map((c) => (
            <Link
              key={c.caseId}
              href={`/drug-intelligence/cases/${encodeURIComponent(c.caseId)}`}
              className="inline-flex rounded-lg border border-border bg-surface px-1.5 py-0.5 text-xs font-medium text-accent hover:underline"
            >
              📁 {c.label}
            </Link>
          ))}
        </span>
      </p>
      {discoveryEntityCount > 1 ? (
        <button
          type="button"
          className="text-xs font-medium text-accent hover:underline"
          data-testid="conclusion-view-all-discoveries"
          onClick={() => {
            document.getElementById("person-other-cases-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          {t("di.profile.conclusionViewAllLinks")}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Overview investigation story:
 * source-case entity chips → database-check transition → per-entity discoveries.
 */
export function DrugPersonInvestigationStory({
  currentCaseId,
  currentCaseNumber,
  arrestDate,
  province,
  personName,
  personRoleLabel,
  phones,
  sims,
  devices,
  vehicles,
  locations,
  canViewFull,
}: {
  currentCaseId: string;
  currentCaseNumber: string | null;
  arrestDate?: string | Date | null;
  province?: string | null;
  personName: string;
  personRoleLabel: string | null;
  phones: DrugPersonRelatedPhone[];
  sims: DrugPersonRelatedSim[];
  devices: DrugPersonRelatedDevice[];
  vehicles: DrugPersonRelatedVehicle[];
  locations: DrugPersonRelatedLocation[];
  canViewFull: boolean;
}) {
  const { t } = useT();
  const sourceLabel = currentCaseNumber || preferHumanCaseLabel(null, currentCaseId);

  const locationSplit = splitRelatedByCurrentCase(locations, currentCaseId);
  const sourceEntities = buildSourceCaseStoryEntities({
    currentCaseId,
    phones,
    sims,
    devices,
    vehicles,
    locations,
    canViewFull,
  });

  return (
    <div className="space-y-4" data-testid="person-investigation-story">
      <Card className="border-accent/40 bg-accent/5" data-testid="person-current-case-section">
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">📁 {t("di.profile.sourceCaseLabel")}</p>
              <p className="text-lg font-semibold text-accent">{sourceLabel}</p>
              {arrestDate || province ? (
                <p className="mt-0.5 text-xs text-muted">
                  {[arrestDate ? formatDiDate(String(arrestDate)) : null, province].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">👤 {t("di.profile.personInThisCase")}</p>
              <p className="text-sm font-semibold text-foreground">{personName}</p>
              {personRoleLabel ? (
                <p className="mt-1 inline-flex rounded-full border border-critical/30 bg-critical/10 px-2 py-0.5 text-[11px] font-medium text-critical">
                  {personRoleLabel}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">{t("di.profile.foundInThisCase")}</p>
            {sourceEntities.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                <EntityChip icon="📍" label={t("di.profile.noLocationInSource")} muted />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" data-testid="person-source-entity-chips">
                {sourceEntities.map((entity) => (
                  <EntityChip key={`${entity.kind}-${entity.id}`} icon={entity.icon} label={entity.label} href={entity.href} />
                ))}
                {locationSplit.inCurrentCase.length === 0 ? (
                  <EntityChip icon="📍" label={t("di.profile.noLocationInSource")} muted />
                ) : null}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <div
        className="rounded-xl border border-dashed border-accent/40 bg-neutral-bg/50 px-3 py-2 text-center"
        data-testid="person-origin-scan-bridge"
      >
        <p className="text-base leading-none text-accent">↓</p>
        <p className="mt-1 text-xs font-semibold text-foreground sm:text-sm">
          {t("di.profile.scanTransitionLine1")} {t("di.profile.scanTransitionLine2")}
        </p>
      </div>

      <Card data-testid="person-other-cases-section" id="person-other-cases-section">
        <CardBody className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">{t("di.profile.additionalLinksFoundHeading")}</h2>
          {sourceEntities.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.noneFromOtherCases")}</p>
          ) : (
            (() => {
              const withMatches: Array<{ entity: StoryEntity; discoveredLabels: string[]; discoveredCount: number }> = [];
              const noMatches: StoryEntity[] = [];
              for (const entity of sourceEntities) {
                const part = partitionEntityCasesByOrigin(entity.cases, currentCaseId);
                if (part.discoveredCount > 0) {
                  withMatches.push({
                    entity,
                    discoveredLabels: part.discoveredLabels,
                    discoveredCount: part.discoveredCount,
                  });
                } else {
                  noMatches.push(entity);
                }
              }
              return (
                <div className="space-y-3" data-testid="person-discovery-list">
                  {withMatches.length === 0 ? (
                    <p className="text-sm text-muted">{t("di.profile.noneFromOtherCases")}</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {withMatches.map(({ entity, discoveredLabels, discoveredCount }) => (
                        <li
                          key={`disc-${entity.kind}-${entity.id}`}
                          className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2"
                          data-testid="person-discovery-item"
                          data-has-match="true"
                        >
                          <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                            <span aria-hidden="true">{entity.icon}</span>
                            {entity.href ? (
                              <Link href={entity.href} className="text-accent hover:underline">
                                {entity.label}
                              </Link>
                            ) : (
                              <span>{entity.label}</span>
                            )}
                          </p>
                          <p className="mt-1 text-xs text-foreground" data-testid="person-discovery-sentence">
                            {discoveryRepeatSentence(entity.kind, discoveredCount, t)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {discoveredLabels.map((label) => (
                              <span
                                key={label}
                                className="inline-flex rounded-lg border border-border bg-surface px-2 py-0.5 text-xs font-medium text-foreground"
                              >
                                📁 {label}
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {noMatches.length > 0 ? (
                    <div
                      className="rounded-xl border border-border bg-neutral-bg/30 px-3 py-2"
                      data-testid="person-no-repeat-compact"
                    >
                      <p className="text-xs font-medium text-good">
                        {t("di.profile.noRepeatCompact").replace("{count}", String(noMatches.length))}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {noMatches.map((entity) => (
                          <EntityChip
                            key={`nr-${entity.kind}-${entity.id}`}
                            icon={entity.icon}
                            label={entity.label}
                            href={entity.href}
                            muted
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** @deprecated Prefer DrugPersonInvestigationStory — kept for any residual callers. */
export function DrugPersonCaseSplitOverview(
  props: Parameters<typeof DrugPersonInvestigationStory>[0],
) {
  return <DrugPersonInvestigationStory {...props} />;
}

function discoveryRepeatSentence(
  kind: StoryEntity["kind"],
  count: number,
  t: (key: import("@/lib/i18n/dictionary").TranslationKey) => string,
): string {
  const n = String(count);
  switch (kind) {
    case "PHONE":
      return t("di.profile.discoveryPhoneRepeat").replace("{count}", n);
    case "SIM":
      return t("di.profile.discoverySimRepeat").replace("{count}", n);
    case "DEVICE":
      return t("di.profile.discoveryDeviceRepeat").replace("{count}", n);
    case "VEHICLE":
      return t("di.profile.discoveryVehicleRepeat").replace("{count}", n);
    case "LOCATION":
      return t("di.profile.discoveryLocationRepeat").replace("{count}", n);
  }
}

function EntityChip({
  icon,
  label,
  href,
  muted,
}: {
  icon: string;
  label: string;
  href?: string | null;
  muted?: boolean;
}) {
  const className = muted
    ? "inline-flex max-w-full items-center gap-1.5 rounded-xl border border-dashed border-border bg-neutral-bg/50 px-2.5 py-1.5 text-xs text-muted"
    : "inline-flex max-w-full items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm";
  const content = (
    <>
      <span aria-hidden="true">{icon}</span>
      <span className="truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${className} hover:border-accent/50 hover:text-accent`} data-testid="source-entity-chip">
        {content}
      </Link>
    );
  }
  return (
    <span className={className} data-testid="source-entity-chip">
      {content}
    </span>
  );
}

export function DrugPersonIntelligenceSummary({
  personId,
  returnTo,
  caseCount,
  currentCaseId,
  phones,
  sims,
  devices,
  vehicles,
  canViewFull,
}: {
  personId: string;
  returnTo: string | null;
  caseCount: number;
  currentCaseId: string | null;
  phones: DrugPersonRelatedPhone[];
  sims: DrugPersonRelatedSim[];
  devices: DrugPersonRelatedDevice[];
  vehicles: DrugPersonRelatedVehicle[];
  canViewFull: boolean;
}) {
  const { t } = useT();
  const facts = buildPersonIntelligenceFacts({ caseCount, currentCaseId, phones, sims, devices, vehicles });
  if (facts.length === 0) return null;
  const phoneById = new Map(phones.map((phone) => [phone.phoneNumberId, phone]));

  return (
    <Card data-testid="person-intelligence-summary">
      <CardBody className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("di.profile.intelligenceTitle")}</h2>
        <ul className="space-y-2 text-sm text-foreground">
          {facts.map((fact, index) => {
            if (fact.kind === "PERSON_IN_N_CASES") {
              return <li key={index}>{t("di.profile.factPersonInCases").replace("{count}", String(fact.caseCount))}</li>;
            }
            if (fact.kind === "PHONE_MULTI_CASE") {
              const phone = phoneById.get(fact.phoneNumberId);
              const displayed = phone?.phoneNumber ? presentPhoneNumber(phone.phoneNumber.normalizedNumber, canViewFull) : fact.phoneNumberId;
              return (
                <li key={index}>
                  {t("di.profile.factPhoneMulti").replace("{phone}", displayed).replace("{count}", String(fact.caseCount))}
                  {phone ? (
                    <span className="mt-1 block">
                      <ProvenanceCaseExpand cases={phone.cases} />
                    </span>
                  ) : null}
                </li>
              );
            }
            if (fact.kind === "ADDITIONAL_PHONES") {
              return <li key={index}>{t("di.profile.factAdditionalPhones").replace("{count}", String(fact.count))}</li>;
            }
            if (fact.kind === "ADDITIONAL_SIMS") {
              return <li key={index}>{t("di.profile.factAdditionalSims").replace("{count}", String(fact.count))}</li>;
            }
            if (fact.kind === "ADDITIONAL_DEVICES") {
              return <li key={index}>{t("di.profile.factAdditionalDevices").replace("{count}", String(fact.count))}</li>;
            }
            return <li key={index}>{t("di.profile.factAdditionalVehicles").replace("{count}", String(fact.count))}</li>;
          })}
        </ul>
        <Link href={withReturnTo(drugNetworkFocusPath("PERSON", personId), returnTo)} className="inline-block text-sm font-medium text-accent hover:underline">
          {t("di.profile.openAllLinks")}
        </Link>
      </CardBody>
    </Card>
  );
}

function ProvenanceCaseExpand({ cases }: { cases: DrugPersonProvenanceCaseRef[] }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? cases : cases.slice(0, 0);
  return (
    <>
      <button type="button" onClick={() => setExpanded((value) => !value)} className="text-xs font-medium text-accent hover:underline">
        {expanded ? t("di.profile.hideCases") : t("di.profile.viewAllCases")}
      </button>
      {expanded ? (
        <ul className="mt-1 space-y-0.5">
          {visible.map((row) => (
            <li key={row.caseId}>
              <Link href={`/drug-intelligence/cases/${encodeURIComponent(row.caseId)}`} className="break-words text-xs text-accent hover:underline">
                {row.caseNumber || row.caseId}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export function DrugPersonProvenanceSections({
  currentCaseId,
  currentCaseNumber,
  items,
  emptyLabel,
  showObservedDates = false,
  headingCurrent,
  headingOther,
}: {
  currentCaseId: string | null;
  currentCaseNumber?: string | null;
  items: ProvenanceListItem[];
  emptyLabel: string;
  showObservedDates?: boolean;
  headingCurrent?: string;
  headingOther?: string;
}) {
  const { t } = useT();
  if (items.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  if (!currentCaseId) {
    return (
      <div className="space-y-3" data-testid="person-provenance-aggregate">
        <DrugPersonProvenanceList items={items} currentCaseId={null} showObservedDates={showObservedDates} />
      </div>
    );
  }

  const split = splitRelatedByCurrentCase(items, currentCaseId);
  return (
    <div className="space-y-5">
      <section className="space-y-2" data-testid="person-provenance-current-section">
        <h3 className="text-sm font-semibold text-foreground">{headingCurrent ?? t("di.profile.fromCurrentCase")}</h3>
        {currentCaseNumber ? <p className="text-xs font-medium text-accent break-words">{currentCaseNumber}</p> : null}
        {split.inCurrentCase.length === 0 ? (
          <p className="text-sm text-muted">{t("di.profile.noneInThisCase")}</p>
        ) : (
          <DrugPersonProvenanceList items={split.inCurrentCase} currentCaseId={currentCaseId} showObservedDates={showObservedDates} />
        )}
      </section>
      <section className="space-y-2" data-testid="person-provenance-other-section">
        <h3 className="text-sm font-semibold text-foreground">{headingOther ?? t("di.profile.fromOtherCasesAdditional")}</h3>
        {split.inOtherCases.length === 0 ? (
          <p className="text-sm text-muted">{t("di.profile.noneFromOtherCases")}</p>
        ) : (
          <DrugPersonProvenanceList items={split.inOtherCases} currentCaseId={currentCaseId} showObservedDates={showObservedDates} />
        )}
      </section>
      {split.withoutCaseProvenance.length > 0 ? (
        <section className="space-y-2" data-testid="person-provenance-unscoped-section">
          <h3 className="text-sm font-semibold text-muted">{t("di.profile.relatedWithoutCase")}</h3>
          <p className="text-xs text-muted">{t("di.profile.relatedWithoutCaseHint")}</p>
          <DrugPersonProvenanceList items={split.withoutCaseProvenance} currentCaseId={currentCaseId} showObservedDates={showObservedDates} />
        </section>
      ) : null}
    </div>
  );
}

export function DrugPersonProvenanceList({
  items,
  currentCaseId,
  showObservedDates,
}: {
  items: ProvenanceListItem[];
  currentCaseId: string | null;
  showObservedDates: boolean;
}) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <DrugPersonProvenanceItem item={item} currentCaseId={currentCaseId} showObservedDates={showObservedDates} />
        </li>
      ))}
    </ul>
  );
}

function DrugPersonProvenanceItem({
  item,
  currentCaseId,
  showObservedDates,
}: {
  item: ProvenanceListItem;
  currentCaseId: string | null;
  showObservedDates: boolean;
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const caseCount = item.cases.length;
  const inCurrent = Boolean(currentCaseId && item.cases.some((row) => row.caseId === currentCaseId));
  const multiCase = entityAppearsInMultipleCases(item);
  const compact = caseCount > 1 && !expanded;
  const visibleCases = compact ? [] : item.cases;
  const namedOther = !inCurrent ? otherCaseLabel(item.cases, currentCaseId) : null;

  const title = item.href ? (
    <Link href={item.href} className="font-medium text-accent hover:underline break-all">
      {item.title}
    </Link>
  ) : (
    <span className="font-medium text-foreground break-all">{item.title}</span>
  );

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {title}
            {item.subtitle ? <div className="text-sm text-muted">{item.subtitle}</div> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {inCurrent ? <Badge tone="accent">{t("di.profile.seenInCurrentCase")}</Badge> : null}
            {namedOther ? <Badge tone="neutral">{t("di.profile.seenFromNamedCase").replace("{caseNumber}", namedOther)}</Badge> : currentCaseId && caseCount > 0 && !inCurrent && !namedOther ? <Badge tone="neutral">{t("di.profile.seenInOtherCase")}</Badge> : null}
            {multiCase ? <Badge tone="neutral">{t("di.profile.seenInMultipleCases").replace("{count}", String(caseCount))}</Badge> : null}
          </div>
        </div>
        {showObservedDates && (item.firstSeenAt || item.lastSeenAt) ? (
          <p className="text-xs text-muted">
            {item.firstSeenAt ? `${t("di.profile.firstSeen")}: ${formatDiDate(String(item.firstSeenAt))}` : null}
            {item.firstSeenAt && item.lastSeenAt ? " · " : null}
            {item.lastSeenAt ? `${t("di.profile.lastSeen")}: ${formatDiDate(String(item.lastSeenAt))}` : null}
          </p>
        ) : null}
        {caseCount > 1 ? (
          <div className="space-y-1">
            <button type="button" onClick={() => setExpanded((value) => !value)} className="text-xs font-medium text-accent hover:underline">
              {expanded ? t("di.profile.hideCases") : t("di.profile.viewAllCases")}
            </button>
            {expanded ? (
              <ul className="space-y-1">
                {visibleCases.map((row) => (
                  <li key={row.caseId} className="text-sm">
                    <Link href={`/drug-intelligence/cases/${encodeURIComponent(row.caseId)}`} className="break-words text-accent hover:underline">
                      {row.caseNumber || row.caseId}
                    </Link>
                    {row.arrestDate ? (
                      <span className="ml-2 text-xs text-muted">
                        {t("di.profile.caseArrestDate")}: {formatDiDate(String(row.arrestDate))}
                      </span>
                    ) : null}
                    {showObservedDates && (row.firstSeenAt || row.lastSeenAt) ? (
                      <span className="ml-2 text-xs text-muted">
                        {row.firstSeenAt ? `${t("di.profile.firstSeen")}: ${formatDiDate(String(row.firstSeenAt))}` : null}
                        {row.firstSeenAt && row.lastSeenAt ? " · " : null}
                        {row.lastSeenAt ? `${t("di.profile.lastSeen")}: ${formatDiDate(String(row.lastSeenAt))}` : null}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : caseCount === 1 && item.cases[0] ? (
          <Link href={`/drug-intelligence/cases/${encodeURIComponent(item.cases[0].caseId)}`} className="block break-words text-xs text-accent hover:underline">
            {item.cases[0].caseNumber || item.cases[0].caseId}
          </Link>
        ) : null}
      </CardBody>
    </Card>
  );
}
