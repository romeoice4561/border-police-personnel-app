/**
 * Intelligence Alert Center (Phase DI-6, Section 8).
 *
 * The operational alert inbox for Drug Intelligence — every repeat-entity/
 * cross-case signal the system has detected, filterable, with a lifecycle
 * (NEW/REVIEWED/DISMISSED) that persists. Desktop: table + filters + detail
 * drawer. Mobile: cards + collapsible filters (Section 26). Never claims
 * proof of association — every title/explanation already routes through
 * drug_intelligence_alert_explanation.ts's neutral wording server-side.
 */
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BellRing, ChevronDown, ChevronUp, Search, Network as NetworkIcon, UserCircle, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugAlertList, useReviewDrugAlert, useDismissDrugAlert, useReopenDrugAlert } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { normalizeThaiPersonnelDateForSave } from "@/lib/officer_profile/thai_personnel_date";
import type { DrugIntelligenceAlert, DrugAlertType, DrugAlertSeverity, DrugAlertStatus, DrugAlertEntityType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ALERT_TYPE_LABEL_KEY: Record<DrugAlertType, TranslationKey> = {
  REPEAT_PERSON: "di.alert.typeRepeatPerson",
  REPEAT_PHONE: "di.alert.typeRepeatPhone",
  REPEAT_SIM: "di.alert.typeRepeatSim",
  REPEAT_DEVICE: "di.alert.typeRepeatDevice",
  REPEAT_VEHICLE: "di.alert.typeRepeatVehicle",
  REPEAT_CASE_ENTITY: "di.alert.typeRepeatCaseEntity",
  NEW_NETWORK_CONNECTION: "di.alert.typeNewNetworkConnection",
  HIGH_CONFIDENCE_DUPLICATE: "di.alert.typeHighConfidenceDuplicate",
};

const SEVERITY_LABEL_KEY: Record<DrugAlertSeverity, TranslationKey> = {
  INFO: "di.alert.severityInfo",
  NOTICE: "di.alert.severityNotice",
  HIGH: "di.alert.severityHigh",
};

const SEVERITY_TONE: Record<DrugAlertSeverity, "default" | "warning" | "critical"> = {
  INFO: "default",
  NOTICE: "warning",
  HIGH: "critical",
};

const STATUS_LABEL_KEY: Record<DrugAlertStatus, TranslationKey> = {
  NEW: "di.alert.statusNew",
  REVIEWED: "di.alert.statusReviewed",
  DISMISSED: "di.alert.statusDismissed",
};

const STATUS_TONE: Record<DrugAlertStatus, "accent" | "good" | "neutral"> = {
  NEW: "accent",
  REVIEWED: "good",
  DISMISSED: "neutral",
} as const;

const ALL_ALERT_TYPES: DrugAlertType[] = ["REPEAT_PERSON", "REPEAT_PHONE", "REPEAT_SIM", "REPEAT_DEVICE", "REPEAT_VEHICLE", "REPEAT_CASE_ENTITY", "NEW_NETWORK_CONNECTION", "HIGH_CONFIDENCE_DUPLICATE"];
const ALL_SEVERITIES: DrugAlertSeverity[] = ["INFO", "NOTICE", "HIGH"];
const ALL_STATUSES: DrugAlertStatus[] = ["NEW", "REVIEWED", "DISMISSED"];
const ALL_ENTITY_TYPES: DrugAlertEntityType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE"];

function networkFocusFor(alert: DrugIntelligenceAlert): { focusType: string; focusId: string } {
  return { focusType: alert.entityType, focusId: alert.entityId };
}

export default function DrugAlertCenterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DrugAlertCenterContent />
    </Suspense>
  );
}

