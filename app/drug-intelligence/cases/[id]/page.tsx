/**
 * Drug Case Workspace (Phase DI-1 Round 2, Section 15-17).
 *
 * A Drug-specific workspace — deliberately NOT built on top of
 * OfficerWorkspace (Section 15: "ไม่ coupling กับ OfficerWorkspace โดยตรงจนเสี่ยง
 * regression"). Header + clickable KPI row + tab navigation over 8 sections;
 * Network/Timeline/Map are NOT implemented (Section 17) — shown as a single
 * "coming soon" note, never individually-disabled dead buttons cluttering
 * the tab bar itself.
 */
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Phone, Smartphone, Car, Package, MapPin } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DrugCaseStatusBadge } from "@/components/drug_intelligence/drug_case_status_badge";
import { DrugKpiTile } from "@/components/drug_intelligence/drug_kpi_tile";
import { DrugPersonDrawer } from "@/components/drug_intelligence/drug_person_drawer";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugCase } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentIdentifierValue, presentPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_LOCATION_ROLE_LABELS, isValidDrugLocationRole } from "@/lib/drug_intelligence/drug_location_options";
import { toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";
import type {
  DrugCaseDetailResponse,
  DrugCasePersonRow,
  DrugCasePhoneRow,
  DrugCaseSimRow,
  DrugCaseDeviceRow,
  DrugCaseVehicleRow,
  DrugSeizedItemRow,
  DrugCaseLocationRow,
} from "@/lib/drug_intelligence/drug_intelligence_client";

const TABS = [
  { key: "overview", labelKey: "di.workspace.tabOverview" },
  { key: "persons", labelKey: "di.workspace.tabPersons" },
  { key: "phones", labelKey: "di.workspace.tabPhones" },
  { key: "devices", labelKey: "di.workspace.tabDevices" },
  { key: "vehicles", labelKey: "di.workspace.tabVehicles" },
  { key: "seized", labelKey: "di.workspace.tabSeized" },
  { key: "locations", labelKey: "di.workspace.tabLocations" },
  { key: "notes", labelKey: "di.workspace.tabNotes" },
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

export default function DrugCaseWorkspacePage() {
  const params = useParams<{ id: string }>();
  const caseId = decodeURIComponent(params.id);
  const { user, can } = useAuth();
  const { t, language } = useT();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPersonRole, setSelectedPersonRole] = useState<string | undefined>(undefined);

  const detail = useDrugCase(user?.id ?? null, caseId);

  function openPersonDrawer(personId: string, role?: string) {
    setSelectedPersonId(personId);
    setSelectedPersonRole(role);
  }

  if (detail.isPending) {
    return <LoadingState />;
  }
  if (detail.isError) {
    return <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />;
  }

  const data = detail.data;
  const canViewFull = can("drug.edit");

  return (
    <div className="space-y-5">
      <PageHeader
        title={data.case.caseNumber}
        description={data.case.title}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/drug-intelligence/cases">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("di.workspace.backToList")}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-muted">
            {t("di.field.arrestDate")}: <span className="text-foreground">{data.case.arrestDate ? toGregorianDateInputValue(data.case.arrestDate) : "—"}</span>
          </span>
          <span className="text-muted">
            {t("di.field.reportingUnit")}: <span className="text-foreground">{data.case.reportingUnitText || "—"}</span>
          </span>
          <span className="text-muted">
            {t("di.field.province")}: <span className="text-foreground">{data.case.province || "—"}</span>
          </span>
          <DrugCaseStatusBadge status={data.case.status} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <DrugKpiTile label={t("di.workspace.kpiPersons")} value={data.personCount} icon={Users} onClick={() => setActiveTab("persons")} />
        <DrugKpiTile label={t("di.workspace.kpiPhones")} value={data.phoneCount} icon={Phone} onClick={() => setActiveTab("phones")} />
        <DrugKpiTile label={t("di.workspace.kpiSims")} value={data.simCount} icon={Smartphone} onClick={() => setActiveTab("phones")} />
        <DrugKpiTile label={t("di.workspace.kpiDevices")} value={data.deviceCount} icon={Smartphone} onClick={() => setActiveTab("devices")} />
        <DrugKpiTile label={t("di.workspace.kpiVehicles")} value={data.vehicleCount} icon={Car} onClick={() => setActiveTab("vehicles")} />
        <DrugKpiTile label={t("di.workspace.kpiSeized")} value={data.seizedItemCount} icon={Package} onClick={() => setActiveTab("seized")} />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg hover:text-foreground"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? <OverviewTab data={data} /> : null}
      {activeTab === "persons" ? <PersonsTab persons={data.persons} onSelectPerson={openPersonDrawer} language={language} /> : null}
      {activeTab === "phones" ? <PhonesTab phones={data.phones} sims={data.sims} onSelectPerson={openPersonDrawer} canViewFull={canViewFull} /> : null}
      {activeTab === "devices" ? <DevicesTab devices={data.devices} onSelectPerson={openPersonDrawer} canViewFull={canViewFull} /> : null}
      {activeTab === "vehicles" ? <VehiclesTab vehicles={data.vehicles} onSelectPerson={openPersonDrawer} /> : null}
      {activeTab === "seized" ? <SeizedTab items={data.seizedItems} /> : null}
      {activeTab === "locations" ? <LocationsTab locations={data.locations} language={language} /> : null}
      {activeTab === "notes" ? <NotesTab data={data} /> : null}

      <DrugPersonDrawer personId={selectedPersonId} roleInCase={selectedPersonRole} onClose={() => setSelectedPersonId("")} />
    </div>
  );
}

function FutureFeaturesNote() {
  const { t } = useT();
  return (
    <p className="mt-6 border-t border-border pt-4 text-xs text-muted">
      {t("di.workspace.futureFeatures")}: {t("di.workspace.futureNetwork")} · {t("di.workspace.futureTimeline")} · {t("di.workspace.futureMap")}
    </p>
  );
}

function OverviewTab({ data }: { data: DrugCaseDetailResponse }) {
  const { t } = useT();
  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.workspace.narrative")}</p>
        <p className="whitespace-pre-wrap text-sm text-foreground">{data.case.narrative || "—"}</p>
        <FutureFeaturesNote />
      </CardBody>
    </Card>
  );
}

