"use client";

import { useMemo, useState } from "react";
import type { CommanderQueryDataset } from "@/lib/commander_query/types";
import { buildExecutiveReport } from "@/lib/commander_reports/build_report";
import type { ExecutiveReportType, ReportFilterState } from "@/lib/commander_reports/types";
import { useAuth } from "@/components/auth/auth_provider";
import { WorkspaceLayout } from "@/components/workspace/workspace_section";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import { ReportsTypeSelector } from "@/components/commander/reports/reports_type_selector";
import { ReportsFilterBar } from "@/components/commander/reports/reports_filter_bar";
import { ReportsBriefPanel } from "@/components/commander/reports/reports_brief_panel";
import { ReportsTable } from "@/components/commander/reports/reports_table";
import { ReportsCharts } from "@/components/commander/reports/reports_charts";
import { ReportsExportBar } from "@/components/commander/reports/reports_export_bar";
import { ReportsPrintChrome } from "@/components/commander/reports/reports_print_chrome";

export function ReportsWorkspace({
  dataset,
  asOfIso,
}: {
  dataset: CommanderQueryDataset;
  asOfIso: string;
}) {
  const { user } = useAuth();
  const { language, t } = useT();
  const asOf = useMemo(() => new Date(asOfIso), [asOfIso]);
  const [reportType, setReportType] = useState<ExecutiveReportType>("monthlyBrief");
  const [filters, setFilters] = useState<ReportFilterState>({});

  const report = useMemo(
    () =>
      buildExecutiveReport({
        type: reportType,
        officers: dataset.officers,
        options: dataset.options,
        filters,
        asOf,
        preparedByTh: user?.displayName ?? (language === "en" ? "Commander" : "ผู้บังคับบัญชา"),
      }),
    [reportType, dataset.officers, dataset.options, filters, asOf, user?.displayName, language]
  );

  return (
    <WorkspaceLayout className="min-w-0">
      <header className="print:hidden space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("reports.title")}</h1>
        <p className="text-sm text-muted">{t("reports.subtitle")}</p>
      </header>

      <ReportsTypeSelector value={reportType} onChange={setReportType} />
      <ReportsFilterBar options={dataset.options} value={filters} onChange={setFilters} asOf={asOf} />
      <ReportsExportBar report={report} />

      <ReportsPrintChrome report={report}>
        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {language === "en" ? "Executive KPI snapshot" : "ภาพรวมตัวชี้วัดผู้บริหาร"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {report.kpis.map((kpi) => (
                <div key={kpi.id} className="rounded-lg border border-border px-3 py-3">
                  <p className="text-xs text-muted">{kpi.labelTh}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {kpi.value.toLocaleString("th-TH")}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              {language === "en" ? "Executive recommendation" : "ข้อเสนอแนะผู้บริหาร"}
            </h2>
            <ul className="space-y-2">
              {report.recommendations.map((rec) => (
                <li
                  key={rec.textTh}
                  className={
                    rec.severity === "critical"
                      ? "text-sm font-medium text-serious"
                      : rec.severity === "warning"
                        ? "text-sm text-warning"
                        : "text-sm text-foreground/90"
                  }
                >
                  • {rec.textTh}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {(reportType === "monthlyBrief" || reportType === "personnelSummary" || reportType === "criticalAction") && (
          <ReportsBriefPanel brief={report.brief} />
        )}

        <div className="print:hidden">
          <ReportsCharts officers={report.officers} />
        </div>

        <ReportsTable report={report} />
      </ReportsPrintChrome>
    </WorkspaceLayout>
  );
}
