/**
 * SalaryHistoryEditor (Phase 28A — Career Intelligence Foundation; Phase 28C
 * — Live Simulation).
 *
 * Editable "ประวัติขั้นเงินเดือน" (Salary History) card: add / remove / edit
 * rows (ปี พ.ศ. dropdown, Salary Step dropdown, optional remarks). Pure
 * controlled component over the draft rows from useOfficerWorkspace — no
 * fetching, no save logic.
 *
 * Part 4 UX requirements: rows always display sorted descending by year
 * (current year first, then ย้อนหลัง); a duplicate year is flagged inline
 * (never silently overwritten or silently dropped — the user must resolve
 * it before it would fail the server's unique constraint on save).
 *
 * Phase 28C: renders a SalarySimulationCard beneath the row list, recomputed
 * on every render straight from the current draft `rows` via the SAME
 * evaluateTwoStepEligibility() engine SalaryEvaluationCard uses (no
 * duplicated logic) — since `onChange` always flows through React state,
 * every keystroke/add/remove already triggers a re-render, so the
 * simulation updates live with no extra effects or debouncing needed. This
 * is a preview only: nothing here reads or writes the database — the
 * persisted SalaryEvaluationCard (shown elsewhere while `editing`) never
 * changes until Save.
 */
"use client";

import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { sortHistory, evaluateTwoStepEligibility } from "@/lib/officer_profile/career_salary_engine";
import { SALARY_STEP_OPTIONS, defaultSalaryHistoryYearOptions } from "@/lib/officer_profile/salary_step_options";
import { emptySalaryHistoryRow, type SalaryHistoryDraftRow } from "@/components/officer/use_officer_workspace";
import { SalarySimulationCard } from "@/components/officer/salary_simulation_card";

/** Draft rows use string fields (Select-bound); only rows with both a year and a step selected are meaningful to evaluate — an untouched blank row is not a "missing year", it simply isn't part of the draft yet. Exported for testing. */
export function draftRowsForSimulation(rows: readonly SalaryHistoryDraftRow[]) {
  return rows
    .filter((r) => r.yearBE.trim() && r.salaryStep.trim())
    .map((r) => ({ yearBE: Number(r.yearBE), salaryStep: Number(r.salaryStep) }));
}

export interface SalaryHistoryEditorProps {
  rows: SalaryHistoryDraftRow[];
  onChange: (rows: SalaryHistoryDraftRow[]) => void;
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** Year dropdown: the default current-year-plus-3 range, plus any already-persisted year outside that range so an older row is never rendered as blank/unselectable. */
function yearOptionsFor(rows: readonly SalaryHistoryDraftRow[]): { value: string; label: string }[] {
  const defaults = defaultSalaryHistoryYearOptions();
  const persistedYears = rows.map((r) => Number(r.yearBE)).filter((y) => Number.isInteger(y));
  const allYears = Array.from(new Set([...defaults, ...persistedYears])).sort((a, b) => b - a);
  return allYears.map((y) => ({ value: String(y), label: `${y}` }));
}

const STEP_SELECT_OPTIONS = SALARY_STEP_OPTIONS.map((s) => ({ value: String(s), label: s.toFixed(1) }));

export function SalaryHistoryEditor({ rows, onChange }: SalaryHistoryEditorProps) {
  const yearOptions = yearOptionsFor(rows);
  const simulation = evaluateTwoStepEligibility(draftRowsForSimulation(rows));

  // Part 4: "No duplicate year" — every year value that appears on more than one row is flagged.
  const yearCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.yearBE) continue;
    yearCounts.set(row.yearBE, (yearCounts.get(row.yearBE) ?? 0) + 1);
  }
  const isDuplicateYear = (row: SalaryHistoryDraftRow) => row.yearBE !== "" && (yearCounts.get(row.yearBE) ?? 0) > 1;

  function updateRow(key: string, patch: Partial<SalaryHistoryDraftRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([...rows, emptySalaryHistoryRow()]);
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  // Part 4: "Years sorted descending" — display order always reflects the current draft values, not insertion order.
  const sortedKeys = sortHistory(rows.map((r) => ({ key: r.key, yearBE: Number(r.yearBE) || 0, salaryStep: 0 }))).map((r) => r.key);
  const sortedRows = sortedKeys.map((key) => rows.find((r) => r.key === key)!);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>ประวัติขั้นเงินเดือน / Salary History</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            เพิ่ม
          </Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {sortedRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">ยังไม่มีข้อมูลขั้นเงินเดือน — กด &quot;เพิ่ม&quot; เพื่อเริ่มกรอก</p>
          ) : (
            sortedRows.map((row) => (
              <div key={row.key} className="grid grid-cols-1 gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">ปี พ.ศ.</label>
                  <Select
                    options={yearOptions}
                    placeholder="เลือกปี"
                    value={row.yearBE}
                    onChange={(e) => updateRow(row.key, { yearBE: e.target.value })}
                    aria-label="ปี พ.ศ."
                    aria-invalid={isDuplicateYear(row)}
                  />
                  {isDuplicateYear(row) ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-serious">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      ปีนี้ถูกใช้แล้ว — กรุณาเลือกปีอื่น
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">ขั้นเงินเดือน</label>
                  <Select
                    options={STEP_SELECT_OPTIONS}
                    placeholder="เลือกขั้น"
                    value={row.salaryStep}
                    onChange={(e) => updateRow(row.key, { salaryStep: e.target.value })}
                    aria-label="ขั้นเงินเดือน"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted">หมายเหตุ</label>
                  <textarea
                    rows={2}
                    className={`${inputCls} resize-y`}
                    value={row.remarks}
                    onChange={(e) => updateRow(row.key, { remarks: e.target.value })}
                    aria-label="หมายเหตุ"
                  />
                </div>
                <div className="flex justify-end sm:col-span-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(row.key)}>
                    <Trash2 className="h-3.5 w-3.5 text-serious" aria-hidden="true" />
                    ลบ
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <SalarySimulationCard result={simulation} />
    </div>
  );
}