function DrugAlertCenterContent() {
  const { user, can } = useAuth();
  const { t } = useT();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<DrugAlertStatus | "">("");
  const [alertType, setAlertType] = useState<DrugAlertType | "">("");
  const [severity, setSeverity] = useState<DrugAlertSeverity | "">("");
  const [entityType, setEntityType] = useState<DrugAlertEntityType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<DrugIntelligenceAlert | null>(null);
  const [dismissTarget, setDismissTarget] = useState<DrugIntelligenceAlert | null>(null);
  const [dismissReason, setDismissReason] = useState("");

  const currentCaseId = searchParams.get("currentCaseId") ?? undefined;

  const canViewAlerts = can("drug.read");
  const canManageAlerts = can("drug.edit");

  const list = useDrugAlertList(user?.id ?? null, {
    status: status || undefined,
    alertType: alertType || undefined,
    severity: severity || undefined,
    entityType: entityType || undefined,
    currentCaseId,
    dateFrom: dateFrom ? (normalizeThaiPersonnelDateForSave(dateFrom) ?? undefined) : undefined,
    dateTo: dateTo ? (normalizeThaiPersonnelDateForSave(dateTo) ?? undefined) : undefined,
    query: query || undefined,
  });

  const reviewMutation = useReviewDrugAlert(user?.id ?? null, user?.displayName ?? "");
  const dismissMutation = useDismissDrugAlert(user?.id ?? null, user?.displayName ?? "");
  const reopenMutation = useReopenDrugAlert(user?.id ?? null, user?.displayName ?? "");

  function clearFilters() {
    setStatus("");
    setAlertType("");
    setSeverity("");
    setEntityType("");
    setDateFrom("");
    setDateTo("");
    setQuery("");
  }

  async function handleDismiss() {
    if (!dismissTarget || !dismissReason.trim()) return;
    await dismissMutation.mutateAsync({ alertId: dismissTarget.id, reason: dismissReason.trim() });
    setDismissTarget(null);
    setDismissReason("");
    setSelectedAlert(null);
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("di.alert.title")} description={t("di.alert.description")} />

      {!canViewAlerts ? (
        <ErrorState title={t("di.alert.permissionDenied")} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiTile label={t("di.alert.kpiUnreviewed")} value={list.data?.kpi.unreviewed} />
            <KpiTile label={t("di.alert.kpiHigh")} value={list.data?.kpi.highSeverity} tone="critical" />
            <KpiTile label={t("di.alert.kpiRepeatPerson")} value={list.data?.kpi.repeatPerson} />
            <KpiTile label={t("di.alert.kpiRepeatPhone")} value={list.data?.kpi.repeatPhoneOrSim} />
            <KpiTile label={t("di.alert.kpiRepeatDevice")} value={list.data?.kpi.repeatDeviceOrImei} />
            <KpiTile label={t("di.alert.kpiRepeatVehicle")} value={list.data?.kpi.repeatVehicle} />
          </div>

          <Card>
            <CardBody className="space-y-3">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-controls="drug-alert-filters-panel"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                {showFilters ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                {t("di.alert.mobileFiltersToggle")}
              </button>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("di.alert.searchPlaceholder")}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {showFilters ? (
                <div id="drug-alert-filters-panel" className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label htmlFor="alert-filter-status" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.alert.filterStatus")}
                      </label>
                      <Select
                        id="alert-filter-status"
                        options={ALL_STATUSES.map((s) => ({ value: s, label: t(STATUS_LABEL_KEY[s]) }))}
                        placeholder={t("common.all")}
                        value={status}
                        onChange={(e) => setStatus(e.target.value as DrugAlertStatus | "")}
                      />
                    </div>
                    <div>
                      <label htmlFor="alert-filter-type" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.alert.filterType")}
                      </label>
                      <Select
                        id="alert-filter-type"
                        options={ALL_ALERT_TYPES.map((t2) => ({ value: t2, label: t(ALERT_TYPE_LABEL_KEY[t2]) }))}
                        placeholder={t("common.all")}
                        value={alertType}
                        onChange={(e) => setAlertType(e.target.value as DrugAlertType | "")}
                      />
                    </div>
                    <div>
                      <label htmlFor="alert-filter-severity" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.alert.filterSeverity")}
                      </label>
                      <Select
                        id="alert-filter-severity"
                        options={ALL_SEVERITIES.map((s) => ({ value: s, label: t(SEVERITY_LABEL_KEY[s]) }))}
                        placeholder={t("common.all")}
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value as DrugAlertSeverity | "")}
                      />
                    </div>
                    <div>
                      <label htmlFor="alert-filter-entity-type" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.alert.filterEntityType")}
                      </label>
                      <Select
                        id="alert-filter-entity-type"
                        options={ALL_ENTITY_TYPES.map((et) => ({ value: et, label: et }))}
                        placeholder={t("common.all")}
                        value={entityType}
                        onChange={(e) => setEntityType(e.target.value as DrugAlertEntityType | "")}
                      />
                    </div>
                    <div>
                      <label htmlFor="alert-filter-date-from" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.alert.filterDateFrom")}
                      </label>
                      <ThaiDatePicker value={dateFrom} onChange={setDateFrom} placeholder="DD/MM/YYYY" />
                    </div>
                    <div>
                      <label htmlFor="alert-filter-date-to" className="mb-1.5 block text-xs font-medium text-muted">
                        {t("di.alert.filterDateTo")}
                      </label>
                      <ThaiDatePicker value={dateTo} onChange={setDateTo} placeholder="DD/MM/YYYY" />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    {t("di.alert.clearFilters")}
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {list.isPending ? (
            <LoadingState rows={8} label={t("di.alert.loading")} />
          ) : list.isError ? (
            <ErrorState message={t("di.alert.errorLoad")} onRetry={() => list.refetch()} />
          ) : list.data.alerts.length === 0 ? (
            <EmptyState title={t("di.alert.empty")} icon={<BellRing className="h-8 w-8" />} />
          ) : (
            <>
              {/* Desktop: table */}
              <Card className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="px-4 py-3">{t("di.alert.columnSeverity")}</th>
                      <th className="px-4 py-3">{t("di.alert.columnAlert")}</th>
                      <th className="px-4 py-3">{t("di.alert.columnCase")}</th>
                      <th className="px-4 py-3">{t("di.alert.columnPriorCases")}</th>
                      <th className="px-4 py-3">{t("di.alert.columnLastSeen")}</th>
                      <th className="px-4 py-3">{t("di.alert.columnStatus")}</th>
                      <th className="px-4 py-3">{t("di.alert.columnActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.alerts.map((alert) => (
                      <tr key={alert.id} className="border-b border-border last:border-0 hover:bg-neutral-bg/40">
                        <td className="px-4 py-3">
                          <Badge tone={SEVERITY_TONE[alert.severity]}>{t(SEVERITY_LABEL_KEY[alert.severity])}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" className="text-left font-medium text-foreground hover:underline" onClick={() => setSelectedAlert(alert)}>
                            {alert.title}
                          </button>
                          <p className="text-xs text-muted">{t(ALERT_TYPE_LABEL_KEY[alert.alertType])}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted">{alert.currentCaseId ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted">{alert.priorCaseIds.length}</td>
                        <td className="px-4 py-3 text-xs text-muted">{alert.lastSeenAt ? new Date(alert.lastSeenAt).toLocaleDateString("th-TH") : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[alert.status]}>{t(STATUS_LABEL_KEY[alert.status])}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" onClick={() => setSelectedAlert(alert)}>
                            {t("di.alert.viewDetail")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Mobile: cards */}
              <div className="space-y-3 sm:hidden">
                {list.data.alerts.map((alert) => (
                  <Card key={alert.id}>
                    <CardBody className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={SEVERITY_TONE[alert.severity]}>{t(SEVERITY_LABEL_KEY[alert.severity])}</Badge>
                        <Badge tone={STATUS_TONE[alert.status]}>{t(STATUS_LABEL_KEY[alert.status])}</Badge>
                      </div>
                      <button type="button" className="text-left text-sm font-semibold text-foreground" onClick={() => setSelectedAlert(alert)}>
                        {alert.title}
                      </button>
                      <p className="text-xs text-muted">{t(ALERT_TYPE_LABEL_KEY[alert.alertType])}</p>
                      <p className="text-xs text-muted">
                        {t("di.alert.columnPriorCases")}: {alert.priorCaseIds.length}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => setSelectedAlert(alert)}>
                        {t("di.alert.viewDetail")}
                      </Button>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Drawer open={Boolean(selectedAlert)} onClose={() => setSelectedAlert(null)} titleId="drug-alert-detail" title={t("di.alert.detailTitle")}>
        {selectedAlert ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone={SEVERITY_TONE[selectedAlert.severity]}>{t(SEVERITY_LABEL_KEY[selectedAlert.severity])}</Badge>
              <Badge tone={STATUS_TONE[selectedAlert.status]}>{t(STATUS_LABEL_KEY[selectedAlert.status])}</Badge>
            </div>
            <p className="text-sm font-semibold text-foreground">{selectedAlert.title}</p>
            <p className="text-sm text-muted">{selectedAlert.explanation}</p>

            {selectedAlert.priorCaseIds.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted">{t("di.alert.priorCasesLabel")}</p>
                <p className="text-sm text-foreground">{selectedAlert.priorCaseIds.length}</p>
              </div>
            ) : null}
            {selectedAlert.relatedPersonIds && selectedAlert.relatedPersonIds.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted">{t("di.alert.relatedPersonsLabel")}</p>
                <p className="text-sm text-foreground">{selectedAlert.relatedPersonIds.length}</p>
              </div>
            ) : null}
            {selectedAlert.lastSeenAt ? (
              <div>
                <p className="text-xs font-medium text-muted">{t("di.alert.lastSeenLabel")}</p>
                <p className="text-sm text-foreground">{new Date(selectedAlert.lastSeenAt).toLocaleDateString("th-TH")}</p>
              </div>
            ) : null}
            {selectedAlert.reviewedBy ? (
              <div>
                <p className="text-xs font-medium text-muted">{t("di.alert.reviewedByLabel")}</p>
                <p className="text-sm text-foreground">{selectedAlert.reviewedByName}</p>
                {selectedAlert.dismissReason ? <p className="text-xs text-muted">{selectedAlert.dismissReason}</p> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {/* HIGH_CONFIDENCE_DUPLICATE: deep-link directly to compare page when candidate id available */}
              {selectedAlert.alertType === "HIGH_CONFIDENCE_DUPLICATE" &&
               selectedAlert.entityType === "PERSON" &&
               selectedAlert.relatedPersonIds &&
               selectedAlert.relatedPersonIds.length > 0 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/drug-intelligence/review/duplicates/compare?a=${encodeURIComponent(selectedAlert.entityId)}&b=${encodeURIComponent(selectedAlert.relatedPersonIds[0])}`}>
                    <UserCircle className="h-4 w-4" aria-hidden="true" />
                    {t("di.alert.openCompareLink")}
                  </Link>
                </Button>
              ) : selectedAlert.entityType === "PERSON" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/drug-intelligence/persons/${encodeURIComponent(selectedAlert.entityId)}`}>
                    <UserCircle className="h-4 w-4" aria-hidden="true" />
                    {t("di.alert.openProfile")}
                  </Link>
                </Button>
              ) : null}
              {selectedAlert.currentCaseId ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/drug-intelligence/cases/${encodeURIComponent(selectedAlert.currentCaseId)}`}>
                    <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                    {t("di.alert.openCase")}
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link href={`/drug-intelligence/network?${new URLSearchParams(networkFocusFor(selectedAlert)).toString()}`}>
                  <NetworkIcon className="h-4 w-4" aria-hidden="true" />
                  {t("di.alert.openNetwork")}
                </Link>
              </Button>
            </div>

            {canManageAlerts ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {selectedAlert.status === "NEW" ? (
                  <Button size="sm" onClick={() => reviewMutation.mutate(selectedAlert.id)} disabled={reviewMutation.isPending}>
                    {t("di.alert.markReviewed")}
                  </Button>
                ) : null}
                {selectedAlert.status !== "DISMISSED" ? (
                  <Button size="sm" variant="outline" onClick={() => setDismissTarget(selectedAlert)}>
                    {t("di.alert.dismiss")}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate(selectedAlert.id)} disabled={reopenMutation.isPending}>
                    {t("di.alert.reopen")}
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <Drawer open={Boolean(dismissTarget)} onClose={() => setDismissTarget(null)} titleId="drug-alert-dismiss" title={t("di.alert.dismiss")}>
        <div className="space-y-3">
          <label htmlFor="drug-alert-dismiss-reason" className="block text-xs font-medium text-muted">
            {t("di.alert.dismissReasonLabel")}
          </label>
          <textarea
            id="drug-alert-dismiss-reason"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            placeholder={t("di.alert.dismissReasonPlaceholder")}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleDismiss} disabled={!dismissReason.trim() || dismissMutation.isPending}>
              {t("di.alert.dismissConfirm")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissTarget(null)}>
              {t("di.alert.dismissCancel")}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: number | undefined; tone?: "critical" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-semibold ${tone === "critical" ? "text-critical" : "text-foreground"}`}>{value !== undefined ? value.toLocaleString() : "—"}</p>
    </div>
  );
}
