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
import { useParams, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Phone, Smartphone, Car, MapPin, MapPinned, AlertTriangle, Plus, Network, History, FileText, FolderOpen, IdCard, ShieldCheck, Waypoints } from "lucide-react";
import { DrugPersonReportDrawer } from "@/components/drug_intelligence/drug_person_report_drawer";
import { DrugAnalystNotesPanel } from "@/components/drug_intelligence/drug_analyst_notes_panel";
import { DrugInvestigationTasksPanel } from "@/components/drug_intelligence/drug_investigation_tasks_panel";
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
  useDrugEntityMedia,
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
} from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_CASE_STATUS_META } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
import { formatDiDate, formatThaiCompactDateTime, formatThaiOperationalDate, formatThaiOperationalDateWithPlace } from "@/lib/drug_intelligence/di_date_helpers";
import {
  earliestCase,
  latestCase,
  sortCasesChronologically,
  toDateOnly,
} from "@/lib/drug_intelligence/drug_cross_case_connection";
import { ApiClientError } from "@/lib/drug_intelligence/drug_intelligence_client";
import { getSafeReturnTo, withReturnTo, currentInternalHref } from "@/lib/ui/return_context";
import { returnToBackLabelKey } from "@/lib/ui/return_to_back_label";
import { resolvePersonProfileCaseContext, readPersonCaseContextParam } from "@/lib/drug_intelligence/person_case_context";
import { splitRelatedByCurrentCase } from "@/lib/drug_intelligence/person_entity_provenance";
import {
  caseOriginBadge,
  partitionEntityCasesByOrigin,
} from "@/lib/drug_intelligence/drug_person_investigation_origin";
import {
  DrugPersonContextBanner,
  DrugPersonIntelligenceSummary,
  DrugPersonInvestigationConclusion,
  DrugPersonInvestigationStory,
} from "@/components/drug_intelligence/drug_person_provenance";
import { DrugEntityMediaGallery } from "@/components/drug_intelligence/drug_entity_media_gallery";
import { DrugEntityMediaAction } from "@/components/drug_intelligence/drug_entity_media_action";
import { DrugPersonIdentityHeader } from "@/components/drug_intelligence/drug_person_identity_header";
import { DrugWorkspaceTabBar } from "@/components/drug_intelligence/drug_workspace_tab_bar";
import {
  HumanIdLabel,
  IntelligenceSection,
  MiniTimeline,
  VerificationToneBadge,
  VisualIntelligenceCard,
  DiscoveryStatusBadge,
  CaseContextChip,
  CaseChipRow,
  ReviewStatusRow,
  IntelligenceCardGrid,
  compactEntityId,
} from "@/components/drug_intelligence/drug_person_workspace_cards";
import {
  ImportantConnections,
  RelationshipExplanation,
} from "@/components/drug_intelligence/drug_person_relationship_explanation";
import {
  buildImportantConnections,
  explainNetworkRole,
  explainPersonDevice,
  explainPersonLocation,
  explainPersonPhone,
  explainPersonSim,
  explainPersonVehicle,
  preferHumanCaseLabel,
} from "@/lib/drug_intelligence/drug_person_relationship_explain";
import type {
  DrugPersonProfileResponse,
  DrugCaseLinkSummary,
  DrugPersonDataQualityFlag,
  DrugPersonMatchCandidate,
  DrugPersonRelatedPhone,
  DrugPersonRelatedSim,
  DrugPersonRelatedDevice,
  DrugPersonRelatedVehicle,
  DrugPersonRelatedLocation,
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
  { key: "analyst-notes", labelKey: "di.collaboration.tabAnalystNotes" },
  { key: "investigation-tasks", labelKey: "di.tasks.tab" },
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

function formatAuditTimestamp(value: string): string {
  return formatThaiCompactDateTime(value);
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
  const pathname = usePathname();
  const justMerged = searchParams.get("merged") !== null;
  const returnTo = getSafeReturnTo(searchParams);
  const selfHref = currentInternalHref(pathname, searchParams);
  const { user, can } = useAuth();
  const { t, language } = useT();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [reportOpen, setReportOpen] = useState(false);

  const profile = useDrugPersonProfile(user?.id ?? null, personId);
  const personMedia = useDrugEntityMedia(user?.id ?? null, "PERSON", personId);

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
  const currentCaseId = resolvePersonProfileCaseContext(
    readPersonCaseContextParam(searchParams),
    data.cases.map((link) => link.caseId),
  );
  const currentCase = currentCaseId ? data.cases.find((link) => link.caseId === currentCaseId) ?? null : null;
  const currentCaseNumber = currentCase?.case?.caseNumber ?? null;

  if (data.person.status === "MERGED") {
    return (
      <div className="space-y-5 min-w-0 overflow-x-hidden">
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
    <div className="space-y-5 min-w-0 overflow-x-hidden">
      <DrugPersonIdentityHeader
        personId={data.person.id}
        name={data.person.primaryFullName}
        status={data.person.status}
        firstSeenAt={data.firstSeenAt}
        lastSeenAt={data.lastSeenAt}
        aliases={data.aliases}
        identifiers={data.identifiers}
        canViewFull={canViewFull}
        duplicateHref={data.dataQuality.some((flag) => flag.code === "POTENTIAL_DUPLICATE") ? "/drug-intelligence/review/duplicates" : null}
        actions={
          <>
            {returnTo ? (
              <Button asChild variant="outline" size="sm" className="min-h-10">
                <Link href={returnTo} data-testid="back-via-return-to">
                  {t(returnToBackLabelKey(returnTo))}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link
                href={withReturnTo(
                  `/drug-intelligence/network?focusType=PERSON&focusId=${encodeURIComponent(data.person.id)}`,
                  selfHref ?? returnTo,
                )}
              >
                <Network className="h-4 w-4" aria-hidden="true" />
                {t("di.network.openNetwork")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={withReturnTo(
                  `/drug-intelligence/timeline?personId=${encodeURIComponent(data.person.id)}${
                    currentCaseId
                      ? `&sourceCaseId=${encodeURIComponent(currentCaseId)}&caseId=${encodeURIComponent(currentCaseId)}`
                      : ""
                  }`,
                  selfHref ?? returnTo,
                )}
              >
                <History className="h-4 w-4" aria-hidden="true" />
                {t("di.timeline.viewPersonTimeline")}
              </Link>
            </Button>
            {can("drug.read") ? (
              <Button asChild variant="outline" size="sm">
                <Link href={withReturnTo(`/drug-intelligence/map?personId=${encodeURIComponent(data.person.id)}`, selfHref ?? returnTo)}>
                  <MapPinned className="h-4 w-4" aria-hidden="true" />
                  {t("di.map.actionViewOnMap")}
                </Link>
              </Button>
            ) : null}
            {can("drug.export") ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setReportOpen(true)} data-testid="person-report-btn">
                <FileText className="h-4 w-4" aria-hidden="true" />
                {t("di.export.personReportAction")}
              </Button>
            ) : null}
            {data.counts.cases >= 2 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab("cases")}>
                {t("di.profile.multiCaseHistory")} ({data.counts.cases})
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href="/drug-intelligence/persons">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("di.matchReview.backToQueue")}
              </Link>
            </Button>
          </>
        }
      />

      {justMerged ? (
        <Card className="border-good/40 bg-good/5">
          <CardBody className="text-sm text-foreground">{t("di.merge.mergeSuccess")}</CardBody>
        </Card>
      ) : null}

      <DrugPersonContextBanner
        currentCaseId={currentCaseId}
        currentCaseNumber={currentCaseNumber}
        arrestDate={currentCase?.case?.arrestDate ?? null}
        province={currentCase?.case?.province ?? null}
        personName={data.person.primaryFullName}
        personRoleLabel={currentCase ? personRoleLabel(currentCase.role, language) : null}
      />

      {!currentCaseId ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.profile.aggregateOverviewHeading")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <DrugKpiTile label={t("di.profile.kpiCases")} value={data.counts.cases} icon={Users} onClick={() => setActiveTab("cases")} />
            <DrugKpiTile label={t("di.profile.kpiPhones")} value={data.counts.phones} icon={Phone} onClick={() => setActiveTab("phones")} />
            <DrugKpiTile label={t("di.profile.kpiSims")} value={data.counts.sims} icon={Smartphone} onClick={() => setActiveTab("phones")} />
            <DrugKpiTile label={t("di.profile.kpiDevices")} value={data.counts.devices} icon={Smartphone} onClick={() => setActiveTab("devices")} />
            <DrugKpiTile label={t("di.profile.kpiVehicles")} value={data.counts.vehicles} icon={Car} onClick={() => setActiveTab("vehicles")} />
            <DrugKpiTile label={t("di.profile.kpiLocations")} value={data.counts.locations} icon={MapPin} onClick={() => setActiveTab("locations")} />
          </div>
        </div>
      ) : null}

      <DrugEntityMediaGallery entityType="PERSON" entityId={data.person.id} />

      <DrugWorkspaceTabBar
        testId="person-profile-tabs"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as (typeof TABS)[number]["key"])}
        tabs={TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey) }))}
      />

      {activeTab === "overview" ? (
        <OverviewTab
          data={data}
          language={language}
          canViewFull={canViewFull}
          currentCaseId={currentCaseId}
          currentCaseNumber={currentCaseNumber}
          currentCaseArrestDate={currentCase?.case?.arrestDate ?? null}
          currentCaseProvince={currentCase?.case?.province ?? null}
          personRoleLabel={currentCase ? personRoleLabel(currentCase.role, language) : null}
          returnTo={returnTo}
          onViewCases={() => setActiveTab("cases")}
          onOpenTab={setActiveTab}
        />
      ) : null}
      {activeTab === "cases" ? (
        <CasesTab
          cases={data.cases}
          language={language}
          personName={data.person.primaryFullName}
          phones={data.relatedPhones ?? []}
          sims={data.relatedSims ?? []}
          devices={data.relatedDevices ?? []}
          vehicles={data.relatedVehicles ?? []}
          sourceCaseId={currentCaseId}
        />
      ) : null}
      {activeTab === "network-roles" ? (
        <NetworkRolesTab
          networkRoles={data.networkRoles ?? []}
          networkMemberships={data.networkMemberships ?? []}
          language={language}
          cases={data.cases}
        />
      ) : null}
      {activeTab === "phones" ? (
        <PhonesTab
          personName={data.person.primaryFullName}
          phones={data.relatedPhones ?? []}
          sims={data.relatedSims ?? []}
          canViewFull={canViewFull}
          currentCaseId={currentCaseId}
          currentCaseNumber={currentCaseNumber}
          returnHref={selfHref ?? returnTo}
        />
      ) : null}
      {activeTab === "devices" ? (
        <DevicesTab
          personName={data.person.primaryFullName}
          devices={data.relatedDevices ?? []}
          canViewFull={canViewFull}
          currentCaseId={currentCaseId}
          currentCaseNumber={currentCaseNumber}
          returnHref={selfHref ?? returnTo}
        />
      ) : null}
      {activeTab === "vehicles" ? (
        <VehiclesTab
          personName={data.person.primaryFullName}
          vehicles={data.relatedVehicles ?? []}
          currentCaseId={currentCaseId}
          currentCaseNumber={currentCaseNumber}
          returnHref={selfHref ?? returnTo}
        />
      ) : null}
      {activeTab === "locations" ? (
        <LocationsTab
          personName={data.person.primaryFullName}
          locations={data.relatedLocations ?? []}
          language={language}
          currentCaseId={currentCaseId}
          currentCaseNumber={currentCaseNumber}
        />
      ) : null}
      {activeTab === "identity" ? <IdentityTab personId={personId} data={data} language={language} canViewFull={canViewFull} canEdit={canEdit} /> : null}
      {activeTab === "review" ? (
        <ReviewTab
          personId={personId}
          dataQuality={data.dataQuality}
          mergeHistory={data.mergeHistory}
          hasName={Boolean(data.person.primaryFullName?.trim())}
          hasDob={Boolean(data.person.dateOfBirth)}
          hasIdentifier={data.identifiers.length > 0}
          hasPortrait={(personMedia.data?.photoCount ?? 0) > 0}
        />
      ) : null}
      {activeTab === "analyst-notes" ? <DrugAnalystNotesPanel key={personId} targetKind="PERSON" targetId={personId} /> : null}
      {activeTab === "investigation-tasks" ? <DrugInvestigationTasksPanel targetKind="PERSON" targetId={personId} /> : null}
      <DrugPersonReportDrawer
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        personId={data.person.id}
        personName={data.person.primaryFullName}
        caseCount={data.counts.cases}
        phoneCount={data.counts.phones}
        simCount={data.counts.sims}
        deviceCount={data.counts.devices}
        vehicleCount={data.counts.vehicles}
      />
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

