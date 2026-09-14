/**
 * Reusable Person Intelligence provenance presentation.
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
  buildPersonIntelligenceFacts,
  entityAppearsInMultipleCases,
  otherCaseLabel,
  splitRelatedByCurrentCase,
} from "@/lib/drug_intelligence/person_entity_provenance";
import type { DrugPersonProvenanceCaseRef, DrugPersonRelatedDevice, DrugPersonRelatedLocation, DrugPersonRelatedPhone, DrugPersonRelatedSim, DrugPersonRelatedVehicle } from "@/lib/drug_intelligence/drug_intelligence_client";
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

export function DrugPersonContextBanner({
  currentCaseId,
  currentCaseNumber,
  arrestDate,
  province,
}: {
  currentCaseId: string | null;
  currentCaseNumber: string | null;
  arrestDate?: string | Date | null;
  province?: string | null;
}) {
  const { t } = useT();
  if (currentCaseId) {
    return (
      <Card className="border-accent/40 bg-accent/5" data-testid="person-context-banner">
        <CardBody className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {t("di.profile.viewingFromCase").replace("{caseNumber}", currentCaseNumber || currentCaseId)}
          </p>
          {arrestDate || province ? (
            <p className="text-xs text-muted">
              {[arrestDate ? `${t("di.profile.caseArrestDate")} ${formatDiDate(String(arrestDate))}` : null, province].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <p className="text-xs text-muted">{t("di.profile.kpiAreAggregate")}</p>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card className="border-border bg-surface" data-testid="person-aggregate-banner">
      <CardBody className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t("di.profile.aggregateBanner")}</p>
        <p className="text-xs text-muted">{t("di.profile.aggregateDisclaimer")}</p>
        <p className="text-xs text-muted">{t("di.profile.kpiSystemWide")}</p>
      </CardBody>
    </Card>
  );
}

export function DrugPersonCaseSplitOverview({
  currentCaseId,
  currentCaseNumber,
  arrestDate,
  province,
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
  phones: DrugPersonRelatedPhone[];
  sims: DrugPersonRelatedSim[];
  devices: DrugPersonRelatedDevice[];
  vehicles: DrugPersonRelatedVehicle[];
  locations: DrugPersonRelatedLocation[];
  canViewFull: boolean;
}) {
  const { t } = useT();
  const phoneSplit = splitRelatedByCurrentCase(phones, currentCaseId);
  const simSplit = splitRelatedByCurrentCase(sims, currentCaseId);
  const deviceSplit = splitRelatedByCurrentCase(devices, currentCaseId);
  const vehicleSplit = splitRelatedByCurrentCase(vehicles, currentCaseId);
  const locationSplit = splitRelatedByCurrentCase(locations, currentCaseId);
  const hasOther =
    phoneSplit.inOtherCases.length +
      simSplit.inOtherCases.length +
      deviceSplit.inOtherCases.length +
      vehicleSplit.inOtherCases.length +
      locationSplit.inOtherCases.length >
    0;
  const hasUnscoped = deviceSplit.withoutCaseProvenance.length + vehicleSplit.withoutCaseProvenance.length > 0;

  return (
    <div className="space-y-4">
      <Card className="border-accent/30" data-testid="person-current-case-section">
        <CardBody className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("di.profile.fromCurrentCase")}</h2>
            <p className="mt-1 text-sm font-medium text-accent break-words">{currentCaseNumber || currentCaseId}</p>
            {arrestDate || province ? (
              <p className="mt-0.5 text-xs text-muted">
                {[arrestDate ? `${t("di.profile.caseArrestDate")} ${formatDiDate(String(arrestDate))}` : null, province].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <OverviewCategory
            label={t("di.profile.kpiPhones")}
            countLabel={phoneSplit.inCurrentCase.length > 0 ? t("di.profile.phonesCount").replace("{count}", String(phoneSplit.inCurrentCase.length)) : null}
            emptyLabel={t("di.profile.noneInThisCase")}
            items={phoneSplit.inCurrentCase.map((phone) => ({
              id: phone.phoneNumberId,
              href: `/drug-intelligence/phones/${encodeURIComponent(phone.phoneNumberId)}`,
              title: phone.phoneNumber ? presentPhoneNumber(phone.phoneNumber.normalizedNumber, canViewFull) : "—",
              cases: phone.cases,
            }))}
            currentCaseId={currentCaseId}
          />
          <OverviewCategory
            label={t("di.profile.kpiSims")}
            countLabel={simSplit.inCurrentCase.length > 0 ? t("di.profile.simsCount").replace("{count}", String(simSplit.inCurrentCase.length)) : null}
            emptyLabel={t("di.profile.noneInThisCase")}
            items={simSplit.inCurrentCase.map((row) => ({
              id: row.simId,
              href: row.sim ? `/drug-intelligence/sims/${encodeURIComponent(row.sim.id)}` : null,
              title: row.sim?.iccid ? presentIdentifierValue(row.sim.iccid, canViewFull) : "—",
              cases: row.cases,
            }))}
            currentCaseId={currentCaseId}
          />
          <OverviewCategory
            label={t("di.profile.kpiDevices")}
            countLabel={deviceSplit.inCurrentCase.length > 0 ? t("di.profile.devicesCount").replace("{count}", String(deviceSplit.inCurrentCase.length)) : null}
            emptyLabel={t("di.profile.noneInThisCase")}
            items={deviceSplit.inCurrentCase.map((row) => ({
              id: row.deviceId,
              href: `/drug-intelligence/devices/${encodeURIComponent(row.deviceId)}`,
              title: [row.device?.brand, row.device?.model].filter(Boolean).join(" ") || (row.device?.imei1 ? presentIdentifierValue(row.device.imei1, canViewFull) : "—"),
              cases: row.cases,
            }))}
            currentCaseId={currentCaseId}
          />
          <OverviewCategory
            label={t("di.profile.kpiVehicles")}
            countLabel={vehicleSplit.inCurrentCase.length > 0 ? t("di.profile.vehiclesCount").replace("{count}", String(vehicleSplit.inCurrentCase.length)) : null}
            emptyLabel={t("di.profile.noneInThisCase")}
            items={vehicleSplit.inCurrentCase.map((row) => ({
              id: row.vehicleId,
              href: `/drug-intelligence/vehicles/${encodeURIComponent(row.vehicleId)}`,
              title: row.vehicle?.registrationNumber || "—",
              cases: row.cases,
            }))}
            currentCaseId={currentCaseId}
          />
          <OverviewCategory
            label={t("di.profile.caseLocationsLabel")}
            countLabel={locationSplit.inCurrentCase.length > 0 ? t("di.profile.locationsCount").replace("{count}", String(locationSplit.inCurrentCase.length)) : null}
            emptyLabel={t("di.profile.noneInThisCase")}
            hint={t("di.profile.locationNotPersonFact")}
            items={locationSplit.inCurrentCase.map((row) => ({
              id: row.locationId,
              title: row.location?.name || row.location?.addressText || "—",
              cases: row.cases,
            }))}
            currentCaseId={currentCaseId}
          />
        </CardBody>
      </Card>

      <Card data-testid="person-other-cases-section">
        <CardBody className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("di.profile.fromOtherCasesAdditional")}</h2>
            <p className="mt-1 text-xs text-muted">
              {t("di.profile.otherCasesExplain").replace("{caseNumber}", currentCaseNumber || currentCaseId)}
            </p>
          </div>
          {!hasOther && !hasUnscoped ? (
            <p className="text-sm text-muted">{t("di.profile.noneFromOtherCases")}</p>
          ) : (
            <>
              <OverviewCategory
                label={t("di.profile.additionalPhones")}
                emptyLabel={null}
                items={phoneSplit.inOtherCases.map((phone) => ({
                  id: phone.phoneNumberId,
                  href: `/drug-intelligence/phones/${encodeURIComponent(phone.phoneNumberId)}`,
                  title: phone.phoneNumber ? presentPhoneNumber(phone.phoneNumber.normalizedNumber, canViewFull) : "—",
                  cases: phone.cases,
                }))}
                currentCaseId={currentCaseId}
              />
              <OverviewCategory
                label={t("di.profile.additionalSims")}
                emptyLabel={null}
                items={simSplit.inOtherCases.map((row) => ({
                  id: row.simId,
                  href: row.sim ? `/drug-intelligence/sims/${encodeURIComponent(row.sim.id)}` : null,
                  title: row.sim?.iccid ? presentIdentifierValue(row.sim.iccid, canViewFull) : "—",
                  cases: row.cases,
                }))}
                currentCaseId={currentCaseId}
              />
              <OverviewCategory
                label={t("di.profile.additionalDevices")}
                emptyLabel={null}
                items={deviceSplit.inOtherCases.map((row) => ({
                  id: row.deviceId,
                  href: `/drug-intelligence/devices/${encodeURIComponent(row.deviceId)}`,
                  title: [row.device?.brand, row.device?.model].filter(Boolean).join(" ") || (row.device?.imei1 ? presentIdentifierValue(row.device.imei1, canViewFull) : "—"),
                  cases: row.cases,
                }))}
                currentCaseId={currentCaseId}
              />
              <OverviewCategory
                label={t("di.profile.additionalVehicles")}
                emptyLabel={null}
                items={vehicleSplit.inOtherCases.map((row) => ({
                  id: row.vehicleId,
                  href: `/drug-intelligence/vehicles/${encodeURIComponent(row.vehicleId)}`,
                  title: row.vehicle?.registrationNumber || "—",
                  cases: row.cases,
                }))}
                currentCaseId={currentCaseId}
              />
              <OverviewCategory
                label={t("di.profile.caseLocationsLabel")}
                emptyLabel={null}
                hint={t("di.profile.locationNotPersonFact")}
                items={locationSplit.inOtherCases.map((row) => ({
                  id: row.locationId,
                  title: row.location?.name || row.location?.addressText || "—",
                  cases: row.cases,
                }))}
                currentCaseId={currentCaseId}
              />
              {hasUnscoped ? (
                <div className="space-y-1" data-testid="person-provenance-unscoped-section">
                  <p className="text-xs font-semibold text-muted">{t("di.profile.relatedWithoutCase")}</p>
                  <p className="text-xs text-muted">{t("di.profile.relatedWithoutCaseHint")}</p>
                  {deviceSplit.withoutCaseProvenance.map((row) => (
                    <p key={row.deviceId} className="break-all text-sm text-foreground">
                      {[row.device?.brand, row.device?.model].filter(Boolean).join(" ") || row.device?.imei1 || "—"}
                    </p>
                  ))}
                  {vehicleSplit.withoutCaseProvenance.map((row) => (
                    <p key={row.vehicleId} className="break-all text-sm text-foreground">
                      {row.vehicle?.registrationNumber || "—"}
                    </p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function OverviewCategory({
  label,
  countLabel,
  emptyLabel,
  hint,
  items,
  currentCaseId,
}: {
  label: string;
  countLabel?: string | null;
  emptyLabel: string | null;
  hint?: string;
  items: Array<{ id: string; href?: string | null; title: string; cases: DrugPersonProvenanceCaseRef[] }>;
  currentCaseId: string;
}) {
  const { t } = useT();
  if (items.length === 0) {
    if (!emptyLabel) return null;
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-sm text-muted">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {countLabel ? <p className="mt-0.5 text-sm text-foreground">{countLabel}</p> : null}
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <ul className="mt-1 space-y-1">
        {items.map((item) => {
          const multi = entityAppearsInMultipleCases(item);
          const otherLabel = otherCaseLabel(item.cases, currentCaseId);
          const inCurrent = item.cases.some((row) => row.caseId === currentCaseId);
          return (
            <li key={item.id} className="min-w-0">
              {item.href ? (
                <Link href={item.href} className="break-all font-mono text-sm text-accent hover:underline">
                  {item.title}
                </Link>
              ) : (
                <span className="break-all font-mono text-sm text-foreground">{item.title}</span>
              )}
              <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                {inCurrent ? <Badge tone="accent">{t("di.profile.seenInCurrentCase")}</Badge> : otherLabel ? <Badge tone="neutral">{t("di.profile.seenFromNamedCase").replace("{caseNumber}", otherLabel)}</Badge> : <Badge tone="neutral">{t("di.profile.seenInOtherCase")}</Badge>}
                {multi ? <Badge tone="neutral">{t("di.profile.seenInMultipleCases").replace("{count}", String(item.cases.length))}</Badge> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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
