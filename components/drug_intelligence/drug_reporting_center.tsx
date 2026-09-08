"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, MapPinned, Network, ScanSearch, Users, BellRing, LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DrugCaseListExportDrawer } from "@/components/drug_intelligence/drug_case_list_export_drawer";
import { DrugPersonListExportDrawer } from "@/components/drug_intelligence/drug_person_list_export_drawer";
import { DrugCaseReportDrawer } from "@/components/drug_intelligence/drug_case_report_drawer";
import { DrugPersonReportDrawer } from "@/components/drug_intelligence/drug_person_report_drawer";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  drugQueryKeys,
  useDrugCases,
  useDrugExportHistory,
  useDrugPersonAdvancedSearch,
} from "@/lib/drug_intelligence/drug_intelligence_hooks";
import type { DrugExportHistoryItem, DrugExportHistoryReportKind, DrugExportHistoryFormatKind } from "@/lib/drug_intelligence/drug_export_history";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const PICKER_PAGE_SIZE = 8;

const REPORT_KIND_KEY: Record<DrugExportHistoryReportKind, TranslationKey> = {
  commander: "di.reports.kindCommander",
  case: "di.reports.kindCase",
  person: "di.reports.kindPerson",
  board: "di.reports.kindBoard",
  workspace: "di.reports.kindWorkspace",
  cases_csv: "di.reports.kindCasesCsv",
  persons_csv: "di.reports.kindPersonsCsv",
  other: "di.reports.kindOther",
};

const FORMAT_KIND_KEY: Record<DrugExportHistoryFormatKind, TranslationKey> = {
  print: "di.reports.formatPrint",
  csv: "di.reports.formatCsv",
  other: "di.reports.formatOther",
};

