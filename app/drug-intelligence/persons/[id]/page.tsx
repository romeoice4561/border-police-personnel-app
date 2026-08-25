/**
 * Person Intelligence Profile (Phase DI-2 Round B — Sections 4-9, 21-26).
 *
 * The canonical Person Profile workspace — header + clickable KPI row + tab
 * navigation, mirroring the Case Workspace's exact structure (Section 4:
 * "ไม่ใช่ฟอร์มข้อมูลบุคคลธรรมดา"). A MERGED person renders a banner + link to
 * the survivor instead of an active profile (Section 5) — never silently
 * hidden or 404'd (Section 29).
 */
"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Phone, Smartphone, Car, MapPin, AlertTriangle, Plus, Network, History } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DrugKpiTile } from "@/components/drug_intelligence/drug_kpi_tile";
import { DrugEntityAlertSummary } from "@/components/drug_intelligence/drug_entity_alert_summary";
import { DrugMatchConfidenceBadge } from "@/components/drug_intelligence/drug_match_confidence_badge";
import { DrugMatchSignalsList } from "@/components/drug_intelligence/drug_match_signals_list";
import { Field, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  useDrugPersonProfile,
  useAddDrugPersonAlias,
  useAddDrugPersonIdentifier,
  useDrugPotentialDuplicates,
} from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import {
  DRUG_CASE_PERSON_ROLE_LABELS,
  isValidDrugCasePersonRole,
  DRUG_PERSON_IDENTIFIER_TYPES,
  DRUG_PERSON_IDENTIFIER_TYPE_LABELS,
  isValidDrugPersonIdentifierType,
  DRUG_PERSON_SEX_LABELS,
  isValidDrugPersonSex,
  DRUG_NETWORK_ROLE_LABELS,
  isValidDrugNetworkRole,
  DRUG_NETWORK_ROLE_SOURCE_LABELS,
  isValidDrugNetworkRoleSource,
  DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS,
  isValidDrugNetworkRoleVerificationStatus,
  DRUG_RELATIONSHIP_STATUS_LABELS,
  isValidDrugRelationshipStatus,
} from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_CASE_STATUS_META } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
import { toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import { ApiClientError } from "@/lib/drug_intelligence/drug_intelligence_client";
import type {
  DrugPersonProfileResponse,
  DrugCaseLinkSummary,
  DrugPersonPhoneRow,
  DrugPersonSimSummaryRow,
  DrugPersonDeviceRow,
  DrugPersonVehicleRow,
  DrugPersonProfileLocationRow,
  DrugPersonDataQualityFlag,
  DrugPersonMatchCandidate,
} from "@/lib/drug_intelligence/drug_intelligence_client";

const TABS = [
  { key: "overview", labelKey: "di.profile.tabOverview" },
  { key: "cases", labelKey: "di.profile.tabCases" },
  { key: "network-roles", labelKey: "di.profile.tabNetworkRoles" },
  { key: "phones", labelKey: "di.profile.tabPhones" },
  { key: "devices", labelKey: "di.profile.tabDevices" },
  { key: "vehicles", labelKey: "di.profile.tabVehicles" },
  { key: "locations", labelKey: "di.profile.tabLocations" },
  { key: "identity", labelKey: "di.profile.tabIdentity" },
  { key: "review", labelKey: "di.profile.tabReview" },
] as const;

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

function identifierTypeLabel(type: string, language: "th" | "en"): string {
  if (!isValidDrugPersonIdentifierType(type)) return type;
  const meta = DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

function formatDate(value: string, language: "th" | "en"): string {
  return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US");
}

export default function DrugPersonProfilePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugPersonProfileContent />
    </Suspense>
  );
}