function PersonsTab({
  persons,
  onSelectPerson,
  language,
}: {
  persons: DrugCasePersonRow[];
  onSelectPerson: (personId: string, role?: string) => void;
  language: "th" | "en";
}) {
  const { t } = useT();
  if (persons.length === 0) return <EmptyState title={t("di.workspace.emptyPersons")} icon={<Users className="h-8 w-8" />} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {persons.map((p) => (
        <button
          key={p.personId}
          type="button"
          onClick={() => onSelectPerson(p.personId, p.role)}
          className="rounded-xl border border-border bg-surface p-4 text-left hover:border-accent/50"
        >
          <p className="font-medium text-foreground">{p.person?.primaryFullName || "—"}</p>
          <p className="mt-1 text-sm text-muted">{personRoleLabel(p.role, language)}</p>
          {p.person?.nationality ? <p className="mt-1 text-xs text-muted">{p.person.nationality}</p> : null}
        </button>
      ))}
    </div>
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
  if (phones.length === 0 && sims.length === 0) return <EmptyState title={t("di.workspace.emptyPhones")} icon={<Phone className="h-8 w-8" />} />;
  return (
    <div className="space-y-4">
      {phones.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">{t("di.phone.number")}</th>
                <th className="px-4 py-3 font-medium">{t("di.person.fullName")}</th>
                <th className="px-4 py-3 font-medium">{t("di.workspace.provenanceStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((phone) => (
                <tr key={`${phone.personId}-${phone.phoneNumberId}`} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                  <td className="px-4 py-3 font-mono">{phone.phoneNumber ? presentPhoneNumber(phone.phoneNumber.normalizedNumber, canViewFull) : "—"}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onSelectPerson(phone.personId, undefined)} className="text-accent hover:underline">
                      {phone.person?.primaryFullName || "—"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted">{phone.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {sims.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">SIM</p>
          <ul className="space-y-1 text-sm text-foreground">
            {sims.map((sim) => (
              <li key={sim.simId}>{sim.status}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DevicesTab({ devices, onSelectPerson, canViewFull }: { devices: DrugCaseDeviceRow[]; onSelectPerson: (personId: string, role?: string) => void; canViewFull: boolean }) {
  const { t } = useT();
  if (devices.length === 0) return <EmptyState title={t("di.workspace.emptyDevices")} icon={<Smartphone className="h-8 w-8" />} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {devices.map((d) => (
        <Card key={d.deviceId}>
          <CardBody className="space-y-1">
            <p className="font-medium text-foreground">{[d.device?.brand, d.device?.model].filter(Boolean).join(" ") || "—"}</p>
            {d.device?.imei1 ? <p className="font-mono text-sm text-muted">{presentIdentifierValue(d.device.imei1, canViewFull)}</p> : null}
            {d.personId ? (
              <button type="button" onClick={() => onSelectPerson(d.personId as string, undefined)} className="text-sm text-accent hover:underline">
                {d.person?.primaryFullName || "—"}
              </button>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function VehiclesTab({ vehicles, onSelectPerson }: { vehicles: DrugCaseVehicleRow[]; onSelectPerson: (personId: string, role?: string) => void }) {
  const { t } = useT();
  if (vehicles.length === 0) return <EmptyState title={t("di.workspace.emptyVehicles")} icon={<Car className="h-8 w-8" />} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {vehicles.map((v) => (
        <Card key={v.vehicleId}>
          <CardBody className="space-y-1">
            <p className="font-medium text-foreground">{v.vehicle?.registrationNumber || "—"}</p>
            <p className="text-sm text-muted">{[v.vehicle?.brand, v.vehicle?.model, v.vehicle?.color].filter(Boolean).join(" · ") || "—"}</p>
            {v.personId ? (
              <button type="button" onClick={() => onSelectPerson(v.personId as string, undefined)} className="text-sm text-accent hover:underline">
                {v.person?.primaryFullName || "—"}
              </button>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function SeizedTab({ items }: { items: DrugSeizedItemRow[] }) {
  const { t } = useT();
  if (items.length === 0) return <EmptyState title={t("di.workspace.emptySeized")} icon={<Package className="h-8 w-8" />} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardBody>
            <p className="font-medium text-foreground">{item.drugType}</p>
            <p className="mt-1 text-sm text-muted">
              {item.quantity ? `${item.quantity} ${item.unit || ""}` : null}
              {item.weightGrams ? ` ${item.weightGrams} g` : null}
              {item.packageCount ? ` · ${item.packageCount} packages` : null}
            </p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function LocationsTab({ locations, language }: { locations: DrugCaseLocationRow[]; language: "th" | "en" }) {
  const { t } = useT();
  if (locations.length === 0) return <EmptyState title={t("di.workspace.emptyLocations")} icon={<MapPin className="h-8 w-8" />} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {locations.map((loc) => (
        <Card key={`${loc.caseId}-${loc.locationId}`}>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{locationRoleLabel(loc.role, language)}</p>
            <p className="mt-1 font-medium text-foreground">{loc.location?.name || loc.location?.addressText || "—"}</p>
            <p className="mt-1 text-sm text-muted">{loc.location?.province || "—"}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function NotesTab({ data }: { data: DrugCaseDetailResponse }) {
  const { t } = useT();
  return (
    <Card>
      <CardBody className="space-y-2 text-sm">
        <p>
          <span className="text-muted">{t("di.workspace.createdBy")}:</span> <span className="text-foreground">{data.case.createdByName}</span>
        </p>
        <p>
          <span className="text-muted">{t("di.workspace.createdAt")}:</span>{" "}
          <span className="text-foreground">{new Date(data.case.createdAt).toLocaleString()}</span>
        </p>
        {data.case.updatedByName ? (
          <p>
            <span className="text-muted">{t("di.workspace.updatedBy")}:</span> <span className="text-foreground">{data.case.updatedByName}</span>
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
