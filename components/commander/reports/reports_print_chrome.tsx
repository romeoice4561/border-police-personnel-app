"use client";

import type { ReactNode } from "react";
import type { ExecutiveReportViewModel } from "@/lib/commander_reports/types";
import { buildReportPrintMeta } from "@/lib/commander_reports/export_print";

/**
 * Government cover + signature + confidential footer for print / Save as PDF.
 * Screen: compact cover. Print: full landscape presentation chrome.
 */
export function ReportsPrintChrome({
  report,
  children,
}: {
  report: ExecutiveReportViewModel;
  children: ReactNode;
}) {
  const meta = buildReportPrintMeta(report);

  return (
    <div className="reports-print-root space-y-6">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
          body { background: white !important; }
          .print\\:hidden, nav, aside { display: none !important; }
          .reports-print-root { color: #111; }
          .reports-print-cover { break-after: page; }
          .reports-print-signature { break-inside: avoid; margin-top: 2rem; }
        }
      `}</style>

      <header className="reports-print-cover rounded-xl border border-border bg-surface px-6 py-8 print:rounded-none print:border-2 print:px-10 print:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted print:text-sm">
          กองบัญชาการตำรวจตระเวนชายแดน
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground print:text-4xl">
          {meta.titleTh}
        </h1>
        <p className="mt-2 text-base text-muted print:text-lg">{meta.subtitleTh}</p>
        <dl className="mt-8 grid gap-3 text-sm sm:grid-cols-2 print:mt-10 print:text-base">
          <div>
            <dt className="text-muted">ขอบเขต</dt>
            <dd className="font-medium text-foreground">{meta.organizationScopeTh}</dd>
          </div>
          <div>
            <dt className="text-muted">ปีงบประมาณ</dt>
            <dd className="font-medium text-foreground">{meta.fiscalYearTh}</dd>
          </div>
          <div>
            <dt className="text-muted">วันที่จัดทำ</dt>
            <dd className="font-medium text-foreground">{meta.generatedDateTh}</dd>
          </div>
          <div>
            <dt className="text-muted">จัดทำโดย</dt>
            <dd className="font-medium text-foreground">{meta.preparedByTh}</dd>
          </div>
          <div>
            <dt className="text-muted">เวอร์ชันรายงาน</dt>
            <dd className="font-medium text-foreground">{meta.reportVersion}</dd>
          </div>
          <div>
            <dt className="text-muted">ชั้นความลับ</dt>
            <dd className="font-medium text-foreground">{meta.confidentialTh}</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-muted print:mt-8">{meta.landscapeHintTh}</p>
      </header>

      {children}

      <section className="reports-print-signature rounded-xl border border-border bg-surface px-6 py-6 print:rounded-none print:border print:px-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">ลายมือชื่อ</h2>
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          <div className="space-y-8">
            <p className="text-sm text-foreground">{meta.signaturePreparerTh}</p>
            <p className="text-xs text-muted">วันที่ ........../........../..........</p>
          </div>
          <div className="space-y-8">
            <p className="text-sm text-foreground">{meta.signatureCommanderTh}</p>
            <p className="text-xs text-muted">วันที่ ........../........../..........</p>
          </div>
        </div>
        <p className="mt-8 border-t border-border pt-4 text-center text-xs font-medium text-muted">
          {meta.confidentialTh}
        </p>
      </section>
    </div>
  );
}