function formatHistoryWhen(iso: string, language: "th" | "en"): string {
  return new Date(iso).toLocaleString(language === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(-8);
}

export function DrugReportingCenter() {
  const { user, can } = useAuth();
  const { t, language } = useT();
  const queryClient = useQueryClient();
  const canExport = can("drug.export");
  const actorId = user?.id ?? null;

  const [caseDraft, setCaseDraft] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [personDraft, setPersonDraft] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState<{ id: string; caseNumber: string; personCount: number; seizedItemCount: number } | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
    caseCount: number;
    phoneCount: number;
  } | null>(null);
  const [caseReportOpen, setCaseReportOpen] = useState(false);
  const [personReportOpen, setPersonReportOpen] = useState(false);
  const [casesCsvOpen, setCasesCsvOpen] = useState(false);
  const [personsCsvOpen, setPersonsCsvOpen] = useState(false);
  const [personsCsvQuery, setPersonsCsvQuery] = useState("");

  const cases = useDrugCases(canExport ? actorId : null, {
    page: 1,
    pageSize: PICKER_PAGE_SIZE,
    query: caseQuery || undefined,
  });
  const persons = useDrugPersonAdvancedSearch(canExport ? actorId : null, {
    page: 1,
    pageSize: PICKER_PAGE_SIZE,
    query: personQuery || undefined,
    sort: personQuery.trim() ? "RELEVANCE" : "NAME_ASC",
  });
  const history = useDrugExportHistory(canExport ? actorId : null);

  function refreshHistory() {
    if (!actorId) return;
    void queryClient.invalidateQueries({ queryKey: drugQueryKeys.exportHistory(actorId) });
  }

  const historyItems = useMemo(() => history.data?.items ?? [], [history.data]);

  if (!canExport) {
    return (
      <div className="min-w-0 max-w-full overflow-x-hidden">
        <PageHeader title={t("di.reports.title")} description={t("di.reports.forbidden")} />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden" data-testid="reports-center">
      <PageHeader title={t("di.reports.title")} description={t("di.reports.description")} />

      <section aria-labelledby="reports-live-heading" className="space-y-3">
        <h2 id="reports-live-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t("di.reports.liveSection")}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card data-testid="report-card-commander">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.reports.commanderTitle")}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">{t("di.reports.commanderBody")}</p>
              <Button asChild size="sm">
                <Link href="/drug-intelligence/command">{t("di.reports.openCommander")}</Link>
              </Button>
            </CardBody>
          </Card>

          <Card data-testid="report-card-case">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.reports.caseTitle")}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">{t("di.reports.caseBody")}</p>
              <form
                className="flex min-w-0 flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  setCaseQuery(caseDraft.trim());
                  setSelectedCase(null);
                }}
              >
                <input
                  type="search"
                  value={caseDraft}
                  onChange={(e) => setCaseDraft(e.target.value)}
                  placeholder={t("di.reports.caseSearchPlaceholder")}
                  aria-label={t("di.reports.caseSearchPlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm" variant="outline">
                  <ScanSearch className="h-4 w-4" aria-hidden="true" />
                  {t("di.reports.search")}
                </Button>
              </form>
              {cases.isPending ? (
                <LoadingState rows={3} />
              ) : cases.isError ? (
                <ErrorState message={(cases.error as Error).message} onRetry={() => cases.refetch()} />
              ) : cases.data && cases.data.rows.length === 0 ? (
                <p className="text-sm text-muted">{t("di.reports.caseEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {cases.data?.rows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          selectedCase?.id === row.id ? "border-accent bg-accent/10" : "border-border bg-background"
                        }`}
                        onClick={() =>
                          setSelectedCase({
                            id: row.id,
                            caseNumber: row.caseNumber,
                            personCount: row.personCount,
                            seizedItemCount: row.seizedItemCount,
                          })
                        }
                      >
                        <span className="block font-medium text-foreground">{row.caseNumber}</span>
                        <span className="block text-muted">
                          {row.title}
                          {row.province ? ` · ${row.province}` : ""}
                          {` · ${row.status}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!selectedCase}
                onClick={() => setCaseReportOpen(true)}
                data-testid="open-case-report"
              >
                {t("di.reports.openCaseReport")}
              </Button>
            </CardBody>
          </Card>

          <Card data-testid="report-card-person">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.reports.personTitle")}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">{t("di.reports.personBody")}</p>
              <form
                className="flex min-w-0 flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPersonQuery(personDraft.trim());
                  setSelectedPerson(null);
                }}
              >
                <input
                  type="search"
                  value={personDraft}
                  onChange={(e) => setPersonDraft(e.target.value)}
                  placeholder={t("di.reports.personSearchPlaceholder")}
                  aria-label={t("di.reports.personSearchPlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" size="sm" variant="outline">
                  <ScanSearch className="h-4 w-4" aria-hidden="true" />
                  {t("di.reports.search")}
                </Button>
              </form>
              {persons.isPending ? (
                <LoadingState rows={3} />
              ) : persons.isError ? (
                <ErrorState message={(persons.error as Error).message} onRetry={() => persons.refetch()} />
              ) : persons.data && persons.data.items.length === 0 ? (
                <p className="text-sm text-muted">{t("di.reports.personEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {persons.data?.items.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                          selectedPerson?.id === row.id ? "border-accent bg-accent/10" : "border-border bg-background"
                        }`}
                        onClick={() =>
                          setSelectedPerson({
                            id: row.id,
                            name: row.primaryFullName,
                            caseCount: row.caseCount,
                            phoneCount: row.phoneCount,
                          })
                        }
                      >
                        <span className="block font-medium text-foreground">{row.primaryFullName}</span>
                        <span className="block text-muted">
                          {row.nickname ? `${row.nickname} · ` : ""}
                          {row.status}
                          {` · ${t("di.reports.personCaseCount").replace("{count}", String(row.caseCount))}`}
                          {` · ${t("di.reports.recordId")} ${shortId(row.id)}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!selectedPerson}
                onClick={() => setPersonReportOpen(true)}
                data-testid="open-person-report"
              >
                {t("di.reports.openPersonReport")}
              </Button>
            </CardBody>
          </Card>

          <Card data-testid="report-card-board">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.reports.boardTitle")}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">{t("di.reports.boardBody")}</p>
              <Button asChild size="sm">
                <Link href="/drug-intelligence/network">{t("di.reports.openBoard")}</Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      </section>

      <section aria-labelledby="reports-export-heading" className="space-y-3">
        <h2 id="reports-export-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t("di.reports.exportSection")}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card data-testid="export-card-cases">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.reports.casesCsvTitle")}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">{t("di.reports.casesCsvBody")}</p>
              <Button type="button" size="sm" onClick={() => setCasesCsvOpen(true)} data-testid="open-cases-csv">
                {t("di.reports.openCasesCsv")}
              </Button>
            </CardBody>
          </Card>

          <Card data-testid="export-card-persons">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.reports.personsCsvTitle")}
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">{t("di.reports.personsCsvBody")}</p>
              <label className="block text-xs font-medium text-muted" htmlFor="persons-csv-query">
                {t("di.reports.personsCsvQueryLabel")}
              </label>
              <input
                id="persons-csv-query"
                type="search"
                value={personsCsvQuery}
                onChange={(e) => setPersonsCsvQuery(e.target.value)}
                placeholder={t("di.reports.personsCsvQueryPlaceholder")}
                className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <Button type="button" size="sm" onClick={() => setPersonsCsvOpen(true)} data-testid="open-persons-csv">
                {t("di.reports.openPersonsCsv")}
              </Button>
            </CardBody>
          </Card>
        </div>
      </section>

      <section aria-labelledby="reports-history-heading" className="space-y-3">
        <h2 id="reports-history-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t("di.reports.historySection")}
        </h2>
        <Card>
          <CardBody data-testid="export-history">
            {history.isPending ? (
              <LoadingState rows={4} />
            ) : history.isError ? (
              <ErrorState message={(history.error as Error).message} onRetry={() => history.refetch()} />
            ) : historyItems.length === 0 ? (
              <EmptyState title={t("di.reports.historyEmpty")} />
            ) : (
              <ul className="divide-y divide-border">
                {historyItems.map((item) => (
                  <HistoryRow key={item.id} item={item} language={language} t={t} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="reports-soon-heading" className="space-y-3">
        <h2 id="reports-soon-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t("di.reports.soonSection")}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card data-testid="coming-soon-map">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.reports.mapTitle")}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-muted">{t("di.reports.notReady")}</p>
            </CardBody>
          </Card>
          <Card data-testid="coming-soon-alerts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("di.reports.alertsTitle")}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-muted">{t("di.reports.notReady")}</p>
            </CardBody>
          </Card>
        </div>
      </section>

      <DrugCaseListExportDrawer
        open={casesCsvOpen}
        onClose={() => setCasesCsvOpen(false)}
        filters={{}}
        onGenerated={refreshHistory}
      />
      <DrugPersonListExportDrawer
        open={personsCsvOpen}
        onClose={() => setPersonsCsvOpen(false)}
        filters={{ searchQuery: personsCsvQuery.trim() || undefined }}
        onGenerated={refreshHistory}
      />
      {selectedCase ? (
        <DrugCaseReportDrawer
          open={caseReportOpen}
          onClose={() => setCaseReportOpen(false)}
          caseId={selectedCase.id}
          caseNumber={selectedCase.caseNumber}
          personCount={selectedCase.personCount}
          phoneCount={0}
          simCount={0}
          deviceCount={0}
          vehicleCount={0}
          seizedCount={selectedCase.seizedItemCount}
          unitCount={0}
          onGenerated={refreshHistory}
        />
      ) : null}
      {selectedPerson ? (
        <DrugPersonReportDrawer
          open={personReportOpen}
          onClose={() => setPersonReportOpen(false)}
          personId={selectedPerson.id}
          personName={selectedPerson.name}
          caseCount={selectedPerson.caseCount}
          phoneCount={selectedPerson.phoneCount}
          simCount={0}
          deviceCount={0}
          vehicleCount={0}
          onGenerated={refreshHistory}
        />
      ) : null}
    </div>
  );
}

function HistoryRow({
  item,
  language,
  t,
}: {
  item: DrugExportHistoryItem;
  language: "th" | "en";
  t: (key: TranslationKey) => string;
}) {
  return (
    <li className="py-3 first:pt-0 last:pb-0" data-testid="export-history-row">
      <p className="font-medium text-foreground">{t(REPORT_KIND_KEY[item.reportKind])}</p>
      <p className="text-sm text-muted">
        {formatHistoryWhen(item.createdAt, language)}
        {item.recordCount != null ? ` · ${t("di.reports.recordCount").replace("{count}", String(item.recordCount))}` : ""}
        {` · ${t(FORMAT_KIND_KEY[item.formatKind])}`}
      </p>
    </li>
  );
}