function OverviewTab({
  data,
  language,
  canViewFull,
  currentCaseId,
  currentCaseNumber,
  currentCaseArrestDate,
  currentCaseProvince,
  personRoleLabel,
  returnTo,
  onViewCases,
  onOpenTab,
}: {
  data: DrugPersonProfileResponse;
  language: "th" | "en";
  canViewFull: boolean;
  currentCaseId: string | null;
  currentCaseNumber: string | null;
  currentCaseArrestDate: string | Date | null;
  currentCaseProvince: string | null;
  personRoleLabel: string | null;
  returnTo: string | null;
  onViewCases: () => void;
  onOpenTab: (tab: (typeof TABS)[number]["key"]) => void;
}) {
  const { t } = useT();
  const calculatedAge = calculateAge(data.person.dateOfBirth);
  const phones = data.relatedPhones ?? [];
  const sims = data.relatedSims ?? [];
  const devices = data.relatedDevices ?? [];
  const vehicles = data.relatedVehicles ?? [];
  const locations = data.relatedLocations ?? [];

  return (
    <div className="space-y-4">
      {currentCaseId ? (
        <DrugPersonInvestigationStory
          currentCaseId={currentCaseId}
          currentCaseNumber={currentCaseNumber}
          arrestDate={currentCaseArrestDate}
          province={currentCaseProvince}
          personName={data.person.primaryFullName}
          personRoleLabel={personRoleLabel}
          phones={phones}
          sims={sims}
          devices={devices}
          vehicles={vehicles}
          locations={locations}
          canViewFull={canViewFull}
        />
      ) : (
        <DrugPersonIntelligenceSummary
          personId={data.person.id}
          returnTo={returnTo}
          caseCount={data.counts.cases}
          currentCaseId={null}
          phones={phones}
          sims={sims}
          devices={devices}
          vehicles={vehicles}
          canViewFull={canViewFull}
        />
      )}

      <section className="space-y-2" data-testid="person-post-scan-overview">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {currentCaseId ? t("di.profile.postScanOverview") : t("di.profile.aggregateOverviewHeading")}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <DrugKpiTile label={t("di.profile.kpiCases")} value={data.counts.cases} icon={Users} onClick={() => onOpenTab("cases")} />
          <DrugKpiTile label={t("di.profile.kpiPhones")} value={data.counts.phones} icon={Phone} onClick={() => onOpenTab("phones")} />
          <DrugKpiTile label={t("di.profile.kpiSims")} value={data.counts.sims} icon={Smartphone} onClick={() => onOpenTab("phones")} />
          <DrugKpiTile label={t("di.profile.kpiDevices")} value={data.counts.devices} icon={Smartphone} onClick={() => onOpenTab("devices")} />
          <DrugKpiTile label={t("di.profile.kpiVehicles")} value={data.counts.vehicles} icon={Car} onClick={() => onOpenTab("vehicles")} />
          <DrugKpiTile label={t("di.profile.kpiLocations")} value={data.counts.locations} icon={MapPin} onClick={() => onOpenTab("locations")} />
        </div>
        {currentCaseId ? (
          <DrugPersonInvestigationConclusion
            currentCaseId={currentCaseId}
            currentCaseNumber={currentCaseNumber}
            phones={phones}
            sims={sims}
            devices={devices}
            vehicles={vehicles}
            locations={locations}
            canViewFull={canViewFull}
          />
        ) : null}
      </section>

      <ImportantConnections
        titleKey={currentCaseId ? "di.profile.rolesFoundHeading" : "di.profile.importantConnections"}
        items={buildImportantConnections({
          language,
          sourceCaseId: currentCaseId,
          // Origin Investigation Story already explains entity↔case repeats.
          phones: currentCaseId
            ? []
            : phones.map((p) => ({
                id: p.phoneNumberId,
                label: p.phoneNumber?.normalizedNumber
                  ? presentPhoneNumber(p.phoneNumber.normalizedNumber, canViewFull)
                  : p.phoneNumberId.slice(0, 8),
                caseCount: p.cases.length,
                caseIds: p.cases.map((c) => c.caseId),
              })),
          devices: currentCaseId
            ? []
            : devices.map((d) => ({
                id: d.deviceId,
                label: [d.device?.brand, d.device?.model].filter(Boolean).join(" ") || t("di.profile.kpiDevices"),
                caseCount: d.cases.length,
                caseIds: d.cases.map((c) => c.caseId),
              })),
          vehicles: currentCaseId
            ? []
            : vehicles.map((v) => ({
                id: v.vehicleId,
                label: v.vehicle?.registrationNumber || t("di.profile.kpiVehicles"),
                caseCount: v.cases.length,
                caseIds: v.cases.map((c) => c.caseId),
              })),
          networkRoles: (data.networkRoles ?? []).map((nr) => ({
            id: nr.id,
            role: nr.role,
            verificationStatus: nr.verificationStatus,
          })),
        })}
      />

      <div className="border-t border-border pt-4" data-testid="person-supporting-section">
        <h2 className="text-sm font-semibold text-foreground">{t("di.profile.profileSupportingSection")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("di.profile.profileSupportingSubtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
      <IntelligenceSection title={t("di.profile.overviewIdentity")} icon={<IdCard className="h-4 w-4 text-accent" aria-hidden="true" />}>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted">{t("di.person.fullName")}</dt>
          <dd className="font-medium text-foreground">{data.person.primaryFullName}</dd>
          {(data.person as { nickname?: string | null }).nickname ? (
            <>
              <dt className="text-muted">{t("di.profile.overviewNickname")}</dt>
              <dd className="text-foreground">{(data.person as { nickname?: string | null }).nickname}</dd>
            </>
          ) : null}
          {data.aliases.filter((a) => !a.isPrimary).length > 0 ? (
            <>
              <dt className="text-muted">{t("di.person.aliases")}</dt>
              <dd className="text-foreground">{data.aliases.filter((a) => !a.isPrimary).map((a) => a.fullName).join(", ")}</dd>
            </>
          ) : null}
          {sexLabel((data.person as { sex?: string | null }).sex, language) ? (
            <>
              <dt className="text-muted">{t("di.profile.overviewSex")}</dt>
              <dd className="text-foreground">{sexLabel((data.person as { sex?: string | null }).sex, language)}</dd>
            </>
          ) : null}
          {calculatedAge !== null ? (
            <>
              <dt className="text-muted">{t("di.person.dateOfBirth")}</dt>
              <dd className="text-foreground">
                {formatThaiOperationalDate(data.person.dateOfBirth as string)} ({t("di.profile.overviewDobAge").replace("{age}", String(calculatedAge))})
              </dd>
            </>
          ) : (data.person as { approximateAge?: number | null }).approximateAge ? (
            <>
              <dt className="text-muted">{t("di.profile.overviewApproxAge")}</dt>
              <dd className="text-foreground">
                {t("di.profile.overviewAgeApprox").replace("{age}", String((data.person as { approximateAge?: number | null }).approximateAge))}
              </dd>
            </>
          ) : null}
          {data.person.nationality ? (
            <>
              <dt className="text-muted">{t("di.person.nationality")}</dt>
              <dd className="text-foreground">{data.person.nationality}</dd>
            </>
          ) : null}
        </dl>
        {data.identifiers.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("di.profile.emptyIdentifiers")}</p>
        ) : (
          <ul className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
            {data.identifiers.map((identifier) => (
              <li key={identifier.id} className="flex items-center justify-between gap-2">
                <span className="text-muted">{identifierTypeLabel(identifier.type, language)}</span>
                <span className="font-mono text-foreground">{presentIdentifierValue(identifier.value, canViewFull)}</span>
              </li>
            ))}
          </ul>
        )}
      </IntelligenceSection>

      <IntelligenceSection
        title={t("di.profile.overviewCaseSummary")}
        icon={<FolderOpen className="h-4 w-4 text-accent" aria-hidden="true" />}
        action={
          <button type="button" onClick={onViewCases} className="text-xs font-medium text-accent hover:underline">
            {t("di.profile.viewByCase")}
          </button>
        }
      >
        <p className="text-sm text-foreground">{t("di.profile.casesFoundIn").replace("{count}", String(data.counts.cases))}</p>
        {(() => {
          const chronological = sortCasesChronologically(
            data.cases.map((link) => ({
              ...link,
              caseNumber: link.case?.caseNumber ?? null,
              arrestDate: link.case?.arrestDate ?? null,
              arrestTime: link.case?.arrestTime ?? null,
            })),
          );
          const first = earliestCase(chronological);
          const last = latestCase(chronological);
          if (!chronological.length) return null;
          return (
            <ol className="mt-2 space-y-1.5" data-testid="person-case-summary-chronology">
              {chronological.map((link, index) => {
                const isFirst = first?.caseId === link.caseId;
                const isLast = last?.caseId === link.caseId && last.caseId !== first?.caseId;
                const isOnly = first?.caseId === link.caseId && last?.caseId === link.caseId;
                return (
                  <li key={link.caseId} className="rounded-lg border border-border bg-neutral-bg/50 px-2.5 py-2 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted">{index + 1}.</p>
                        <Link
                          href={`/drug-intelligence/cases/${encodeURIComponent(link.caseId)}`}
                          className="font-semibold text-accent hover:underline"
                        >
                          {link.case?.caseNumber || compactEntityId(link.caseId)}
                        </Link>
                        <p className="text-xs text-muted">
                          {link.case?.arrestDate ? formatDiDate(String(link.case.arrestDate)) : "—"}
                          {link.case?.arrestTime ? ` · ${link.case.arrestTime}` : ""}
                          {link.case?.province ? ` · ${link.case.province}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {isFirst || isOnly ? (
                          <span className="inline-flex rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-muted" data-testid="case-badge-first-recorded">
                            {t("di.profile.occurrenceFirstBadge")}
                          </span>
                        ) : null}
                        {isLast || isOnly ? (
                          <span className="inline-flex rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] font-medium text-accent" data-testid="case-badge-last-recorded">
                            {t("di.profile.occurrenceLastBadge")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          );
        })()}
      </IntelligenceSection>

      <DrugEntityAlertSummary entityType="PERSON" entityId={data.person.id} />

      <IntelligenceSection
        title={t("di.profile.miniTimeline")}
        icon={<History className="h-4 w-4 text-accent" aria-hidden="true" />}
        action={
          <Link href={`/drug-intelligence/timeline?personId=${encodeURIComponent(data.person.id)}`} className="text-xs text-accent hover:underline">
            {t("di.timeline.viewPersonTimeline")}
          </Link>
        }
      >
        {(() => {
          const chronological = sortCasesChronologically(
            data.cases.map((link) => ({
              ...link,
              caseNumber: link.case?.caseNumber ?? null,
              arrestDate: link.case?.arrestDate ?? null,
              arrestTime: link.case?.arrestTime ?? null,
            })),
          );
          const first = earliestCase(chronological);
          const last = latestCase(chronological);
          const withArrest = chronological.filter((c) => toDateOnly(c.case?.arrestDate ?? null));
          if (withArrest.length > 0) {
            return (
              <MiniTimeline
                items={withArrest.map((link) => {
                  const isFirst = first?.caseId === link.caseId;
                  const isLast = last?.caseId === link.caseId;
                  const isOnly = isFirst && isLast;
                  let badge: string | null = null;
                  if (isOnly) badge = `${t("di.profile.occurrenceFirstBadge")} · ${t("di.profile.occurrenceLastBadge")}`;
                  else if (isFirst) badge = t("di.profile.occurrenceFirstBadge");
                  else if (isLast) badge = t("di.profile.occurrenceLastBadge");
                  return {
                    id: link.caseId,
                    label: link.case?.caseNumber || compactEntityId(link.caseId),
                    dateLabel: formatDiDate(String(link.case!.arrestDate)),
                    badge,
                    href: `/drug-intelligence/cases/${encodeURIComponent(link.caseId)}`,
                  };
                })}
              />
            );
          }
          if (data.firstSeenAt || data.lastSeenAt) {
            return (
              <MiniTimeline
                items={[
                  ...(data.firstSeenAt
                    ? [{ id: "first", label: t("di.profile.firstSeen"), dateLabel: formatThaiOperationalDate(data.firstSeenAt) }]
                    : []),
                  ...(data.lastSeenAt && data.lastSeenAt !== data.firstSeenAt
                    ? [{ id: "last", label: t("di.profile.lastSeen"), dateLabel: formatThaiOperationalDate(data.lastSeenAt) }]
                    : []),
                ]}
              />
            );
          }
          return <p className="text-sm text-muted">{t("di.profile.occurrenceInsufficient")}</p>;
        })()}
      </IntelligenceSection>

      <IntelligenceSection title={t("di.profile.dataQualityTitle")} icon={<ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />}>
        {data.dataQuality.length === 0 ? (
          <p className="text-sm text-muted">{t("di.profile.dataQualityNone")}</p>
        ) : (
          <ul className="space-y-1.5">
            {data.dataQuality.map((flag, i) => (
              <DataQualityFlagRow key={i} flag={flag} />
            ))}
          </ul>
        )}
      </IntelligenceSection>

      {(data.networkMemberships ?? []).length > 0 ? (
        <IntelligenceSection title={t("di.networkGroup.sectionLabel")} icon={<Network className="h-4 w-4 text-accent" aria-hidden="true" />}>
          <ul className="space-y-1.5 text-sm">
            {(data.networkMemberships as NetworkMembershipRow[]).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-neutral-bg/40 px-2.5 py-2">
                <HumanIdLabel
                  primary={m.networkGroupName}
                  technicalId={m.networkGroupId}
                  fallbackPrimary={t("di.networkGroup.unnamed")}
                />
                {m.status ? <span className="text-xs text-muted">{m.status}</span> : null}
              </li>
            ))}
          </ul>
        </IntelligenceSection>
      ) : null}

      {(data.networkRoles ?? []).length > 0 ? (
        <IntelligenceSection title={t("di.profile.tabNetworkRoles")} icon={<Waypoints className="h-4 w-4 text-accent" aria-hidden="true" />}>
          <ul className="space-y-2">
            {(data.networkRoles as NetworkRoleRow[]).slice(0, 3).map((nr) => (
              <li key={nr.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-neutral-bg/40 px-2.5 py-2">
                <span className="text-sm font-medium text-foreground">
                  {isValidDrugNetworkRole(nr.role)
                    ? language === "th"
                      ? DRUG_NETWORK_ROLE_LABELS[nr.role].labelTh
                      : DRUG_NETWORK_ROLE_LABELS[nr.role].labelEn
                    : nr.role}
                </span>
                {nr.verificationStatus && isValidDrugNetworkRoleVerificationStatus(nr.verificationStatus) ? (
                  <VerificationToneBadge
                    status={nr.verificationStatus}
                    label={
                      language === "th"
                        ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[nr.verificationStatus].labelTh
                        : DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[nr.verificationStatus].labelEn
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
          {(data.networkRoles as NetworkRoleRow[]).length > 3 ? (
            <p className="text-xs text-muted">{t("di.profile.moreNetworkRoles").replace("{n}", String((data.networkRoles as NetworkRoleRow[]).length - 3))}</p>
          ) : null}
        </IntelligenceSection>
      ) : null}
      </div>
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
  cases,
}: {
  networkRoles: NetworkRoleRow[];
  networkMemberships: NetworkMembershipRow[];
  language: "th" | "en";
  cases: DrugCaseLinkSummary[];
}) {
  const { t } = useT();
  const caseLabelById = new Map(cases.map((c) => [c.caseId, preferHumanCaseLabel(c.case?.caseNumber, c.caseId)]));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("di.profile.tabNetworkRoles")}</h2>
        {networkRoles.length === 0 ? (
          <p className="text-sm text-muted">{t("di.networkRole.empty")}</p>
        ) : (
          <IntelligenceCardGrid count={networkRoles.length}>
            {networkRoles.map((nr) => {
              const roleLabel = isValidDrugNetworkRole(nr.role)
                ? language === "th"
                  ? DRUG_NETWORK_ROLE_LABELS[nr.role].labelTh
                  : DRUG_NETWORK_ROLE_LABELS[nr.role].labelEn
                : nr.role;
              const sourceLabel =
                nr.source && isValidDrugNetworkRoleSource(nr.source)
                  ? language === "th"
                    ? DRUG_NETWORK_ROLE_SOURCE_LABELS[nr.source].labelTh
                    : DRUG_NETWORK_ROLE_SOURCE_LABELS[nr.source].labelEn
                  : null;
              const caseLabel = nr.sourceCaseId
                ? caseLabelById.get(nr.sourceCaseId) ?? preferHumanCaseLabel(null, nr.sourceCaseId)
                : null;
              const confirmed = nr.verificationStatus === "CONFIRMED" || nr.verificationStatus === "SUPPORTED";
              const model = explainNetworkRole({
                role: nr.role,
                source: nr.source,
                verificationStatus: nr.verificationStatus,
                sourceCaseLabel: caseLabel,
                recordedByName: nr.createdByName,
                recordedAtLabel: formatAuditTimestamp(String(nr.createdAt)),
                note: nr.note,
                language,
              });
              return (
                <VisualIntelligenceCard
                  key={nr.id}
                  testId="person-network-role-card"
                  dataAttrs={{ "verification-status": nr.verificationStatus }}
                  emphasized={confirmed}
                  icon={<span aria-hidden="true">🔗</span>}
                  title={roleLabel}
                  badges={
                    isValidDrugNetworkRoleVerificationStatus(nr.verificationStatus) ? (
                      <VerificationToneBadge
                        status={nr.verificationStatus}
                        label={
                          language === "th"
                            ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[nr.verificationStatus].labelTh
                            : DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[nr.verificationStatus].labelEn
                        }
                      />
                    ) : null
                  }
                  summary={
                    <div className="space-y-1.5 text-sm">
                      {caseLabel ? (
                        <div>
                          <p className="text-[11px] font-medium text-muted">
                            {confirmed ? t("di.profile.roleFoundFrom") : t("di.profile.roleReferencedFrom")}
                          </p>
                          <CaseChipRow className="mt-1">
                            <CaseContextChip
                              label={caseLabel}
                              href={`/drug-intelligence/cases/${encodeURIComponent(nr.sourceCaseId!)}`}
                              emphasized={confirmed}
                            />
                          </CaseChipRow>
                        </div>
                      ) : null}
                      {sourceLabel ? (
                        <p className="text-xs text-muted">
                          <span className="font-medium text-foreground">{t("di.profile.roleEvidence")}: </span>
                          {sourceLabel}
                        </p>
                      ) : null}
                      {!confirmed ? <p className="text-xs text-warning">{t("di.profile.roleUnconfirmedWarn")}</p> : null}
                      <p className="text-[11px] text-muted">
                        {t("di.profile.recordedByLine")
                          .replace("{name}", nr.createdByName)
                          .replace("{date}", formatAuditTimestamp(String(nr.createdAt)))}
                      </p>
                    </div>
                  }
                  action={
                    <details className="rounded-lg border border-border bg-neutral-bg/30 px-2.5 py-1.5">
                      <summary className="cursor-pointer text-[11px] font-medium text-muted">{t("di.profile.evidenceDetails")}</summary>
                      <RelationshipExplanation model={model} className="mt-2 border-0 bg-transparent p-0" />
                      {nr.note ? <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{nr.note}</p> : null}
                    </details>
                  }
                />
              );
            })}
          </IntelligenceCardGrid>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("di.networkGroup.sectionLabel")}</h2>
        {networkMemberships.length === 0 ? (
          <p className="text-sm text-muted">{t("di.networkGroup.empty")}</p>
        ) : (
          <IntelligenceCardGrid count={networkMemberships.length}>
            {networkMemberships.map((m) => (
              <VisualIntelligenceCard
                key={m.id}
                icon={<span aria-hidden="true">🕸</span>}
                title={
                  <HumanIdLabel
                    primary={m.networkGroupName}
                    technicalId={m.networkGroupId}
                    fallbackPrimary={t("di.networkGroup.unnamed")}
                  />
                }
                badges={
                  m.status && isValidDrugNetworkRoleVerificationStatus(m.status) ? (
                    <VerificationToneBadge
                      status={m.status}
                      label={
                        language === "th"
                          ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[m.status].labelTh
                          : DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[m.status].labelEn
                      }
                    />
                  ) : null
                }
                meta={
                  <div className="space-y-0.5">
                    {m.source ? (
                      <p>
                        {t("di.networkRole.source")}:{" "}
                        {isValidDrugNetworkRoleSource(m.source)
                          ? language === "th"
                            ? DRUG_NETWORK_ROLE_SOURCE_LABELS[m.source].labelTh
                            : DRUG_NETWORK_ROLE_SOURCE_LABELS[m.source].labelEn
                          : m.source}
                      </p>
                    ) : null}
                    {m.firstObservedAt ? <p>พบครั้งแรก: {formatDiDate(String(m.firstObservedAt))}</p> : null}
                    {m.lastObservedAt ? <p>พบล่าสุด: {formatDiDate(String(m.lastObservedAt))}</p> : null}
                  </div>
                }
              />
            ))}
          </IntelligenceCardGrid>
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

function CasesTab({
  cases,
  language,
  personName,
  phones,
  sims,
  devices,
  vehicles,
  sourceCaseId,
}: {
  cases: DrugCaseLinkSummary[];
  language: "th" | "en";
  personName: string;
  phones: DrugPersonRelatedPhone[];
  sims: DrugPersonRelatedSim[];
  devices: DrugPersonRelatedDevice[];
  vehicles: DrugPersonRelatedVehicle[];
  sourceCaseId: string | null;
}) {
  const { t } = useT();
  if (cases.length === 0) return <EmptyState title={t("di.profile.emptyCases")} icon={<Users className="h-8 w-8" />} />;
  const sorted = sortCasesChronologically(
    cases.map((link) => ({
      ...link,
      caseNumber: link.case?.caseNumber ?? null,
      arrestDate: link.case?.arrestDate ?? null,
      arrestTime: link.case?.arrestTime ?? null,
    })),
  );
  const first = earliestCase(sorted);
  const last = latestCase(sorted);
  return (
    <div className="space-y-3" data-testid="person-case-history">
      <p className="text-sm font-semibold text-foreground">{t("di.profile.caseHistoryTitle")}</p>
      <IntelligenceCardGrid count={sorted.length}>
      {sorted.map((link) => {
        const caseLabel = preferHumanCaseLabel(link.case?.caseNumber, link.caseId);
        const roleLabel = personRoleLabel(link.role, language);
        const linkedPhones = phones.filter((p) => p.cases.some((c) => c.caseId === link.caseId));
        const linkedSims = sims.filter((s) => s.cases.some((c) => c.caseId === link.caseId));
        const linkedDevices = devices.filter((d) => d.cases.some((c) => c.caseId === link.caseId));
        const linkedVehicles = vehicles.filter((v) => v.cases.some((c) => c.caseId === link.caseId));
        const linkedTotal = linkedPhones.length + linkedSims.length + linkedDevices.length + linkedVehicles.length;
        const viaParts: string[] = [];
        if (linkedPhones.length) viaParts.push(t("di.workspace.kpiPhones"));
        if (linkedSims.length) viaParts.push(t("di.workspace.kpiSims"));
        if (linkedDevices.length) viaParts.push(t("di.workspace.kpiDevices"));
        if (linkedVehicles.length) viaParts.push(t("di.workspace.kpiVehicles"));
        const originBadge = caseOriginBadge({
          caseId: link.caseId,
          sourceCaseId,
          personIsOnCase: true,
        });
        const summaryLine =
          originBadge === "SOURCE"
            ? t("di.profile.caseRoleInThisCase").replace("{role}", roleLabel)
            : t("di.profile.caseLinkedShort");
        const isFirst = first?.caseId === link.caseId;
        const isLast = last?.caseId === link.caseId;
        const isOnly = isFirst && isLast;
        return (
          <VisualIntelligenceCard
            key={link.caseId}
            testId="person-case-card"
            dataAttrs={{ "origin-badge": originBadge ?? "none" }}
            emphasized={originBadge === "SOURCE"}
            icon={<FolderOpen className="h-4 w-4" aria-hidden="true" />}
            title={caseLabel}
            badges={
              <>
                <span className="inline-flex rounded-full border border-critical/30 bg-critical/10 px-2 py-0.5 text-[11px] font-medium text-critical">
                  {roleLabel}
                </span>
                {originBadge === "SOURCE" ? (
                  <span data-testid="case-badge-source">
                    <DiscoveryStatusBadge kind="SOURCE" label={t("di.profile.caseBadgeSource")} />
                  </span>
                ) : null}
                {originBadge === "LINKED" ? (
                  <span className="inline-flex rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-muted" data-testid="case-badge-linked">
                    {t("di.profile.caseBadgeLinked")}
                  </span>
                ) : null}
                {isFirst || isOnly ? (
                  <span className="inline-flex rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-muted" data-testid="case-badge-first-recorded">
                    {t("di.profile.occurrenceFirstBadge")}
                  </span>
                ) : null}
                {(isLast && !isOnly) || isOnly ? (
                  <span className="inline-flex rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[11px] font-medium text-accent" data-testid="case-badge-last-recorded">
                    {t("di.profile.occurrenceLastBadge")}
                  </span>
                ) : null}
              </>
            }
            summary={
              <div className="space-y-1">
                {originBadge === "SOURCE" ? <p className="text-xs text-muted">{personName}</p> : null}
                <p className="text-sm text-foreground">{summaryLine}</p>
              </div>
            }
            meta={
              <>
                {link.case?.arrestDate
                  ? formatThaiOperationalDateWithPlace(link.case.arrestDate, link.case.province)
                  : link.case?.province || "—"}
                {viaParts.length > 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    {t("di.profile.linkedVia")}: {viaParts.join(" · ")}
                  </p>
                ) : null}
                {linkedTotal > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground" data-testid="case-linked-counts">
                    {linkedPhones.length > 0 ? <span>📞 {linkedPhones.length}</span> : null}
                    {linkedSims.length > 0 ? <span>💳 {linkedSims.length}</span> : null}
                    {linkedDevices.length > 0 ? <span>📱 {linkedDevices.length}</span> : null}
                    {linkedVehicles.length > 0 ? <span>🚗 {linkedVehicles.length}</span> : null}
                  </div>
                ) : null}
              </>
            }
            media={<DrugEntityMediaAction entityType="CASE" entityId={link.caseId} sourceCaseId={link.caseId} compact />}
            action={
              <Link href={`/drug-intelligence/cases/${encodeURIComponent(link.caseId)}`} className="text-xs font-medium text-accent hover:underline">
                {t("di.profile.openCase")} →
              </Link>
            }
          />
        );
      })}
    </IntelligenceCardGrid>
    </div>
  );
}

function PhonesTab({
  personName,
  phones,
  sims,
  canViewFull,
  currentCaseId,
  currentCaseNumber,
  returnHref,
}: {
  personName: string;
  phones: DrugPersonRelatedPhone[];
  sims: DrugPersonRelatedSim[];
  canViewFull: boolean;
  currentCaseId: string | null;
  currentCaseNumber: string | null;
  returnHref: string | null;
}) {
  const { t, language } = useT();
  if (phones.length === 0 && sims.length === 0) return <EmptyState title={t("di.profile.emptyPhones")} icon={<Phone className="h-8 w-8" />} />;

  function PhoneIntelligenceCard({ phone }: { phone: DrugPersonRelatedPhone }) {
    const number = phone.phoneNumber ? presentPhoneNumber(phone.phoneNumber.normalizedNumber, canViewFull) : "—";
    const caseLabels = phone.cases.map((c) => preferHumanCaseLabel(c.caseNumber, c.caseId));
    const origin = partitionEntityCasesByOrigin(phone.cases, currentCaseId);
    const model = explainPersonPhone({
      personName,
      phoneLabel: number,
      caseLabels,
      language,
      sourceCaseLabels: currentCaseId ? origin.sourceLabels : [],
      discoveredCaseLabels: currentCaseId ? origin.discoveredLabels : [],
    });
    const detailHref = withReturnTo(`/drug-intelligence/phones/${encodeURIComponent(phone.phoneNumberId)}`, returnHref);
    const repeated = origin.discoveredCount > 0;
    const sourceOnly = Boolean(currentCaseId && origin.inSource && !repeated);
    return (
      <VisualIntelligenceCard
        testId="person-phone-card"
        dataAttrs={{
          "in-source": origin.inSource ? "true" : "false",
          repeated: repeated ? "true" : "false",
        }}
        emphasized={repeated}
        icon={<Phone className="h-4 w-4" aria-hidden="true" />}
        title={number}
        badges={
          <>
            {repeated ? <DiscoveryStatusBadge kind="REPEATED" label={t("di.profile.badgeRepeated")} /> : null}
            {sourceOnly ? <DiscoveryStatusBadge kind="SOURCE_ONLY" label={t("di.profile.badgeSourceOnly")} /> : null}
          </>
        }
        summary={
          <div className="space-y-2 text-sm">
            {currentCaseId && origin.sourceLabels.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium text-muted">{t("di.profile.foundInSourceCaseHeading")}</p>
                <CaseChipRow className="mt-1">
                  {origin.sourceLabels.map((label) => (
                    <CaseContextChip key={`src-${label}`} label={label} emphasized />
                  ))}
                </CaseChipRow>
              </div>
            ) : null}
            {repeated ? (
              <div>
                <p className="text-[11px] font-medium text-muted">
                  {t("di.profile.foundRepeatedHeading").replace("{count}", String(origin.discoveredCount))}
                </p>
                <CaseChipRow className="mt-1">
                  {phone.cases
                    .filter((c) => c.caseId !== currentCaseId)
                    .map((c) => (
                      <CaseContextChip
                        key={c.caseId}
                        label={preferHumanCaseLabel(c.caseNumber, c.caseId)}
                        href={`/drug-intelligence/cases/${encodeURIComponent(c.caseId)}`}
                      />
                    ))}
                </CaseChipRow>
                <p className="mt-1.5 text-xs text-accent">{t("di.profile.crossCaseInsight")}</p>
              </div>
            ) : null}
            {sourceOnly ? <p className="text-xs text-muted">{t("di.profile.phoneNotRepeatedYet")}</p> : null}
            {!currentCaseId && caseLabels.length > 0 ? (
              <CaseChipRow>
                {phone.cases.slice(0, 6).map((c) => (
                  <CaseContextChip
                    key={c.caseId}
                    label={preferHumanCaseLabel(c.caseNumber, c.caseId)}
                    href={`/drug-intelligence/cases/${encodeURIComponent(c.caseId)}`}
                  />
                ))}
              </CaseChipRow>
            ) : null}
          </div>
        }
        action={
          <>
            <Link href={detailHref} className="text-xs font-medium text-accent hover:underline">
              {t("di.profile.openDetail")} →
            </Link>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-muted">{t("di.profile.howRelated")}</summary>
              <RelationshipExplanation model={model} className="mt-1" />
            </details>
          </>
        }
      />
    );
  }

  function SimIntelligenceCard({ row }: { row: DrugPersonRelatedSim }) {
    const simLabel = row.sim?.iccid ? `SIM ${presentIdentifierValue(row.sim.iccid, canViewFull)}` : "SIM";
    const caseLabels = row.cases.map((c) => preferHumanCaseLabel(c.caseNumber, c.caseId));
    const origin = partitionEntityCasesByOrigin(row.cases, currentCaseId);
    const caseIdSet = new Set(row.cases.map((c) => c.caseId));
    const coAppearingPhoneLabels = phones
      .filter((p) => p.cases.some((c) => caseIdSet.has(c.caseId)))
      .slice(0, 4)
      .map((p) => (p.phoneNumber ? presentPhoneNumber(p.phoneNumber.normalizedNumber, canViewFull) : preferHumanCaseLabel(null, p.phoneNumberId)));
    const model = explainPersonSim({
      personName,
      simLabel,
      caseLabels,
      coAppearingPhoneLabels,
      language,
      sourceCaseLabels: currentCaseId ? origin.sourceLabels : [],
      discoveredCaseLabels: currentCaseId ? origin.discoveredLabels : [],
    });
    const detailHref = row.sim
      ? withReturnTo(`/drug-intelligence/sims/${encodeURIComponent(row.sim.id)}`, returnHref)
      : null;
    const primaryCase = origin.sourceLabels[0] ?? caseLabels[0] ?? null;
    return (
      <VisualIntelligenceCard
        testId="person-sim-card"
        dataAttrs={{ "in-source": origin.inSource ? "true" : "false" }}
        icon={<span aria-hidden="true">💳</span>}
        title={simLabel}
        badges={
          origin.discoveredCount > 0 ? <DiscoveryStatusBadge kind="REPEATED" label={t("di.profile.badgeRepeated")} /> : null
        }
        summary={
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted">{t("di.profile.relatedToThisPerson")}</p>
            {primaryCase ? (
              <CaseChipRow>
                <CaseContextChip
                  label={t("di.profile.foundInCaseChip").replace("{case}", primaryCase)}
                  emphasized={origin.inSource}
                />
              </CaseChipRow>
            ) : null}
            {coAppearingPhoneLabels.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium text-muted">{t("di.profile.coAppearingNumbers")}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-foreground">
                  {coAppearingPhoneLabels.map((phone) => (
                    <li key={phone}>📞 {phone}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {row.sim?.carrier ? <p className="text-xs text-muted">{row.sim.carrier}</p> : null}
          </div>
        }
        action={
          <>
            {detailHref ? (
              <Link href={detailHref} className="text-xs font-medium text-accent hover:underline">
                {t("di.profile.openDetail")} →
              </Link>
            ) : null}
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-muted">{t("di.profile.howRelated")}</summary>
              <RelationshipExplanation model={model} className="mt-1" />
            </details>
          </>
        }
      />
    );
  }

  if (!currentCaseId) {
    return (
      <div className="space-y-6">
        {phones.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t("di.profile.relatedPhones")}</h2>
            <IntelligenceCardGrid count={phones.length}>{phones.map((phone) => <PhoneIntelligenceCard key={phone.phoneNumberId} phone={phone} />)}</IntelligenceCardGrid>
          </div>
        ) : null}
        {sims.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">{t("di.profile.relatedSims")}</h2>
            <IntelligenceCardGrid count={sims.length}>{sims.map((row) => <SimIntelligenceCard key={row.simId} row={row} />)}</IntelligenceCardGrid>
          </div>
        ) : null}
      </div>
    );
  }

  const phoneSplit = splitRelatedByCurrentCase(
    phones.map((phone) => ({ id: phone.phoneNumberId, cases: phone.cases, phone })),
    currentCaseId,
  );
  const simSplit = splitRelatedByCurrentCase(
    sims.map((row) => ({ id: row.simId, cases: row.cases, row })),
    currentCaseId,
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3" data-testid="person-phones-current-section">
        <h2 className="text-base font-semibold text-foreground">{t("di.profile.sourceCaseFacts")}</h2>
        <p className="text-sm font-medium text-accent break-words">{currentCaseNumber || compactEntityId(currentCaseId)}</p>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted">{t("di.profile.kpiPhones")}</h3>
          {phoneSplit.inCurrentCase.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.noneInThisCase")}</p>
          ) : (
            <IntelligenceCardGrid count={phoneSplit.inCurrentCase.length}>
              {phoneSplit.inCurrentCase.map((item) => (
                <PhoneIntelligenceCard key={item.id} phone={item.phone} />
              ))}
            </IntelligenceCardGrid>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted">{t("di.profile.kpiSims")}</h3>
          {simSplit.inCurrentCase.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.noneInThisCase")}</p>
          ) : (
            <IntelligenceCardGrid count={simSplit.inCurrentCase.length}>
              {simSplit.inCurrentCase.map((item) => (
                <SimIntelligenceCard key={item.id} row={item.row} />
              ))}
            </IntelligenceCardGrid>
          )}
        </div>
      </section>
      <section className="space-y-3" data-testid="person-phones-other-section">
        <h2 className="text-base font-semibold text-foreground">{t("di.profile.discoveredLinks")}</h2>
        <p className="text-xs text-muted">{t("di.profile.foundAdditionalLinks")}</p>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted">{t("di.profile.additionalPhones")}</h3>
          {phoneSplit.inOtherCases.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.noneFromOtherCases")}</p>
          ) : (
            <IntelligenceCardGrid count={phoneSplit.inOtherCases.length}>
              {phoneSplit.inOtherCases.map((item) => (
                <PhoneIntelligenceCard key={item.id} phone={item.phone} />
              ))}
            </IntelligenceCardGrid>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted">{t("di.profile.additionalSims")}</h3>
          {simSplit.inOtherCases.length === 0 ? (
            <p className="text-sm text-muted">{t("di.profile.noneFromOtherCases")}</p>
          ) : (
            <IntelligenceCardGrid count={simSplit.inOtherCases.length}>
              {simSplit.inOtherCases.map((item) => (
                <SimIntelligenceCard key={item.id} row={item.row} />
              ))}
            </IntelligenceCardGrid>
          )}
        </div>
      </section>
    </div>
  );
}

function DevicesTab({
  personName,
  devices,
  canViewFull,
  currentCaseId,
  currentCaseNumber,
  returnHref,
}: {
  personName: string;
  devices: DrugPersonRelatedDevice[];
  canViewFull: boolean;
  currentCaseId: string | null;
  currentCaseNumber: string | null;
  returnHref: string | null;
}) {
  const { t, language } = useT();
  if (devices.length === 0) return <EmptyState title={t("di.profile.emptyDevices")} icon={<Smartphone className="h-8 w-8" />} />;
  return (
    <div className="space-y-3">
      {currentCaseId ? (
        <p className="text-xs text-muted">
          {t("di.profile.sourceCaseLabel")}: <span className="font-medium text-accent">{currentCaseNumber || compactEntityId(currentCaseId)}</span>
        </p>
      ) : null}
      <IntelligenceCardGrid count={devices.length}>
        {devices.map((d) => {
          const deviceLabel = [d.device?.brand, d.device?.model].filter(Boolean).join(" ") || t("di.profile.kpiDevices");
          const caseLabels = d.cases.map((c) => preferHumanCaseLabel(c.caseNumber, c.caseId));
          const origin = partitionEntityCasesByOrigin(d.cases, currentCaseId);
          const model = explainPersonDevice({
            personName,
            deviceLabel,
            caseLabels,
            language,
            sourceCaseLabels: currentCaseId ? origin.sourceLabels : [],
            discoveredCaseLabels: currentCaseId ? origin.discoveredLabels : [],
          });
          const primaryCase = origin.sourceLabels[0] ?? caseLabels[0] ?? null;
          return (
            <VisualIntelligenceCard
              key={d.deviceId}
              testId="person-device-card"
              dataAttrs={{ "in-source": origin.inSource ? "true" : "false" }}
              icon={<Smartphone className="h-4 w-4" aria-hidden="true" />}
              title={deviceLabel}
              badges={
                origin.discoveredCount > 0 ? <DiscoveryStatusBadge kind="REPEATED" label={t("di.profile.badgeRepeated")} /> : null
              }
              summary={
                <div className="space-y-1.5 text-sm">
                  {d.device?.imei1 ? (
                    <p className="font-mono text-xs text-muted">
                      IMEI {presentIdentifierValue(d.device.imei1, canViewFull)}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted">
                    {t("di.profile.deviceRelatedShort")}: 👤 {personName}
                  </p>
                  {primaryCase ? (
                    <CaseChipRow>
                      <CaseContextChip
                        label={t("di.profile.foundInCaseChip").replace("{case}", primaryCase)}
                        emphasized={origin.inSource}
                      />
                    </CaseChipRow>
                  ) : null}
                </div>
              }
              media={<DrugEntityMediaAction entityType="DEVICE" entityId={d.deviceId} compact />}
              action={
                <>
                  <Link
                    href={withReturnTo(`/drug-intelligence/devices/${encodeURIComponent(d.deviceId)}`, returnHref)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {t("di.profile.openDetail")} →
                  </Link>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-muted">{t("di.profile.howRelated")}</summary>
                    <RelationshipExplanation model={model} className="mt-1" />
                  </details>
                </>
              }
            />
          );
        })}
      </IntelligenceCardGrid>
    </div>
  );
}

function VehiclesTab({
  personName,
  vehicles,
  currentCaseId,
  currentCaseNumber,
  returnHref,
}: {
  personName: string;
  vehicles: DrugPersonRelatedVehicle[];
  currentCaseId: string | null;
  currentCaseNumber: string | null;
  returnHref: string | null;
}) {
  const { t, language } = useT();
  if (vehicles.length === 0) return <EmptyState title={t("di.profile.emptyVehicles")} icon={<Car className="h-8 w-8" />} />;
  return (
    <div className="space-y-3">
      {currentCaseId ? (
        <p className="text-xs text-muted">
          {t("di.profile.sourceCaseLabel")}: <span className="font-medium text-accent">{currentCaseNumber || compactEntityId(currentCaseId)}</span>
        </p>
      ) : null}
      <IntelligenceCardGrid count={vehicles.length}>
        {vehicles.map((v) => {
          const vehicleLabel = v.vehicle?.registrationNumber || t("di.profile.kpiVehicles");
          const caseLabels = v.cases.map((c) => preferHumanCaseLabel(c.caseNumber, c.caseId));
          const origin = partitionEntityCasesByOrigin(v.cases, currentCaseId);
          const model = explainPersonVehicle({
            personName,
            vehicleLabel,
            caseLabels,
            language,
            sourceCaseLabels: currentCaseId ? origin.sourceLabels : [],
            discoveredCaseLabels: currentCaseId ? origin.discoveredLabels : [],
          });
          const attrs = [v.vehicle?.brand, v.vehicle?.model, v.vehicle?.color, v.vehicle?.registrationProvince].filter(Boolean).join(" · ");
          const primaryCase = origin.sourceLabels[0] ?? caseLabels[0] ?? null;
          return (
            <VisualIntelligenceCard
              key={v.vehicleId}
              testId="person-vehicle-card"
              dataAttrs={{ "in-source": origin.inSource ? "true" : "false" }}
              icon={<Car className="h-4 w-4" aria-hidden="true" />}
              title={vehicleLabel}
              badges={
                origin.discoveredCount > 0 ? <DiscoveryStatusBadge kind="REPEATED" label={t("di.profile.badgeRepeated")} /> : null
              }
              summary={
                <div className="space-y-1.5 text-sm">
                  <p className="text-xs text-muted">{t("di.profile.vehicleRelatedShort")}</p>
                  {primaryCase ? (
                    <CaseChipRow>
                      <CaseContextChip
                        label={t("di.profile.foundInCaseChip").replace("{case}", primaryCase)}
                        emphasized={origin.inSource}
                      />
                    </CaseChipRow>
                  ) : null}
                  {attrs ? <p className="text-xs text-muted">{attrs}</p> : null}
                </div>
              }
              media={<DrugEntityMediaAction entityType="VEHICLE" entityId={v.vehicleId} compact />}
              action={
                <>
                  <Link
                    href={withReturnTo(`/drug-intelligence/vehicles/${encodeURIComponent(v.vehicleId)}`, returnHref)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {t("di.profile.openDetail")} →
                  </Link>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-muted">{t("di.profile.howRelated")}</summary>
                    <RelationshipExplanation model={model} className="mt-1" />
                  </details>
                </>
              }
            />
          );
        })}
      </IntelligenceCardGrid>
    </div>
  );
}

function LocationsTab({
  personName,
  locations,
  language,
  currentCaseId,
  currentCaseNumber,
}: {
  personName: string;
  locations: DrugPersonRelatedLocation[];
  language: "th" | "en";
  currentCaseId: string | null;
  currentCaseNumber: string | null;
}) {
  const { t } = useT();
  if (locations.length === 0) return <EmptyState title={t("di.profile.emptyLocations")} icon={<MapPin className="h-8 w-8" />} />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{t("di.profile.locationNotPersonFact")}</p>
      {currentCaseId ? (
        <p className="text-xs text-muted">
          {t("di.profile.sourceCaseLabel")}: <span className="font-medium text-accent">{currentCaseNumber || compactEntityId(currentCaseId)}</span>
        </p>
      ) : null}
      <IntelligenceCardGrid count={locations.length}>
        {locations.map((loc) => {
          const locationLabel = loc.location?.name || loc.location?.addressText || t("di.profile.relatedEntityFallback");
          const caseLabels = loc.cases.map((c) => preferHumanCaseLabel(c.caseNumber, c.caseId));
          const origin = partitionEntityCasesByOrigin(loc.cases, currentCaseId);
          const model = explainPersonLocation({
            personName,
            locationLabel,
            caseLabels,
            locationRole: loc.role,
            language,
            sourceCaseLabels: currentCaseId ? origin.sourceLabels : [],
            discoveredCaseLabels: currentCaseId ? origin.discoveredLabels : [],
          });
          const placeLine = [loc.location?.district, loc.location?.province].filter(Boolean).join(" · ");
          const primaryCase = origin.sourceLabels[0] ?? caseLabels[0] ?? null;
          const caseCountLabel =
            origin.discoveredCount > 0 || (!currentCaseId && caseLabels.length > 1)
              ? t("di.profile.foundInCases").replace("{count}", String(caseLabels.length))
              : t("di.profile.locationOnlyInSource");
          return (
            <VisualIntelligenceCard
              key={loc.locationId}
              testId="person-location-card"
              dataAttrs={{ "in-source": origin.inSource ? "true" : "false" }}
              icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
              title={locationLabel}
              badges={
                loc.role ? (
                  <span className="inline-flex rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] text-muted">
                    {locationRoleLabel(loc.role, language)}
                  </span>
                ) : null
              }
              summary={
                <div className="space-y-1.5 text-sm">
                  {placeLine ? <p className="text-xs text-muted">{placeLine}</p> : null}
                  {primaryCase ? (
                    <div>
                      <p className="text-[11px] font-medium text-muted">{t("di.profile.relatedViaCase")}</p>
                      <CaseChipRow className="mt-1">
                        <CaseContextChip label={primaryCase} emphasized={origin.inSource} />
                      </CaseChipRow>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted">{caseCountLabel}</p>
                </div>
              }
              media={<DrugEntityMediaAction entityType="LOCATION" entityId={loc.locationId} compact />}
              action={
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/drug-intelligence/map?locationId=${encodeURIComponent(loc.locationId)}`}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {t("di.profile.viewOnMap")} →
                  </Link>
                  <details>
                    <summary className="cursor-pointer text-[11px] text-muted">{t("di.profile.openDetail")}</summary>
                    <RelationshipExplanation model={model} className="mt-1" />
                  </details>
                </div>
              }
            />
          );
        })}
      </IntelligenceCardGrid>
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
  const sharedIdentifier = data.dataQuality.some((flag) => flag.code === "IDENTIFIER_SHARED");
  const conflictingDob = data.dataQuality.some((flag) => flag.code === "CONFLICTING_DOB");

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
    <div className="space-y-4">
      <IntelligenceSection
        title={t("di.profile.identityVerifiedHeading")}
        icon={<IdCard className="h-4 w-4 text-accent" aria-hidden="true" />}
      >
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">{t("di.person.fullName")}</dt>
          <dd className="font-medium text-foreground">{data.person.primaryFullName}</dd>
          {(data.person as { nickname?: string | null }).nickname ? (
            <>
              <dt className="text-muted">{t("di.profile.overviewNickname")}</dt>
              <dd className="text-foreground">{(data.person as { nickname?: string | null }).nickname}</dd>
            </>
          ) : null}
          {data.person.dateOfBirth ? (
            <>
              <dt className="text-muted">{t("di.person.dateOfBirth")}</dt>
              <dd className="flex flex-wrap items-center gap-2 text-foreground">
                {formatThaiOperationalDate(data.person.dateOfBirth as string)}
                {conflictingDob ? (
                  <VerificationToneBadge status="SUPPORTED" label={t("di.profile.verificationConflict")} />
                ) : (
                  <VerificationToneBadge status="CONFIRMED" label={t("di.profile.verificationConfirmed")} />
                )}
              </dd>
            </>
          ) : null}
          {data.person.nationality ? (
            <>
              <dt className="text-muted">{t("di.person.nationality")}</dt>
              <dd className="text-foreground">{data.person.nationality}</dd>
            </>
          ) : null}
        </dl>
      </IntelligenceSection>

      <div className="grid gap-4 lg:grid-cols-2">
      <IntelligenceSection
        title={t("di.person.aliases")}
        icon={<IdCard className="h-4 w-4 text-accent" aria-hidden="true" />}
        action={
          canEdit ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setAddingAlias((v) => !v)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("di.profile.addAlias")}
            </Button>
          ) : null
        }
      >
        {data.aliases.length === 0 ? (
          <p className="text-sm text-muted">{t("di.profile.emptyAliases")}</p>
        ) : (
          <ul className="space-y-2">
            {data.aliases.map((alias) => (
              <li key={alias.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-neutral-bg/40 px-2.5 py-2">
                <span className="text-sm font-medium text-foreground">{alias.fullName}</span>
                {alias.isPrimary ? (
                  <VerificationToneBadge status="CONFIRMED" label={t("di.profile.verificationConfirmed")} />
                ) : (
                  <VerificationToneBadge status="UNVERIFIED" label={t("di.profile.verificationPending")} />
                )}
              </li>
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
      </IntelligenceSection>

      <IntelligenceSection
        title={t("di.profile.identityDocumentsHeading")}
        icon={<IdCard className="h-4 w-4 text-accent" aria-hidden="true" />}
        action={
          canEdit ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setAddingIdentifier((v) => !v)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("di.profile.addIdentifier")}
            </Button>
          ) : null
        }
      >
        {data.identifiers.length === 0 ? (
          <p className="text-sm text-muted">{t("di.profile.emptyIdentifiers")}</p>
        ) : (
          <ul className="space-y-2">
            {data.identifiers.map((identifier) => (
              <li key={identifier.id} className="rounded-lg border border-border bg-neutral-bg/40 px-2.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">{identifierTypeLabel(identifier.type, language)}</p>
                  {sharedIdentifier ? (
                    <VerificationToneBadge status="SUPPORTED" label={t("di.profile.verificationConflict")} />
                  ) : (
                    <VerificationToneBadge status="UNVERIFIED" label={t("di.profile.verificationPending")} />
                  )}
                </div>
                <p className="mt-1 font-mono text-sm text-foreground">{presentIdentifierValue(identifier.value, canViewFull)}</p>
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
                  <Link href={"/drug-intelligence/persons/" + encodeURIComponent(c.personId)} className="text-sm font-medium text-accent hover:underline">
                    {c.primaryFullName}
                  </Link>
                  <DrugMatchConfidenceBadge confidence={c.confidence} />
                </div>
                <DrugMatchSignalsList signals={c.signals} confidence={c.confidence} />
              </div>
            ))}
          </div>
        ) : null}
      </IntelligenceSection>
      </div>
    </div>
  );
}

function ReviewTab({
  personId,
  dataQuality,
  mergeHistory,
  hasName,
  hasDob,
  hasIdentifier,
  hasPortrait,
}: {
  personId: string;
  dataQuality: DrugPersonDataQualityFlag[];
  mergeHistory: DrugPersonProfileResponse["mergeHistory"];
  hasName: boolean;
  hasDob: boolean;
  hasIdentifier: boolean;
  hasPortrait: boolean;
}) {
  const { t, language } = useT();
  const { user } = useAuth();
  const checklist = [
    { ok: hasName, label: t("di.person.fullName"), warn: false },
    { ok: hasPortrait, label: t("di.media.title"), warn: false },
    { ok: hasDob, label: t("di.person.dateOfBirth"), warn: dataQuality.some((f) => f.code === "CONFLICTING_DOB") },
    { ok: hasIdentifier, label: t("di.person.drawer.identifiers"), warn: dataQuality.some((f) => f.code === "IDENTIFIER_SHARED") },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <IntelligenceSection title={t("di.profile.dataQualityTitle")} icon={<ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />}>
        <ul className="space-y-2" data-testid="person-review-status-list">
          <ReviewStatusRow
            tone={hasName && hasPortrait ? "good" : "question"}
            label={t("di.profile.reviewBasicsOk")}
            detail={[hasName ? t("di.person.fullName") : null, hasPortrait ? t("di.media.title") : null].filter(Boolean).join(" · ") || t("di.profile.verificationPending")}
          />
          <ReviewStatusRow
            tone={hasIdentifier ? "good" : "question"}
            label={t("di.profile.reviewCaseLinksOk")}
            detail={hasIdentifier ? t("di.person.drawer.identifiers") : t("di.profile.dqNoIdentifier")}
          />
          {dataQuality.length > 0 ? (
            <ReviewStatusRow
              tone="warn"
              label={t("di.profile.reviewNeedsAttention")}
              detail={t("di.profile.dataQualityTitle")}
            />
          ) : null}
          {checklist.some((item) => !item.ok || item.warn) ? (
            <ReviewStatusRow
              tone="question"
              label={t("di.profile.reviewUnverified")}
              detail={checklist
                .filter((item) => !item.ok || item.warn)
                .map((item) => item.label)
                .join(" · ")}
            />
          ) : null}
        </ul>
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-neutral-bg/40 px-2.5 py-2 text-sm">
              <span className="text-foreground">{item.label}</span>
              {item.warn ? (
                <VerificationToneBadge status="SUPPORTED" label={t("di.profile.verificationConflict")} />
              ) : item.ok ? (
                <VerificationToneBadge status="CONFIRMED" label={t("di.profile.verificationConfirmed")} />
              ) : (
                <VerificationToneBadge status="UNVERIFIED" label={t("di.profile.verificationPending")} />
              )}
            </li>
          ))}
        </ul>
        {dataQuality.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-border pt-3">
            {dataQuality.map((flag, i) => (
              <DataQualityFlagRow key={i} flag={flag} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("di.profile.dataQualityNone")}</p>
        )}
        {dataQuality.some((f) => f.code === "POTENTIAL_DUPLICATE") ? (
          <PotentialDuplicatesPreview personId={personId} actorId={user?.id ?? null} language={language} />
        ) : null}
      </IntelligenceSection>

      <IntelligenceSection title={t("di.profile.mergeHistoryTitle")} icon={<History className="h-4 w-4 text-accent" aria-hidden="true" />}>
        {mergeHistory.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {mergeHistory.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border bg-neutral-bg/40 p-3">
                <p className="text-foreground">{t("di.profile.mergeHistoryEntry").replace("{personId}", compactEntityId(entry.mergedPersonId))}</p>
                <p className="mt-1 text-xs text-muted">
                  {t("di.profile.mergedBy")}: {entry.mergedByName} · {formatAuditTimestamp(String(entry.mergedAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </IntelligenceSection>
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
