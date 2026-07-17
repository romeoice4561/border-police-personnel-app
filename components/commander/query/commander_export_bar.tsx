/**
 * CommanderExportBar (Phase 43 Workstream A, Task A7).
 *
 * Replaces the previous non-functional disabled Excel/PDF/CSV button stub.
 * "Excel" downloads a CSV built by lib/commander_query/commander_export.ts
 * (Excel-openable, RFC 4180 + UTF-8 BOM for correct Thai rendering) over the
 * CURRENTLY-FILTERED result set. "Print" opens the browser's native print
 * dialog (the page's print stylesheet governs layout — no separate render
 * path). PDF export is NOT implemented — documented as future work
 * (docs/COMMANDER_SEARCH_INTELLIGENCE.md).
 */
"use client";

import { buildCommanderExportCsv, type CommanderExportMeta } from "@/lib/commander_query/commander_export";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

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

export function CommanderExportBar({
  officers,
  meta,
}: {
  officers: CommanderQueryOfficer[];
  meta: CommanderExportMeta;
}) {
  const { t } = useT();

  function handleExcelExport() {
    const csv = buildCommanderExportCsv(officers, meta);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `commander-search-${today}.csv`);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("common.export")}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExcelExport} disabled={officers.length === 0}>
            Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handlePrint} disabled={officers.length === 0}>
            {t("commander.print")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            PDF
          </Button>
        </div>
        <p className="text-xs text-muted">{t("commander.exportPdfFutureWork")}</p>
      </CardBody>
    </Card>
  );
}
