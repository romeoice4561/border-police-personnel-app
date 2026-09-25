/**
 * Drug Case Workspace (Phase DI-1 Round 2, Section 15-17).
 *
 * Visual Intelligence polish: Case identity header + compact intelligence
 * summary. Deliberately NOT built on OfficerWorkspace. Network/Timeline/Map
 * remain existing navigation targets — not reinvented here.
 */
"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Phone, Smartphone, Car, Package, MapPin, MapPinned, Network, History, FileText } from "lucide-react";
import { DrugCaseReportDrawer } from "@/components/drug_intelligence/drug_case_report_drawer";
import { getSafeReturnTo, withReturnTo } from "@/lib/ui/return_context";
import { returnToBackLabelKey, isTemporalFocusReturnTo } from "@/lib/ui/return_to_back_label";
import { parseTemporalSelectionFromParams, composeTemporalSelectionLabel } from "@/lib/drug_intelligence/drug_temporal_explorer";
import { formatThaiCompactDate } from "@/lib/drug_intelligence/di_date_helpers";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrugCaseIdentityHeader } from "@/components/drug_intelligence/drug_case_identity_header";
import { DrugCaseIntelligenceSummary } from "@/components/drug_intelligence/drug_case_intelligence_summary";
import { DrugCaseAlertSummary } from "@/components/drug_intelligence/drug_case_alert_summary";
import { DrugCaseTimelineSummary } from "@/components/drug_intelligence/drug_case_timeline_summary";
import { DrugPersonDrawer } from "@/components/drug_intelligence/drug_person_drawer";
import { DrugAnalystNotesPanel } from "@/components/drug_intelligence/drug_analyst_notes_panel";
import { DrugInvestigationTasksPanel } from "@/components/drug_intelligence/drug_investigation_tasks_panel";
import {
  VisualIntelligenceCard,
  IntelligenceCardGrid,
  IntelligenceSection,
  compactEntityId,
} from "@/components/drug_intelligence/drug_person_workspace_cards";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugCase } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
import { DRUG_CATEGORY_LABELS, isValidDrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";
import { DRUG_CASE_UNIT_ROLE_LABELS, isValidDrugCaseUnitRole, DRUG_CASE_OFFICER_ROLE_LABELS, isValidDrugCaseOfficerRole } from "@/lib/drug_intelligence/drug_case_officer_options";
import { gramsToKilograms } from "@/lib/drug_intelligence/drug_seized_item_analytics";
import { DrugCaseInvestigatorContactCard } from "@/components/drug_intelligence/drug_case_investigator_contact_card";
import { DrugCaseConnectedCasesSection } from "@/components/drug_intelligence/drug_cross_case_connection_cards";
import { DrugEntityMediaGallery } from "@/components/drug_intelligence/drug_entity_media_gallery";
import { casePersonInvestigationHref } from "@/lib/drug_intelligence/drug_entity_routes";
import { DrugWorkspaceTabBar } from "@/components/drug_intelligence/drug_workspace_tab_bar";
import { formatThaiCompactDateTime } from "@/lib/drug_intelligence/di_date_helpers";
import type {
  DrugCaseDetailResponse,
  DrugCasePersonRow,
  DrugCasePhoneRow,
  DrugCaseSimRow,
  DrugCaseDeviceRow,
  DrugCaseVehicleRow,
  DrugSeizedItemRow,
  DrugCaseEvidenceItemRow,
  DrugCaseLocationRow,
} from "@/lib/drug_intelligence/drug_intelligence_client";

const TABS = [
  { key: "overview", labelKey: "di.workspace.tabOverview" },
  { key: "media", labelKey: "di.media.title" },
  { key: "persons", labelKey: "di.workspace.tabPersons" },
  { key: "phones", labelKey: "di.workspace.tabPhones" },
  { key: "devices", labelKey: "di.workspace.tabDevices" },
  { key: "vehicles", labelKey: "di.workspace.tabVehicles" },
  { key: "seized", labelKey: "di.workspace.tabSeized" },
  { key: "locations", labelKey: "di.workspace.tabLocations" },
  { key: "analyst-notes", labelKey: "di.collaboration.tabAnalystNotes" },
  { key: "investigation-tasks", labelKey: "di.tasks.tab" },
  { key: "notes", labelKey: "di.workspace.tabNotes" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function personRoleLabel(role: string, language: "th" | "en"): string {
  if (!isValidDrugCasePersonRole(role)) return role;
  const meta = DRUG_CASE_PERSON_ROLE_LABELS[role];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

function drugCategoryLabel(category: string, language: "th" | "en"): string | null {
  if (!isValidDrugCategory(category)) return null;
  const meta = DRUG_CATEGORY_LABELS[category];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

function locationRoleLabel(role: string, language: "th" | "en"): string {
  if (!isValidDrugLocationRole(role)) return role;
  const meta = DRUG_LOCATION_ROLE_LABELS[role];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

export default function DrugCaseWorkspacePage() {
  const params = useParams<{ id: string }>();
  const caseId = decodeURIComponent(params.id);
  const searchParams = useSearchParams();
  const returnTo = getSafeReturnTo(searchParams);
  const { user, can } = useAuth();
  const { t, language } = useT();
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    typeof window !== "undefined" && window.location.hash === "#media" ? "media" : "overview"
  );
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPersonRole, setSelectedPersonRole] = useState<string | undefined>(undefined);
  const [reportOpen, setReportOpen] = useState(false);

  const detail = useDrugCase(user?.id ?? null, caseId);

  useEffect(() => {
    function syncMediaHash() {
      if (typeof window !== "undefined" && window.location.hash === "#media") {
        setActiveTab("media");
      }
    }
    syncMediaHash();
    window.addEventListener("hashchange", syncMediaHash);
    return () => window.removeEventListener("hashchange", syncMediaHash);
  }, []);

  function openPersonDrawer(personId: string, role?: string) {
    setSelectedPersonId(personId);
    setSelectedPersonRole(role);
  }

  function goTab(tab: TabKey) {
    setActiveTab(tab);
    if (tab === "media" && typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#media`);
    }
  }

  if (detail.isPending) {
    return <LoadingState />;
  }
  if (detail.isError) {
    return <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />;
  }

  const data = detail.data;
  const canViewFull = can("drug.edit");

  // DI-8.7 V1.5B VISUAL HOTFIX (Section 7) — only computed/shown when
  // returnTo actually carries temporal-focus context (isTemporalFocusReturnTo
  // is a strict path+flag check); never fabricated for ordinary Network
  // navigation. The label is derived purely from the real query params
  // already present in returnTo, via the SAME composer the Crime Clock
  // panel itself uses — never a second interpretation of the selection.
  const temporalReturnLabel =
    returnTo && isTemporalFocusReturnTo(returnTo)
      ? (() => {
          const queryIndex = returnTo.indexOf("?");
          const params = new URLSearchParams(queryIndex === -1 ? "" : returnTo.slice(queryIndex + 1));
          const selection = parseTemporalSelectionFromParams(params);
          return composeTemporalSelectionLabel(selection, t, formatThaiCompactDate);
        })()
      : null;

  const headerActions = (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {returnTo ? (
          <Button asChild variant="outline" size="sm" className="min-h-10">
            {/*
              DI-8.7 V1.5B VISUAL HOTFIX ROUND 4 — prefetch={false} ONLY when
              returnTo carries temporal-focus restoration context (tFocus=1).
              Root cause: Next.js <Link> prefetches its destination in the
              background as soon as it scrolls into view — that background
              render executed the Network page's request-keyed restoration
              effect (see shouldAttemptTemporalRestore) and consumed the
              guard BEFORE the user's real click, so the actual navigation's
              effect run saw an already-attempted key and skipped
              restoration entirely. Ordinary (non-temporal) returnTo links
              keep prefetching as before — this is scoped to exactly the
              temporal-focus case, never a global prefetch change.
            */}
            <Link href={returnTo} data-testid="back-via-return-to" prefetch={isTemporalFocusReturnTo(returnTo) ? false : undefined}>
              {t(returnToBackLabelKey(returnTo))}
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm" data-testid="case-primary-network">
          <Link href={withReturnTo(`/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(caseId)}`, returnTo)}>
            <Network className="h-4 w-4" aria-hidden="true" />
            {t("di.network.openNetwork")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/drug-intelligence/timeline?caseId=${encodeURIComponent(caseId)}`}>
            <History className="h-4 w-4" aria-hidden="true" />
            {t("di.timeline.navLabel")}
          </Link>
        </Button>
        {can("drug.read") ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/drug-intelligence/map?caseId=${encodeURIComponent(caseId)}`}>
              <MapPinned className="h-4 w-4" aria-hidden="true" />
              {t("di.map.actionOpenOnMap")}
            </Link>
          </Button>
        ) : null}
        {can("drug.export") ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setReportOpen(true)} data-testid="case-report-btn">
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t("di.export.caseReport")}
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="sm">
          <Link href="/drug-intelligence/cases">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("di.workspace.backToList")}
          </Link>
        </Button>
      </div>
      {temporalReturnLabel ? (
        <p className="text-xs text-muted" data-testid="temporal-return-context-label">
          {temporalReturnLabel}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <DrugCaseIdentityHeader
        caseId={caseId}
        caseNumber={data.case.caseNumber}
        title={data.case.title}
        status={data.case.status}
        arrestDate={data.case.arrestDate}
        arrestTime={data.case.arrestTime}
        province={data.case.province}
        reportingUnitText={data.case.reportingUnitText}
        actions={headerActions}
      />

      <DrugWorkspaceTabBar
        testId="case-workspace-tabs"
        activeKey={activeTab}
        onChange={(key) => goTab(key as TabKey)}
        tabs={TABS.map((tab) => ({ key: tab.key, label: t(tab.labelKey) }))}
      />

      {activeTab === "overview" ? <OverviewTab data={data} onOpenTab={goTab} caseId={caseId} returnTo={returnTo} /> : null}
      {activeTab === "media" ? (
        <div id="media">
          <DrugEntityMediaGallery entityType="CASE" entityId={caseId} sourceCaseId={caseId} />
        </div>
      ) : null}
      {activeTab === "persons" ? (
        <PersonsTab
          persons={data.persons}
          caseId={caseId}
          returnTo={withReturnTo(`/drug-intelligence/cases/${encodeURIComponent(caseId)}`, returnTo)}
          onSelectPerson={openPersonDrawer}
          language={language}
        />
      ) : null}
      {activeTab === "phones" ? <PhonesTab phones={data.phones} sims={data.sims} onSelectPerson={openPersonDrawer} canViewFull={canViewFull} /> : null}
      {activeTab === "devices" ? <DevicesTab devices={data.devices} onSelectPerson={openPersonDrawer} canViewFull={canViewFull} /> : null}
      {activeTab === "vehicles" ? <VehiclesTab vehicles={data.vehicles} onSelectPerson={openPersonDrawer} /> : null}
      {activeTab === "seized" ? <SeizedTab items={data.seizedItems} evidenceItems={data.evidenceItems ?? []} language={language} /> : null}
      {activeTab === "locations" ? <LocationsTab locations={data.locations} language={language} /> : null}
      {activeTab === "analyst-notes" ? <DrugAnalystNotesPanel key={caseId} targetKind="CASE" targetId={caseId} /> : null}
      {activeTab === "investigation-tasks" ? <DrugInvestigationTasksPanel targetKind="CASE" targetId={caseId} /> : null}
      {activeTab === "notes" ? <NotesTab data={data} /> : null}

      <DrugPersonDrawer
        personId={selectedPersonId}
        roleInCase={selectedPersonRole}
        caseId={caseId}
        returnTo={withReturnTo(`/drug-intelligence/cases/${encodeURIComponent(caseId)}`, returnTo)}
        onClose={() => setSelectedPersonId("")}
      />
      <DrugCaseReportDrawer
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        caseId={caseId}
        caseNumber={data.case.caseNumber}
        personCount={data.personCount}
        phoneCount={data.phoneCount}
        simCount={data.simCount}
        deviceCount={data.deviceCount}
        vehicleCount={data.vehicleCount}
        seizedCount={data.seizedItemCount}
        unitCount={data.participatingUnits.length}
      />
    </div>
  );
}

function OverviewTab({
  data,
  onOpenTab,
  caseId,
  returnTo,
}: {
  data: DrugCaseDetailResponse;
  onOpenTab: (tab: TabKey) => void;
  caseId: string;
  returnTo: string | null;
}) {
  const { language } = useT();
  return (
    <div className="space-y-3">
      <DrugCaseIntelligenceSummary data={data} onOpenTab={onOpenTab} />
      <DrugCaseConnectedCasesSection
        connectedCases={data.connectedCases}
        returnTo={withReturnTo(`/drug-intelligence/cases/${encodeURIComponent(caseId)}`, returnTo)}
      />
      <DrugCaseAlertSummary caseId={data.case.id} />
      <DrugCaseTimelineSummary
        caseId={data.case.id}
        arrestDate={data.case.arrestDate}
        arrestTime={data.case.arrestTime}
        province={data.case.province}
        district={data.case.district}
        subdistrict={data.case.subdistrict}
        latitude={data.case.latitude}
        longitude={data.case.longitude}
      />
      <DrugCaseInvestigatorContactCard
        caseId={data.case.id}
        investigatorName={data.case.investigatorName}
        investigatorPhone={data.case.investigatorPhone}
      />
      <DrugCaseUnitsAndTeamCard data={data} language={language} />
    </div>
  );
}

/** Section 11: หน่วยและชุดจับกุม — reporting/lead/participating units plus arrest-team members. */
function DrugCaseUnitsAndTeamCard({ data, language }: { data: DrugCaseDetailResponse; language: "th" | "en" }) {
  const { t } = useT();
  return (
    <IntelligenceSection title={t("di.workspace.unitsAndTeamTitle")}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted">{t("di.review.reportingUnitLabel")}</p>
          <p className="text-sm text-foreground">{data.case.reportingUnitText || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("di.review.leadUnitLabel")}</p>
          <p className="text-sm text-foreground">{data.case.leadUnitText || "—"}</p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted">{t("di.review.participatingUnitsLabel")}</p>
        {data.participatingUnits.length === 0 ? (
          <p className="text-sm text-muted">{t("di.review.none")}</p>
        ) : (
          <ul className="space-y-1 text-sm text-foreground">
            {data.participatingUnits.map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                <span>{u.unitText || "—"}</span>
                <span className="text-xs text-muted">
                  ({isValidDrugCaseUnitRole(u.role) ? DRUG_CASE_UNIT_ROLE_LABELS[u.role][language === "th" ? "labelTh" : "labelEn"] : u.role})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs text-muted">{t("di.review.arrestTeamLabel")}</p>
        {data.officers.length === 0 ? (
          <p className="text-sm text-muted">{t("di.review.none")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.officers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                {o.officer ? (
                  <Link href={`/officers/${encodeURIComponent(o.officer.officerId)}`} className="text-accent hover:underline">
                    {o.officer.rank} {o.officer.firstName} {o.officer.lastName}
                  </Link>
                ) : (
                  <span className="text-foreground">
                    {o.manualRank ? `${o.manualRank} ` : ""}
                    {o.manualFullName || "—"}
                  </span>
                )}
                <span className="text-xs text-muted">
                  ({isValidDrugCaseOfficerRole(o.role) ? DRUG_CASE_OFFICER_ROLE_LABELS[o.role][language === "th" ? "labelTh" : "labelEn"] : o.role})
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${o.officer ? "bg-good/10 text-good" : "bg-warning/10 text-warning"}`}>
                  {o.officer ? t("di.workspace.internalOfficerTag") : t("di.workspace.manualOfficerTag")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </IntelligenceSection>
  );
}

function PersonsTab({
  persons,
  caseId,
  returnTo,
  onSelectPerson,
  language,
}: {
  persons: DrugCasePersonRow[];
  caseId: string;
  returnTo: string | null;
  onSelectPerson: (personId: string, role?: string) => void;
  language: "th" | "en";
}) {
  const { t } = useT();
  if (persons.length === 0) {
    return <EmptyState title={t("di.workspace.emptyPersons")} icon={<Users className="h-8 w-8" />} />;
  }
  return (
    <IntelligenceCardGrid count={persons.length}>
      {persons.map((p) => {
        const profileHref = casePersonInvestigationHref(p.personId, caseId, returnTo);
        const name = p.person?.primaryFullName || "—";
        return (
          <VisualIntelligenceCard
            key={p.personId}
            testId="case-person-card"
            dataAttrs={{ "source-case-id": caseId }}
            icon={<Users className="h-4 w-4" />}
            title={
              <Link
                href={profileHref}
                className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-testid="case-person-profile-link"
                data-source-case-id={caseId}
              >
                {name}
              </Link>
            }
            badges={<Badge tone="neutral">{personRoleLabel(p.role, language)}</Badge>}
            summary={p.person?.nationality ? <span className="text-muted">{p.person.nationality}</span> : null}
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={profileHref}>{t("di.person.viewProfile")}</Link>
                </Button>
                <button
                  type="button"
                  onClick={() => onSelectPerson(p.personId, p.role)}
                  className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
                  data-testid="case-person-drawer-trigger"
                >
                  {t("di.person.drawer.quickSummary")}
                </button>
              </div>
            }
          />
        );
      })}
    </IntelligenceCardGrid>
  );
}

function PhonesTab({
  phones,
  sims,
  onSelectPerson,
  canViewFull,
}: {
  phones: DrugCasePhoneRow[];
  sims: DrugCaseSimRow[];
  onSelectPerson: (personId: string, role?: string) => void;
  canViewFull: boolean;
}) {
  const { t } = useT();
  if (phones.length === 0 && sims.length === 0) {
    return <EmptyState title={t("di.workspace.emptyPhones")} icon={<Phone className="h-8 w-8" />} />;
  }
  return (
    <div className="space-y-3">
      {phones.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5 font-medium">{t("di.phone.number")}</th>
                <th className="px-3 py-2.5 font-medium">{t("di.person.fullName")}</th>
                <th className="px-3 py-2.5 font-medium">{t("di.workspace.provenanceStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((phone) => (
                <tr key={`${phone.phoneNumberId}-${phone.personId ?? "case"}`} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                  <td className="px-3 py-2.5 font-mono">
                    {phone.phoneNumber ? (
                      <Link href={`/drug-intelligence/phones/${encodeURIComponent(phone.phoneNumberId)}`} className="text-accent hover:underline">
                        {presentPhoneNumber(phone.phoneNumber.normalizedNumber, canViewFull)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {phone.personId ? (
                      <button type="button" onClick={() => onSelectPerson(phone.personId as string, undefined)} className="text-accent hover:underline">
                        {phone.person?.primaryFullName || "—"}
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone="neutral">{phone.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {sims.length > 0 ? (
        <IntelligenceSection title="SIM">
          <ul className="space-y-1.5 text-sm">
            {sims.map((sim) => (
              <li key={sim.simId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2">
                <span className="text-muted">
                  {t("di.workspace.openSim")} · {compactEntityId(sim.simId)}
                </span>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{sim.status}</Badge>
                  <Link href={`/drug-intelligence/sims/${encodeURIComponent(sim.simId)}`} className="text-xs font-medium text-accent hover:underline">
                    {t("di.workspace.openSim")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </IntelligenceSection>
      ) : null}
    </div>
  );
}

function DevicesTab({ devices, onSelectPerson, canViewFull }: { devices: DrugCaseDeviceRow[]; onSelectPerson: (personId: string, role?: string) => void; canViewFull: boolean }) {
  const { t } = useT();
  if (devices.length === 0) return <EmptyState title={t("di.workspace.emptyDevices")} icon={<Smartphone className="h-8 w-8" />} />;
  return (
    <IntelligenceCardGrid count={devices.length}>
      {devices.map((d) => {
        const label = [d.device?.brand, d.device?.model].filter(Boolean).join(" ") || "—";
        return (
          <VisualIntelligenceCard
            key={d.deviceId}
            icon={<Smartphone className="h-4 w-4" />}
            title={
              <Link href={`/drug-intelligence/devices/${encodeURIComponent(d.deviceId)}`} className="hover:underline">
                {label}
              </Link>
            }
            summary={d.device?.imei1 ? <span className="font-mono text-muted">{presentIdentifierValue(d.device.imei1, canViewFull)}</span> : null}
            action={
              d.personId ? (
                <button type="button" onClick={() => onSelectPerson(d.personId as string, undefined)} className="text-sm text-accent hover:underline">
                  {d.person?.primaryFullName || "—"}
                </button>
              ) : null
            }
          />
        );
      })}
    </IntelligenceCardGrid>
  );
}

function VehiclesTab({ vehicles, onSelectPerson }: { vehicles: DrugCaseVehicleRow[]; onSelectPerson: (personId: string, role?: string) => void }) {
  const { t } = useT();
  if (vehicles.length === 0) return <EmptyState title={t("di.workspace.emptyVehicles")} icon={<Car className="h-8 w-8" />} />;
  return (
    <IntelligenceCardGrid count={vehicles.length}>
      {vehicles.map((v) => (
        <VisualIntelligenceCard
          key={v.vehicleId}
          icon={<Car className="h-4 w-4" />}
          title={
            <Link href={`/drug-intelligence/vehicles/${encodeURIComponent(v.vehicleId)}`} className="hover:underline">
              {v.vehicle?.registrationNumber || "—"}
            </Link>
          }
          summary={<span className="text-muted">{[v.vehicle?.brand, v.vehicle?.model, v.vehicle?.color].filter(Boolean).join(" · ") || "—"}</span>}
          action={
            v.personId ? (
              <button type="button" onClick={() => onSelectPerson(v.personId as string, undefined)} className="text-sm text-accent hover:underline">
                {v.person?.primaryFullName || "—"}
              </button>
            ) : null
          }
        />
      ))}
    </IntelligenceCardGrid>
  );
}

function SeizedTab({ items, evidenceItems, language }: { items: DrugSeizedItemRow[]; evidenceItems: DrugCaseEvidenceItemRow[]; language: "th" | "en" }) {
  const { t } = useT();
  if (items.length === 0 && evidenceItems.length === 0) return <EmptyState title={t("di.workspace.emptySeized")} icon={<Package className="h-8 w-8" />} />;
  const firearms = evidenceItems.filter((item) => item.kind === "FIREARM");
  const other = evidenceItems.filter((item) => item.kind !== "FIREARM");
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-foreground">{t("di.review.seizedSummary")}</p>
      {items.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.review.evidenceDrugs")}</p>
          <IntelligenceCardGrid count={items.length}>
            {items.map((item) => {
              const categoryLabel = drugCategoryLabel(item.drugCategory, language);
              const amount =
                item.measurementKind === "MASS" && item.weightGrams
                  ? `${gramsToKilograms(Number(item.weightGrams)).toLocaleString(language === "th" ? "th-TH" : "en-US", { maximumFractionDigits: 2 })} กก.`
                  : item.quantity
                    ? `${Number(item.quantity).toLocaleString(language === "th" ? "th-TH" : "en-US")} ${item.unit || ""}`
                    : null;
              return (
                <VisualIntelligenceCard
                  key={item.id}
                  icon={<Package className="h-4 w-4" />}
                  title={item.drugType}
                  badges={categoryLabel ? <Badge tone="neutral">{categoryLabel}</Badge> : null}
                  summary={
                    <span className="text-muted">
                      {amount}
                      {item.packageCount ? ` · ${item.packageCount} packages` : null}
                    </span>
                  }
                />
              );
            })}
          </IntelligenceCardGrid>
        </div>
      ) : null}
      {firearms.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.review.evidenceFirearms")}</p>
          <IntelligenceCardGrid count={firearms.length}>
            {firearms.map((item) => (
              <VisualIntelligenceCard
                key={item.id}
                title={item.label}
                summary={<span className="text-muted">{[item.brand, item.model, item.caliberOrSize].filter(Boolean).join(" · ") || "—"}</span>}
                meta={item.quantity ? String(item.quantity) : item.recordedDescription || undefined}
              />
            ))}
          </IntelligenceCardGrid>
        </div>
      ) : null}
      {other.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.review.evidenceOther")}</p>
          <IntelligenceCardGrid count={other.length}>
            {other.map((item) => (
              <VisualIntelligenceCard
                key={item.id}
                title={item.label}
                summary={<span className="text-muted">{[item.quantity, item.unit].filter(Boolean).join(" ") || "—"}</span>}
                meta={item.recordedDescription || undefined}
              />
            ))}
          </IntelligenceCardGrid>
        </div>
      ) : null}
    </div>
  );
}

function LocationsTab({ locations, language }: { locations: DrugCaseLocationRow[]; language: "th" | "en" }) {
  const { t } = useT();
  if (locations.length === 0) return <EmptyState title={t("di.workspace.emptyLocations")} icon={<MapPin className="h-8 w-8" />} />;
  return (
    <IntelligenceCardGrid count={locations.length}>
      {locations.map((loc) => (
        <VisualIntelligenceCard
          key={`${loc.caseId}-${loc.locationId}`}
          icon={<MapPin className="h-4 w-4" />}
          title={loc.location?.name || loc.location?.addressText || "—"}
          badges={<Badge tone="neutral">{locationRoleLabel(loc.role, language)}</Badge>}
          summary={<span className="text-muted">{loc.location?.province || "—"}</span>}
        />
      ))}
    </IntelligenceCardGrid>
  );
}

function NotesTab({ data }: { data: DrugCaseDetailResponse }) {
  const { t } = useT();
  return (
    <IntelligenceSection title={t("di.workspace.tabNotes")}>
      <div className="space-y-2 text-sm">
        <p>
          <span className="text-muted">{t("di.workspace.createdBy")}:</span> <span className="text-foreground">{data.case.createdByName}</span>
        </p>
        <p>
          <span className="text-muted">{t("di.workspace.createdAt")}:</span>{" "}
          <span className="text-foreground">{formatThaiCompactDateTime(data.case.createdAt)}</span>
        </p>
        {data.case.updatedByName ? (
          <p>
            <span className="text-muted">{t("di.workspace.updatedBy")}:</span> <span className="text-foreground">{data.case.updatedByName}</span>
          </p>
        ) : null}
        <details className="pt-1">
          <summary className="cursor-pointer text-xs text-muted hover:text-foreground">{t("di.workspace.technicalDetails")}</summary>
          <p className="mt-1 font-mono text-[10px] text-muted" title={data.case.id}>
            ID: {compactEntityId(data.case.id)}
          </p>
        </details>
      </div>
    </IntelligenceSection>
  );
}
