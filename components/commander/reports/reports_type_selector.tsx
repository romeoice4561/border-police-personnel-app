"use client";

import { REPORT_CATALOG } from "@/lib/commander_reports/report_catalog";
import type { ExecutiveReportType } from "@/lib/commander_reports/types";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";

export function ReportsTypeSelector({
  value,
  onChange,
}: {
  value: ExecutiveReportType;
  onChange: (type: ExecutiveReportType) => void;
}) {
  const { language } = useT();

  return (
    <section aria-label="เลือกประเภทรายงาน" className="print:hidden">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        {language === "en" ? "Report type" : "ประเภทรายงาน"}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {REPORT_CATALOG.map((entry) => {
          const active = entry.type === value;
          return (
            <button
              key={entry.type}
              type="button"
              onClick={() => onChange(entry.type)}
              aria-pressed={active}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                active ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-accent"
              )}
            >
              <p className="text-sm font-semibold text-foreground">
                {language === "en" ? entry.titleEn : entry.titleTh}
              </p>
              <p className="mt-1 text-xs text-muted">
                {language === "en" ? entry.subtitleEn : entry.subtitleTh}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