function DrugPersonProfileContent() {
  const params = useParams<{ id: string }>();
  const personId = decodeURIComponent(params.id);
  const searchParams = useSearchParams();
  const justMerged = searchParams.get("merged") !== null;
  const { user, can } = useAuth();
  const { t, language } = useT();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("overview");

  const profile = useDrugPersonProfile(user?.id ?? null, personId);

  if (profile.isPending) {
    return <LoadingState />;
  }
  if (profile.isError) {
    const isNotFound = profile.error instanceof ApiClientError && profile.error.status === 404;
    return (
      <ErrorState
        title={isNotFound ? t("di.profile.notFound") : undefined}
        message={isNotFound ? undefined : (profile.error as Error).message}
        onRetry={isNotFound ? undefined : () => profile.refetch()}
      />
    );
  }

  const data = profile.data;
  const canViewFull = can("drug.edit");
  const canEdit = can("drug.edit");

  if (data.person.status === "MERGED") {
    return (
      <div className="space-y-5">
        <PageHeader
          title={data.person.primaryFullName}
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/drug-intelligence/persons">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("di.matchReview.backToQueue")}
              </Link>
            </Button>
          }
        />
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              {t("di.profile.mergedBanner")}
            </p>
            {data.person.mergedIntoPersonId ? (
              <Button asChild size="sm">
                <Link href={`/drug-intelligence/persons/${encodeURIComponent(data.person.mergedIntoPersonId)}`}>{t("di.profile.openSurvivor")}</Link>
              </Button>
            ) : null}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={data.person.primaryFullName}
        description={t("di.profile.personId") + ": " + data.person.id}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/drug-intelligence/network?focusType=PERSON&focusId=${encodeURIComponent(data.person.id)}`}>
                <Network className="h-4 w-4" aria-hidden="true" />
                {t("di.network.openNetwork")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/drug-intelligence/timeline?personId=${encodeURIComponent(data.person.id)}`}>
                <History className="h-4 w-4" aria-hidden="true" />
                {t("di.timeline.viewPersonTimeline")}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/drug-intelligence/persons">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("di.matchReview.backToQueue")}
              </Link>
            </Button>
          </div>
        }
      />

      {justMerged ? (
        <Card className="border-good/40 bg-good/5">
          <CardBody className="text-sm text-foreground">{t("di.merge.mergeSuccess")}</CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-muted">
            {t("di.profile.firstSeen")}: <span className="text-foreground">{formatDate(data.firstSeenAt, language)}</span>
          </span>
          <span className="text-muted">
            {t("di.profile.lastSeen")}: <span className="text-foreground">{formatDate(data.lastSeenAt, language)}</span>
          </span>
          <span className="text-muted">
            {t("di.profile.updatedAt")}: <span className="text-foreground">{formatDate(data.person.updatedAt, language)}</span>
          </span>
          {data.aliases.length > 0 ? (
            <span className="text-muted">
              {t("di.person.aliases")}: <span className="text-foreground">{data.aliases.map((a) => a.fullName).join(", ")}</span>
            </span>
          ) : null}
          {data.dataQuality.some((f) => f.code === "POTENTIAL_DUPLICATE") ? (
            <Link href="/drug-intelligence/review/duplicates" className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/5 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/10 transition-colors">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {t("di.profile.duplicateBadge")}
            </Link>
          ) : null}
          {data.counts.cases >= 2 ? (
            <button
              type="button"
              onClick={() => setActiveTab("cases")}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent/50 hover:text-accent transition-colors"
            >
              {t("di.profile.multiCaseHistory")} ({data.counts.cases})
            </button>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <DrugKpiTile label={t("di.profile.kpiCases")} value={data.counts.cases} icon={Users} onClick={() => setActiveTab("cases")} />
        <DrugKpiTile label={t("di.profile.kpiPhones")} value={data.counts.phones} icon={Phone} onClick={() => setActiveTab("phones")} />
        <DrugKpiTile label={t("di.profile.kpiSims")} value={data.counts.sims} icon={Smartphone} onClick={() => setActiveTab("phones")} />
        <DrugKpiTile label={t("di.profile.kpiDevices")} value={data.counts.devices} icon={Smartphone} onClick={() => setActiveTab("devices")} />
        <DrugKpiTile label={t("di.profile.kpiVehicles")} value={data.counts.vehicles} icon={Car} onClick={() => setActiveTab("vehicles")} />
        <DrugKpiTile label={t("di.profile.kpiLocations")} value={data.counts.locations} icon={MapPin} onClick={() => setActiveTab("locations")} />
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg hover:text-foreground"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? <OverviewTab data={data} language={language} canViewFull={canViewFull} /> : null}
      {activeTab === "cases" ? <CasesTab cases={data.cases} language={language} /> : null}
      {activeTab === "network-roles" ? <NetworkRolesTab networkRoles={data.networkRoles ?? []} networkMemberships={data.networkMemberships ?? []} language={language} /> : null}
      {activeTab === "phones" ? <PhonesTab phones={data.phones} sims={data.sims} canViewFull={canViewFull} /> : null}
      {activeTab === "devices" ? <DevicesTab devices={data.devices} canViewFull={canViewFull} /> : null}
      {activeTab === "vehicles" ? <VehiclesTab vehicles={data.vehicles} /> : null}
      {activeTab === "locations" ? <LocationsTab locations={data.locations} language={language} /> : null}
      {activeTab === "identity" ? <IdentityTab personId={personId} data={data} language={language} canViewFull={canViewFull} canEdit={canEdit} /> : null}
      {activeTab === "review" ? <ReviewTab personId={personId} dataQuality={data.dataQuality} mergeHistory={data.mergeHistory} /> : null}
    </div>
  );
}

function sexLabel(sex: string | null | undefined, language: "th" | "en"): string | null {
  if (!sex) return null;
  if (!isValidDrugPersonSex(sex)) return sex;
  return language === "th" ? DRUG_PERSON_SEX_LABELS[sex].labelTh : DRUG_PERSON_SEX_LABELS[sex].labelEn;
}

function calculateAge(dateOfBirth: string | Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const mDiff = now.getMonth() - dob.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function OverviewTab({ data, language, canViewFull }: { data: DrugPersonProfileResponse; language: "th" | "en"; canViewFull: boolean }) {
  const { t } = useT();
  const calculatedAge = calculateAge(data.person.dateOfBirth);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardBody className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.profile.overviewIdentity")}</p>
          <p className="text-sm font-medium text-foreground">{data.person.primaryFullName}</p>
          {/* DI-7.2: nickname */}
          {(data.person as { nickname?: string | null }).nickname ? (
            <p className="text-sm text-muted">
              {t("di.profile.overviewNickname")}: <span className="text-foreground">{(data.person as { nickname?: string | null }).nickname}</span>
            </p>
          ) : null}
          {/* DI-7.2: aliases */}
          {data.aliases.filter((a) => !a.isPrimary).length > 0 ? (
            <p className="text-sm text-muted">
              {t("di.person.aliases")}: <span className="text-foreground">{data.aliases.filter((a) => !a.isPrimary).map((a) => a.fullName).join(", ")}</span>
            </p>
          ) : null}
          {/* DI-7.2: sex */}
          {sexLabel((data.person as { sex?: string | null }).sex, language) ? (
            <p className="text-sm text-muted">
              {t("di.profile.overviewSex")}: <span className="text-foreground">{sexLabel((data.person as { sex?: string | null }).sex, language)}</span>
            </p>
          ) : null}
          {/* DI-7.2: age / approximate age */}
          {calculatedAge !== null ? (
            <p className="text-sm text-muted">
              {t("di.person.dateOfBirth")}:{" "}
              <span className="text-foreground">
                {formatDate(data.person.dateOfBirth as string, language)} ({t("di.profile.overviewDobAge").replace("{age}", String(calculatedAge))})
              </span>
            </p>
          ) : (data.person as { approximateAge?: number | null }).approximateAge ? (
            <p className="text-sm text-muted">
              {t("di.profile.overviewApproxAge")}:{" "}
              <span className="text-foreground">
                {t("di.profile.overviewAgeApprox").replace("{age}", String((data.person as { approximateAge?: number | null }).approximateAge))}
                <span className="ml-1 text-xs text-muted">{t("di.profile.approxAgeNote")}</span>
              </span>
            </p>
          ) : null}
          {data.person.nationality ? <p className="text-sm text-muted">{t("di.person.nationality")}: <span className="text-foreground">{data.person.nationality}</span></p> : null}
          {data.identifiers.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.emptyIdentifiers")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.identifiers.map((identifier) => (
                <li key={identifier.id} className="flex items-center justify-between gap-2">
                  <span className="text-muted">{identifierTypeLabel(identifier.type, language)}</span>
                  <span className="font-mono text-foreground">{presentIdentifierValue(identifier.value, canViewFull)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.profile.overviewCaseSummary")}</p>
          <p className="text-sm text-foreground">{t("di.profile.casesFoundIn").replace("{count}", String(data.counts.cases))}</p>
        </CardBody>
      </Card>

      <DrugEntityAlertSummary entityType="PERSON" entityId={data.person.id} />

      <Card>
        <CardBody className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <History className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            {t("di.timeline.personHistoryTitle")}
          </p>
          <Link href={`/drug-intelligence/timeline?personId=${encodeURIComponent(data.person.id)}`} className="text-xs text-accent hover:underline">
            {t("di.timeline.viewPersonTimeline")}
          </Link>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.profile.dataQualityTitle")}</p>
          {data.dataQuality.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.dataQualityNone")}</p>
          ) : (
            <ul className="space-y-1.5">
              {data.dataQuality.map((flag, i) => (
                <DataQualityFlagRow key={i} flag={flag} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* DI-7.2: network group affiliations summary */}
      {(data.networkMemberships ?? []).length > 0 ? (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.networkGroup.sectionLabel")}</p>
            <ul className="space-y-1 text-sm">
              {(data.networkMemberships as NetworkMembershipRow[]).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{m.networkGroupName ?? m.networkGroupId}</span>
                  {m.status ? <span className="text-xs text-muted">{m.status}</span> : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* DI-7.3: network roles summary (first 3, link to full tab) */}
      {(data.networkRoles ?? []).length > 0 ? (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.profile.tabNetworkRoles")}</p>
            <ul className="space-y-1 text-sm">
              {(data.networkRoles as NetworkRoleRow[]).slice(0, 3).map((nr) => (
                <li key={nr.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {isValidDrugNetworkRole(nr.role)
                      ? language === "th"
                        ? DRUG_NETWORK_ROLE_LABELS[nr.role].labelTh
                        : DRUG_NETWORK_ROLE_LABELS[nr.role].labelEn
                      : nr.role}
                  </span>
                  {nr.verificationStatus && isValidDrugNetworkRoleVerificationStatus(nr.verificationStatus) ? (
                    <VerificationBadge status={nr.verificationStatus} language={language} />
                  ) : null}
                </li>
              ))}
            </ul>
            {(data.networkRoles as NetworkRoleRow[]).length > 3 ? (
              <p className="text-xs text-muted">{t("di.profile.moreNetworkRoles").replace("{n}", String((data.networkRoles as NetworkRoleRow[]).length - 3))}</p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.profile.overviewRelatedCounts")}</p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-muted">{t("di.profile.kpiPhones")}</dt>
              <dd className="text-foreground">{data.counts.phones}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("di.profile.kpiDevices")}</dt>
              <dd className="text-foreground">{data.counts.devices}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("di.profile.kpiVehicles")}</dt>
              <dd className="text-foreground">{data.counts.vehicles}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

interface NetworkRoleRow {
  id: string;
  role: string;
  source: string | null;
  verificationStatus: string;
  note: string | null;
  sourceCaseId: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string | Date;
}
interface NetworkMembershipRow {
  id: string;
  networkGroupId: string;
  networkGroupName?: string | null;
  source: string | null;
  status: string | null;
  note: string | null;
  firstObservedAt?: string | Date | null;
  lastObservedAt?: string | Date | null;
}

function VerificationBadge({ status, language }: { status: string; language: "th" | "en" }) {
  if (!isValidDrugNetworkRoleVerificationStatus(status)) return null;
  const label = language === "th" ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[status].labelTh : DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[status].labelEn;
  const toneCls =
    status === "CONFIRMED"
      ? "bg-good/10 text-good border-good/30"
      : status === "SUPPORTED"
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-muted/10 text-muted border-border";
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${toneCls}`}>{label}</span>;
}

/**
 * DI-7.3: Full network-roles tab — shows all assertions with provenance.
 * Historical assertions displayed chronologically; never collapsed.
 */
function NetworkRolesTab({
  networkRoles,
  networkMemberships,
  language,
}: {
  networkRoles: NetworkRoleRow[];
  networkMemberships: NetworkMembershipRow[];
  language: "th" | "en";
}) {
  const { t } = useT();

  return (
    <div className="space-y-6">
      {/* บทบาทในเครือข่ายยาเสพติด */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("di.profile.tabNetworkRoles")}</h2>
        {networkRoles.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-muted">{t("di.networkRole.empty")}</p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {networkRoles.map((nr) => (
              <Card key={nr.id}>
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {isValidDrugNetworkRole(nr.role)
                        ? language === "th"
                          ? DRUG_NETWORK_ROLE_LABELS[nr.role].labelTh
                          : DRUG_NETWORK_ROLE_LABELS[nr.role].labelEn
                        : nr.role}
                    </span>
                    {isValidDrugNetworkRoleVerificationStatus(nr.verificationStatus) ? (
                      <VerificationBadge status={nr.verificationStatus} language={language} />
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                    {nr.source ? (
                      <div>
                        <dt className="text-muted">{t("di.networkRole.source")}</dt>
                        <dd className="text-foreground">
                          {nr.source in DRUG_NETWORK_ROLE_SOURCE_LABELS
                            ? language === "th"
                              ? DRUG_NETWORK_ROLE_SOURCE_LABELS[nr.source as keyof typeof DRUG_NETWORK_ROLE_SOURCE_LABELS].labelTh
                              : DRUG_NETWORK_ROLE_SOURCE_LABELS[nr.source as keyof typeof DRUG_NETWORK_ROLE_SOURCE_LABELS].labelEn
                            : nr.source}
                        </dd>
                      </div>
                    ) : null}
                    {nr.sourceCaseId ? (
                      <div>
                        <dt className="text-muted">{t("di.networkRole.sourceCase")}</dt>
                        <dd className="font-mono text-foreground">{nr.sourceCaseId}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-muted">{t("di.networkRole.recordedBy")}</dt>
                      <dd className="text-foreground">{nr.createdByName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">{t("di.networkRole.recordedAt")}</dt>
                      <dd className="text-foreground">{formatDate(String(nr.createdAt), language)}</dd>
                    </div>
                  </dl>
                  {nr.note ? <p className="text-sm text-muted">{nr.note}</p> : null}
                  {nr.verificationStatus === "UNVERIFIED" && nr.source === "TESTIMONY" ? (
                    <p className="text-xs text-serious">ข้อมูลนี้มาจากคำให้การ — ยังไม่ได้รับการยืนยันจากหลักฐานอื่น</p>
                  ) : null}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* เครือข่าย / กลุ่มที่เกี่ยวข้อง */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("di.networkGroup.sectionLabel")}</h2>
        {networkMemberships.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-muted">{t("di.networkGroup.empty")}</p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-2">
            {networkMemberships.map((m) => (
              <Card key={m.id}>
                <CardBody className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{m.networkGroupName ?? m.networkGroupId}</p>
                    {m.source ? (
                      <p className="text-sm text-muted">
                        {t("di.networkRole.source")}:{" "}
                        {isValidDrugNetworkRoleSource(m.source)
                          ? DRUG_NETWORK_ROLE_SOURCE_LABELS[m.source].labelTh
                          : m.source}
                      </p>
                    ) : null}
                    {m.status ? (
                      <p className="text-sm text-muted">
                        {t("di.networkRole.verificationStatus")}:{" "}
                        {isValidDrugNetworkRoleVerificationStatus(m.status)
                          ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[m.status].labelTh
                          : m.status}
                      </p>
                    ) : null}
                    {m.note ? <p className="text-sm text-muted">{m.note}</p> : null}
                  </div>
                  <div className="text-right text-xs text-muted">
                    {m.firstObservedAt ? <p>พบครั้งแรก: {formatDiDate(String(m.firstObservedAt))}</p> : null}
                    {m.lastObservedAt ? <p>พบล่าสุด: {formatDiDate(String(m.lastObservedAt))}</p> : null}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DataQualityFlagRow({ flag }: { flag: DrugPersonDataQualityFlag }) {
  const { t } = useT();
  const labelKey =
    flag.code === "NO_IDENTIFIER"
      ? "di.profile.dqNoIdentifier"
      : flag.code === "NO_SOURCE_CASE"
        ? "di.profile.dqNoSourceCase"
        : flag.code === "CONFLICTING_DOB"
          ? "di.profile.dqConflictingDob"
          : flag.code === "POTENTIAL_DUPLICATE"
            ? "di.profile.dqPotentialDuplicate"
            : "di.profile.dqIdentifierShared";
  return (
    <li className="flex items-start gap-2 text-sm">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
      <span className="text-foreground">{t(labelKey)}</span>
    </li>
  );
}

function CasesTab({ cases, language }: { cases: DrugCaseLinkSummary[]; language: "th" | "en" }) {
  const { t } = useT();
  if (cases.length === 0) return <EmptyState title={t("di.profile.emptyCases")} icon={<Users className="h-8 w-8" />} />;
  const sorted = [...cases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map((link) => (
        <Link key={link.caseId} href={`/drug-intelligence/cases/${encodeURIComponent(link.caseId)}`} className="block rounded-xl border border-border bg-surface p-4 hover:border-accent/50">
          <p className="font-medium text-foreground">{link.case?.caseNumber || "—"}</p>
          <p className="mt-1 text-sm text-muted">{personRoleLabel(link.role, language)}</p>
          <p className="mt-1 text-xs text-muted">
            {link.case?.arrestDate ? toGregorianDateInputValue(link.case.arrestDate) : "—"} · {link.case?.province || "—"}
          </p>
          {link.case?.status ? (
            <p className="mt-1 text-xs text-muted">
              {DRUG_CASE_STATUS_META[link.case.status as keyof typeof DRUG_CASE_STATUS_META]?.labelTh ?? link.case.status}
            </p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function PhonesTab({ phones, sims, canViewFull }: { phones: DrugPersonPhoneRow[]; sims: DrugPersonSimSummaryRow[]; canViewFull: boolean }) {
  const { t } = useT();
  if (phones.length === 0 && sims.length === 0) return <EmptyState title={t("di.profile.emptyPhones")} icon={<Phone className="h-8 w-8" />} />;
  return (
    <div className="space-y-4">
      {phones.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">{t("di.phone.number")}</th>
                <th className="px-4 py-3 font-medium">{t("di.phone.firstSeen")}</th>
                <th className="px-4 py-3 font-medium">{t("di.phone.lastSeen")}</th>
                <th className="px-4 py-3 font-medium">{t("di.workspace.provenanceStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((phone) => (
                <tr key={`${phone.caseId}-${phone.phoneNumberId}`} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                  <td className="px-4 py-3 font-mono">
                    {phone.phoneNumber ? (
                      <Link href={`/drug-intelligence/phones/${encodeURIComponent(phone.phoneNumberId)}`} className="text-accent hover:underline">
                        {presentPhoneNumber(phone.phoneNumber.normalizedNumber, canViewFull)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{phone.firstSeenAt ? formatDiDate(String(phone.firstSeenAt)) : "—"}</td>
                  <td className="px-4 py-3 text-muted">{phone.lastSeenAt ? formatDiDate(String(phone.lastSeenAt)) : "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {phone.status
                      ? (isValidDrugRelationshipStatus(phone.status)
                          ? DRUG_RELATIONSHIP_STATUS_LABELS[phone.status].labelTh
                          : phone.status)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {sims.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">SIM</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sims.map((s, i) =>
              s.sim ? (
                <li key={i}>
                  <Link href={`/drug-intelligence/sims/${encodeURIComponent(s.sim.id)}`} className="block rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:border-accent/50">
                    {s.sim.iccid ? presentIdentifierValue(s.sim.iccid, canViewFull) : "—"}
                    {s.sim.carrier ? <span className="ml-2 text-muted">{s.sim.carrier}</span> : null}
                  </Link>
                </li>
              ) : (
                <li key={i} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">—</li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DevicesTab({ devices, canViewFull }: { devices: DrugPersonDeviceRow[]; canViewFull: boolean }) {
  const { t } = useT();
  if (devices.length === 0) return <EmptyState title={t("di.profile.emptyDevices")} icon={<Smartphone className="h-8 w-8" />} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {devices.map((d) => (
        <Link key={d.deviceId} href={`/drug-intelligence/devices/${encodeURIComponent(d.deviceId)}`} className="block">
          <Card className="h-full transition-colors hover:border-accent/50">
            <CardBody className="space-y-1">
              <p className="font-medium text-foreground">{[d.device?.brand, d.device?.model].filter(Boolean).join(" ") || "—"}</p>
              {d.device?.imei1 ? <p className="font-mono text-sm text-muted">{presentIdentifierValue(d.device.imei1, canViewFull)}</p> : null}
              <p className="text-xs text-muted">
                {d.firstSeenAt ? formatDiDate(String(d.firstSeenAt)) : "—"} – {d.lastSeenAt ? formatDiDate(String(d.lastSeenAt)) : "—"}
              </p>
              {/* Section 6: neutral wording — never "เป็นเจ้าของ" (owner) unless the relationship explicitly supports it, which DrugPersonDevice never does. */}
              <p className="text-xs text-muted">{t("di.profile.relationAssociated")}</p>
            </CardBody>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function VehiclesTab({ vehicles }: { vehicles: DrugPersonVehicleRow[] }) {
  const { t } = useT();
  if (vehicles.length === 0) return <EmptyState title={t("di.profile.emptyVehicles")} icon={<Car className="h-8 w-8" />} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {vehicles.map((v) => (
        <Link key={v.vehicleId} href={`/drug-intelligence/vehicles/${encodeURIComponent(v.vehicleId)}`} className="block">
          <Card className="h-full transition-colors hover:border-accent/50">
            <CardBody className="space-y-1">
              <p className="font-medium text-foreground">{v.vehicle?.registrationNumber || "—"}</p>
              <p className="text-sm text-muted">{[v.vehicle?.brand, v.vehicle?.model, v.vehicle?.color].filter(Boolean).join(" · ") || "—"}</p>
              <p className="text-xs text-muted">
                {v.firstSeenAt ? formatDiDate(String(v.firstSeenAt)) : "—"} – {v.lastSeenAt ? formatDiDate(String(v.lastSeenAt)) : "—"}
              </p>
            </CardBody>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function LocationsTab({ locations, language }: { locations: DrugPersonProfileLocationRow[]; language: "th" | "en" }) {
  const { t } = useT();
  if (locations.length === 0) return <EmptyState title={t("di.profile.emptyLocations")} icon={<MapPin className="h-8 w-8" />} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {locations.map((loc) => (
        <Card key={loc.id}>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{locationRoleLabel(loc.role, language)}</p>
            <p className="mt-1 font-medium text-foreground">{loc.location?.name || loc.location?.addressText || "—"}</p>
            <p className="mt-1 text-sm text-muted">{loc.location?.province || "—"}</p>
            {loc.caseNumber ? (
              <Link href={`/drug-intelligence/cases/${encodeURIComponent(loc.caseId)}`} className="mt-1 inline-block text-xs text-accent hover:underline">
                {t("di.profile.sourceCase")}: {loc.caseNumber}
              </Link>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function IdentityTab({
  personId,
  data,
  language,
  canViewFull,
  canEdit,
}: {
  personId: string;
  data: DrugPersonProfileResponse;
  language: "th" | "en";
  canViewFull: boolean;
  canEdit: boolean;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const [addingAlias, setAddingAlias] = useState(false);
  const [aliasValue, setAliasValue] = useState("");
  const [addingIdentifier, setAddingIdentifier] = useState(false);
  const [identifierType, setIdentifierType] = useState<string>("THAI_ID");
  const [identifierValue, setIdentifierValue] = useState("");
  const [identifierCandidates, setIdentifierCandidates] = useState<DrugPersonMatchCandidate[]>([]);

  const addAlias = useAddDrugPersonAlias(user?.id ?? null, user?.displayName ?? "");
  const addIdentifier = useAddDrugPersonIdentifier(user?.id ?? null, user?.displayName ?? "");

  async function submitAlias() {
    if (!aliasValue.trim()) return;
    await addAlias.mutateAsync({ personId, fullName: aliasValue.trim() });
    setAliasValue("");
    setAddingAlias(false);
  }

  async function submitIdentifier() {
    if (!identifierValue.trim()) return;
    const result = await addIdentifier.mutateAsync({ personId, type: identifierType, value: identifierValue.trim() });
    setIdentifierValue("");
    setAddingIdentifier(false);
    setIdentifierCandidates(result.candidates);
  }

  const identifierTypeOptions = DRUG_PERSON_IDENTIFIER_TYPES.map((tType) => ({ value: tType, label: identifierTypeLabel(tType, language) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.aliases")}</p>
            {canEdit ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddingAlias((v) => !v)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t("di.profile.addAlias")}
              </Button>
            ) : null}
          </div>
          {data.aliases.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.emptyAliases")}</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {data.aliases.map((alias) => (
                <li key={alias.id}>{alias.fullName}</li>
              ))}
            </ul>
          )}
          {addingAlias ? (
            <div className="space-y-2 border-t border-border pt-3">
              <Field label={t("di.profile.aliasValue")}>
                <input className={inputCls} value={aliasValue} onChange={(e) => setAliasValue(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={submitAlias} disabled={addAlias.isPending || !aliasValue.trim()}>
                  {addAlias.isPending ? t("di.profile.saving") : t("di.profile.saveChanges")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingAlias(false)}>
                  {t("di.profile.cancel")}
                </Button>
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.person.drawer.identifiers")}</p>
            {canEdit ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddingIdentifier((v) => !v)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t("di.profile.addIdentifier")}
              </Button>
            ) : null}
          </div>
          {data.identifiers.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.emptyIdentifiers")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.identifiers.map((identifier) => (
                <li key={identifier.id} className="flex items-center justify-between gap-2">
                  <span className="text-muted">{identifierTypeLabel(identifier.type, language)}</span>
                  <span className="font-mono text-foreground">{presentIdentifierValue(identifier.value, canViewFull)}</span>
                </li>
              ))}
            </ul>
          )}
          {addingIdentifier ? (
            <div className="space-y-2 border-t border-border pt-3">
              <Field label={t("di.person.identifierType")}>
                <Select options={identifierTypeOptions} value={identifierType} onChange={(e) => setIdentifierType(e.target.value)} />
              </Field>
              <Field label={t("di.person.identifierValue")}>
                <input className={inputCls} value={identifierValue} onChange={(e) => setIdentifierValue(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={submitIdentifier} disabled={addIdentifier.isPending || !identifierValue.trim()}>
                  {addIdentifier.isPending ? t("di.profile.saving") : t("di.profile.saveChanges")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAddingIdentifier(false)}>
                  {t("di.profile.cancel")}
                </Button>
              </div>
            </div>
          ) : null}
          {identifierCandidates.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-serious">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.person.duplicateWarningTitle")}
              </p>
              {identifierCandidates.map((c) => (
                <div key={c.personId} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/drug-intelligence/persons/${encodeURIComponent(c.personId)}`} className="text-sm font-medium text-accent hover:underline">
                      {c.primaryFullName}
                    </Link>
                    <DrugMatchConfidenceBadge confidence={c.confidence} />
                  </div>
                  <DrugMatchSignalsList signals={c.signals} confidence={c.confidence} />
                </div>
              ))}
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function ReviewTab({
  personId,
  dataQuality,
  mergeHistory,
}: {
  personId: string;
  dataQuality: DrugPersonDataQualityFlag[];
  mergeHistory: DrugPersonProfileResponse["mergeHistory"];
}) {
  const { t, language } = useT();
  const { user } = useAuth();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardBody className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.profile.dataQualityTitle")}</p>
          {dataQuality.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.dataQualityNone")}</p>
          ) : (
            <ul className="space-y-2">
              {dataQuality.map((flag, i) => (
                <DataQualityFlagRow key={i} flag={flag} />
              ))}
            </ul>
          )}
          {dataQuality.some((f) => f.code === "POTENTIAL_DUPLICATE") ? (
            <PotentialDuplicatesPreview personId={personId} actorId={user?.id ?? null} language={language} />
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.profile.mergeHistoryTitle")}</p>
          {mergeHistory.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {mergeHistory.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border bg-surface p-3">
                  <p className="text-foreground">{t("di.profile.mergeHistoryEntry").replace("{personId}", entry.mergedPersonId)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t("di.profile.mergedBy")}: {entry.mergedByName} · {new Date(entry.mergedAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function PotentialDuplicatesPreview({ personId, actorId, language }: { personId: string; actorId: string | null; language: "th" | "en" }) {
  void language;
  const { t } = useT();
  const potentialDuplicates = useDrugPotentialDuplicates(actorId, personId);

  if (potentialDuplicates.isPending) return <LoadingState rows={2} />;
  if (potentialDuplicates.isError || !potentialDuplicates.data) return null;
  if (potentialDuplicates.data.candidates.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border pt-3">
      {potentialDuplicates.data.candidates.map((c) => (
        <div key={c.personId} className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/drug-intelligence/persons/${encodeURIComponent(c.personId)}`} className="text-sm font-medium text-accent hover:underline">
              {c.primaryFullName}
            </Link>
            <DrugMatchConfidenceBadge confidence={c.confidence} />
          </div>
          <DrugMatchSignalsList signals={c.signals} confidence={c.confidence} />
          <Button asChild size="sm" variant="outline">
            <Link href={`/drug-intelligence/review/duplicates/compare?a=${encodeURIComponent(personId)}&b=${encodeURIComponent(c.personId)}`}>
              {t("di.profile.potentialDuplicateLink")}
            </Link>
          </Button>
        </div>
      ))}
      <Button asChild variant="ghost" size="sm">
        <Link href="/drug-intelligence/review/duplicates">{t("di.matchReview.title")}</Link>
      </Button>
    </div>
  );
}
