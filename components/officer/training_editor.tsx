/**
 * TrainingEditor (Phase 23A — Officer Profile Workspace, Section 4).
 *
 * Editable Training card: add / remove / edit rows (year, course,
 * organizing unit, notes). Pure controlled component, mirrors EducationEditor.
 */
"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { emptyTrainingRow, type TrainingDraftRow } from "@/components/officer/use_officer_workspace";

export interface TrainingEditorProps {
  rows: TrainingDraftRow[];
  onChange: (rows: TrainingDraftRow[]) => void;
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function TrainingEditor({ rows, onChange }: TrainingEditorProps) {
  function updateRow(key: string, patch: Partial<TrainingDraftRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([...rows, emptyTrainingRow()]);
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Training</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          เพิ่ม
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">ยังไม่มีข้อมูลหลักสูตรฝึกอบรม — กด &quot;เพิ่ม&quot; เพื่อเริ่มกรอก</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className="grid grid-cols-1 gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">ปี</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="เช่น 2560"
                  value={row.year}
                  onChange={(e) => updateRow(row.key, { year: e.target.value })}
                  aria-label="ปี"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">หน่วยจัด</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="เช่น กองบัญชาการตำรวจตระเวนชายแดน"
                  value={row.organization}
                  onChange={(e) => updateRow(row.key, { organization: e.target.value })}
                  aria-label="หน่วยจัด"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-muted">หลักสูตร</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="เช่น หลักสูตรผู้บังคับหมู่"
                  value={row.course}
                  onChange={(e) => updateRow(row.key, { course: e.target.value })}
                  aria-label="หลักสูตร"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-muted">หมายเหตุ</label>
                <textarea
                  rows={2}
                  className={`${inputCls} resize-y`}
                  value={row.notes}
                  onChange={(e) => updateRow(row.key, { notes: e.target.value })}
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
  );
}
