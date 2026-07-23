"use client";

import type { CommanderQueryOptions } from "@/lib/commander_query/types";
import type { ReportFilterState } from "@/lib/commander_reports/types";
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";

const controlClass =
  "h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function ReportsFilterBar({
  options,
  value,
  onChange,
  asOf,
}: {
  options: CommanderQueryOptions;
  value: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  asOf: Date;
}) {
  const { t, language } = useT();
  const fy = computeFiscalYearSummary(asOf);
  const battalions = options.battalions.filter((b) => value.regionId == null || b.regionId === value.regionId);
  const companies = options.companies.filter((c) => value.battalionId == null || c.battalionId === value.battalionId);

  function set<K extends keyof ReportFilterState>(key: K, next: ReportFilterState[K]) {
    const draft: ReportFilterState = { ...value, [key]: next || undefined };
    if (key === "regionId") {
      delete draft.battalionId;
      delete draft.companyId;
    }
    if (key === "battalionId") delete draft.companyId;
    onChange(draft);
  }

  return (
    <Card className="print:hidden">
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {language === "en" ? "Report filters" : "ตัวกรองรายงาน"}
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})} aria-label={t("common.clearFilters")}>
            {t("common.clearFilters")}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Region" : "ภาค"}</span>
            <select className={controlClass} value={value.regionId ?? ""} onChange={(e) => set("regionId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              {options.regions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Battalion" : "กองกำกับการ"}</span>
            <select className={controlClass} value={value.battalionId ?? ""} onChange={(e) => set("battalionId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              {battalions.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Company" : "กองร้อย"}</span>
            <select className={controlClass} value={value.companyId ?? ""} onChange={(e) => set("companyId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Rank" : "ยศ"}</span>
            <select className={controlClass} value={value.rank ?? ""} onChange={(e) => set("rank", e.target.value || undefined)}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              {options.ranks.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Position level" : "ระดับตำแหน่ง"}</span>
            <select className={controlClass} value={value.positionLevel ?? ""} onChange={(e) => set("positionLevel", e.target.value || undefined)}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              {options.positionLevels.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Fiscal year (retirement)" : "ปีงบประมาณ (เกษียณ)"}</span>
            <select
              className={controlClass}
              value={value.fiscalYear ?? ""}
              onChange={(e) => set("fiscalYear", e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">{fy.displayFiscalYearTh} (+)</option>
              {[fy.fiscalYear - 1, fy.fiscalYear, fy.fiscalYear + 1, fy.fiscalYear + 2, fy.fiscalYear + 3].map((y) => (
                <option key={y} value={y}>{y + 543}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Priority" : "ความสำคัญ"}</span>
            <select className={controlClass} value={value.priority ?? ""} onChange={(e) => set("priority", (e.target.value || undefined) as ReportFilterState["priority"])}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              {options.priorities.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Document readiness" : "ความพร้อมเอกสาร"}</span>
            <select className={controlClass} value={value.readiness ?? ""} onChange={(e) => set("readiness", (e.target.value || undefined) as ReportFilterState["readiness"])}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              {["READY", "NEEDS_REVIEW", "INCOMPLETE", "BLOCKED", "UNKNOWN"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Document status" : "สถานะเอกสาร"}</span>
            <select className={controlClass} value={value.documentStatus ?? ""} onChange={(e) => set("documentStatus", (e.target.value || undefined) as ReportFilterState["documentStatus"])}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              <option value="missing">missing</option>
              <option value="expired">expired</option>
              <option value="warning">warning</option>
              <option value="complete">complete</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Training" : "การฝึกอบรม"}</span>
            <select className={controlClass} value={value.trainingStatus ?? ""} onChange={(e) => set("trainingStatus", (e.target.value || undefined) as ReportFilterState["trainingStatus"])}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              {["Complete", "MissingRequired", "ExpiringSoon", "Expired", "Unverified", "NoPolicy", "NoData", "Unknown"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>{language === "en" ? "Retirement" : "เกษียณ"}</span>
            <select className={controlClass} value={value.retirementWithin ?? ""} onChange={(e) => set("retirementWithin", (e.target.value || undefined) as ReportFilterState["retirementWithin"])}>
              <option value="">{language === "en" ? "All" : "ทั้งหมด"}</option>
              <option value="within-1-year">within 1 year</option>
              <option value="within-3-years">within 3 years</option>
              <option value="within-5-years">within 5 years</option>
            </select>
          </label>
        </div>
      </CardBody>
    </Card>
  );
}
