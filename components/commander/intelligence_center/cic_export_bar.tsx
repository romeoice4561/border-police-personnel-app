/**
 * CicExportBar (Phase 49B — Commander Intelligence Center).
 *
 * Mirrors components/commander/query/commander_export_bar.tsx's pattern
 * exactly: Excel downloads a CSV (Excel-openable, UTF-8 BOM, RFC 4180) of
 * the Executive Table; Print opens the browser's native print dialog. PDF
 * export is not implemented anywhere in this app yet (no PDF library
 * exists) — same documented future-work convention as Commander Search.
 */
"use client";

import { buildCommanderIntelligenceCenterCsv } from "@/lib/commander_intelligence_center/export_csv";
import type { CommanderIntelligenceCenterViewModel } from "@/lib/commander_intelligence_center/types";
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

export function CicExportBar({ center }: { center: CommanderIntelligenceCenterViewModel }) {
  const { t } = useT();

  function handleExcelExport() {
    const csv = buildCommanderIntelligenceCenterCsv(center, {
      titleTh: "รายงานศูนย์ข่าวกรองผู้บังคับบัญชา",
      generatedOnTh: `สร้างเมื่อ ${center.generatedAtIso}`,
      resultCount: center.executiveTable.length,
    });
    downloadCsv(csv, `commander-intelligence-${center.generatedAtIso}.csv`);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("cic.export.title")}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExcelExport} disabled={center.executiveTable.length === 0}>
            {t("cic.export.excel")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handlePrint} disabled={center.executiveTable.length === 0}>
            {t("commander.print")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            PDF
          </Button>
        </div>
        <p className="text-xs text-muted">{t("cic.export.pdfFutureWork")}</p>
      </CardBody>
    </Card>
  );
}
