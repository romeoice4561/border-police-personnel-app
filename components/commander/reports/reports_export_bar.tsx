"use client";

import type { ExecutiveReportViewModel } from "@/lib/commander_reports/types";
import { buildExecutiveReportCsv, executiveReportCsvFilename } from "@/lib/commander_reports/export_csv";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReportsExportBar({ report }: { report: ExecutiveReportViewModel }) {
  const { t } = useT();

  return (
    <Card className="print:hidden">
      <CardBody className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs font-semibold uppercase tracking-wide text-muted">{t("reports.export")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(buildExecutiveReportCsv(report), executiveReportCsvFilename(report))}
        >
          {t("reports.excel")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          {t("reports.print")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled>
          PDF
        </Button>
        <p className="basis-full text-xs text-muted">{t("reports.pdfFutureWork")}</p>
      </CardBody>
    </Card>
  );
}
