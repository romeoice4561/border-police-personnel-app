/**
 * SalaryHistorySection (Phase 28A — Career Intelligence Foundation).
 *
 * Read-only "ประวัติขั้นเงินเดือน" (Salary History) card: lists each
 * salary-history row (year, salary step, remarks), newest year first. The
 * editable counterpart is SalaryHistoryEditor, shown instead when the
 * workspace is in edit mode.
 *
 * This is a foundation-only display — no eligibility/warning/AI-suggestion
 * UI exists yet (Section 7 of the phase spec); future phases add that by
 * reading the same SalaryHistory rows via career_salary_engine.ts, without
 * needing to change this component.
 */
import { TrendingUp } from "lucide-react";
import type { SalaryHistory } from "@/lib/database/query_types";
import { sortHistory } from "@/lib/officer_profile/career_salary_engine";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";
import { Badge } from "@/components/ui/badge";

export function SalaryHistorySection({ salaryHistory }: { salaryHistory: SalaryHistory[] }) {
  const rows = sortHistory(salaryHistory);

  return (
    <EditableSectionCard title="ประวัติขั้นเงินเดือน / Salary History">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <TrendingUp className="h-8 w-8 text-muted" aria-hidden="true" />
          <SectionEmptyState message="ยังไม่มีประวัติขั้นเงินเดือน / No salary history yet." />
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium tabular-nums text-foreground">พ.ศ. {row.yearBE}</span>
                <Badge tone={row.salaryStep === 2 ? "good" : "default"}>{row.salaryStep.toFixed(1)} ขั้น</Badge>
              </div>
              {row.remarks ? <p className="mt-1 text-xs text-muted">{row.remarks}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </EditableSectionCard>
  );
}
