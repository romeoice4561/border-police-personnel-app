"use client";

import Link from "next/link";
import type { ExecutiveReportViewModel } from "@/lib/commander_reports/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";

export function ReportsTable({ report }: { report: ExecutiveReportViewModel }) {
  const { language } = useT();

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle>
          {language === "en" ? "Report table" : "ตารางรายงาน"}
          <span className="ml-2 text-sm font-normal text-muted">
            ({report.resultCount.toLocaleString("th-TH")})
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="min-w-0 p-0">
        {report.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">
            {language === "en" ? "No rows for this report and filter scope." : "ไม่มีรายการตามเงื่อนไขรายงานในขอบเขตที่เลือก"}
          </p>
        ) : (
          <div className="max-h-[640px] min-w-0 max-w-full overflow-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-surface">
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                  {report.columns.map((col) => (
                    <th key={col.id} className="px-3 py-2.5">{col.labelTh}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.officerId} className="border-b border-border last:border-b-0 hover:bg-neutral-bg">
                    {report.columns.map((col, index) => (
                      <td key={col.id} className="px-3 py-2.5 text-sm text-foreground">
                        {index === 0 ? (
                          <Link href={row.href} className="font-medium text-accent hover:underline">
                            {row.cells[col.id] ?? "—"}
                          </Link>
                        ) : (
                          <span className="wrap-break-word">{row.cells[col.id] ?? "—"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
