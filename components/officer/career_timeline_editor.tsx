/**
 * CareerTimelineEditor (Phase 23A — Officer Profile Workspace, Section 2;
 * Phase 23B — preserve existing free-form values).
 *
 * The editable counterpart to CareerTimelineSection (which remains read-only,
 * used when the workspace is not in edit mode). Supports add row / remove
 * row / edit row.
 *
 * Phase 23B fix: Year / Rank / Source were fixed-option <Select> dropdowns.
 * That silently BLANKED any existing value not in the option list — e.g. an
 * imported year "2567-ปัจจุบัน" or a Thai-date "1 ก.พ. 2532" — so opening edit
 * mode and saving would DESTROY the real timeline data. They are now Combobox
 * fields: the standard options are still offered as suggestions for new rows,
 * but the existing free-form value is preserved and editable. Position is free
 * text; Unit is a Combobox against the cleaned unit list; สถานะ ("Verified")
 * stays a Select (its 3 values are a true closed set the UI itself controls).
 *
 * Pure controlled component: receives the draft rows + a setter from
 * useOfficerWorkspace, no fetching, no save logic of its own.
 */
"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { RANK_OPTIONS } from "@/lib/officer_profile/rank_options";
import { POSITION_OPTIONS } from "@/lib/officer_profile/position_options";
import { TIMELINE_SOURCE_OPTIONS, TIMELINE_VERIFIED_OPTIONS } from "@/lib/officer_profile/timeline_status_options";
import { MONTH_OPTIONS, YEAR_BE_OPTIONS, formatThaiDate } from "@/lib/officer_profile/thai_date";
import { emptyTimelineRow, type TimelineDraftRow } from "@/components/officer/use_officer_workspace";
import { OrgHierarchyPicker } from "@/components/officer/org_hierarchy_picker";
import type { OrgTree } from "@/lib/organization/org_tree";

const VERIFIED_SELECT_OPTIONS = TIMELINE_VERIFIED_OPTIONS.map((v) => ({ value: v, label: v }));

const DAY_SELECT_OPTIONS = [
  { value: "", label: "วัน" },
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
];
const MONTH_SELECT_OPTIONS = [{ value: "", label: "เดือน" }, ...MONTH_OPTIONS.map((m) => ({ value: String(m.value), label: m.label }))];
const YEAR_BE_SELECT_OPTIONS = [{ value: "", label: "พ.ศ." }, ...YEAR_BE_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))];

export interface CareerTimelineEditorProps {
  rows: TimelineDraftRow[];
  onChange: (rows: TimelineDraftRow[]) => void;
  /** Phase 26B Part C/D: the full Headquarters/Region/Battalion/Company snapshot for the org hierarchy pickers. */
  orgTree: OrgTree;
}

export function CareerTimelineEditor({ rows, onChange, orgTree }: CareerTimelineEditorProps) {
  function updateRow(key: string, patch: Partial<TimelineDraftRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([...rows, emptyTimelineRow()]);
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Career Timeline</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          เพิ่มแถว
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">ยังไม่มีข้อมูลประวัติการรับราชการ — กด &quot;เพิ่มแถว&quot; เพื่อเริ่มกรอก</p>
        ) : (
          rows.map((row) => (
            <div key={row.key} className="space-y-3 rounded-xl border border-border p-4">
              {/* Phase 26B Part 3: structured Day / Month(Thai) / Year(B.E.) + Present, the editor's primary date input. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-12">
                <LabeledField label="วัน" className="lg:col-span-2">
                  <Select
                    options={DAY_SELECT_OPTIONS}
                    value={row.day != null ? String(row.day) : ""}
                    onChange={(e) => updateRow(row.key, { day: e.target.value ? Number(e.target.value) : null })}
                    disabled={row.isPresent}
                    aria-label="วัน"
                  />
                </LabeledField>

                <LabeledField label="เดือน" className="lg:col-span-3">
                  <Select
                    options={MONTH_SELECT_OPTIONS}
                    value={row.month != null ? String(row.month) : ""}
                    onChange={(e) => updateRow(row.key, { month: e.target.value ? Number(e.target.value) : null })}
                    disabled={row.isPresent}
                    aria-label="เดือน"
                  />
                </LabeledField>

                <LabeledField label="ปี (พ.ศ.)" className="lg:col-span-3">
                  <Select
                    options={YEAR_BE_SELECT_OPTIONS}
                    value={row.yearBE != null ? String(row.yearBE) : ""}
                    onChange={(e) => updateRow(row.key, { yearBE: e.target.value ? Number(e.target.value) : null })}
                    aria-label="ปี (พ.ศ.)"
                  />
                </LabeledField>

                <LabeledField label="สถานะปัจจุบัน" className="lg:col-span-4">
                  <label className="flex h-9.5 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={row.isPresent}
                      onChange={(e) => updateRow(row.key, { isPresent: e.target.checked, day: e.target.checked ? null : row.day })}
                      aria-label="ปัจจุบัน (ยังดำรงตำแหน่งนี้อยู่)"
                    />
                    ปัจจุบัน (ยังดำรงตำแหน่งอยู่)
                  </label>
                </LabeledField>
              </div>

              {row.yearBE == null && row.year ? (
                <p className="text-xs text-muted">
                  ข้อมูลเดิม (ยังไม่ได้แปลงเป็นรูปแบบใหม่): <span className="font-medium text-foreground">{row.year}</span> — เลือกปี (พ.ศ.)
                  ด้านบนเพื่ออัปเดตเป็นรูปแบบโครงสร้างใหม่
                </p>
              ) : row.yearBE != null ? (
                <p className="text-xs text-muted">แสดงผล: {formatThaiDate(row)}</p>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <LabeledField label="ยศ">
                  <Combobox
                    value={row.rank}
                    onChange={(value) => updateRow(row.key, { rank: value })}
                    suggestions={RANK_OPTIONS}
                    placeholder="เลือกหรือพิมพ์ยศ"
                    aria-label="ยศ"
                  />
                </LabeledField>

                <LabeledField label="ตำแหน่ง" className="lg:col-span-3">
                  <Combobox
                    value={row.position}
                    onChange={(value) => updateRow(row.key, { position: value })}
                    suggestions={POSITION_OPTIONS}
                    placeholder="เลือกหรือพิมพ์ตำแหน่ง"
                    aria-label="ตำแหน่ง"
                  />
                </LabeledField>

                <LabeledField label="ที่มาของข้อมูล" className="lg:col-span-2">
                  <Combobox
                    value={row.source}
                    onChange={(value) => updateRow(row.key, { source: value })}
                    suggestions={TIMELINE_SOURCE_OPTIONS}
                    placeholder="เลือกหรือพิมพ์ที่มา"
                    aria-label="ที่มาของข้อมูล"
                  />
                </LabeledField>

                <LabeledField label="สถานะ" className="lg:col-span-2">
                  <Select
                    options={VERIFIED_SELECT_OPTIONS}
                    value={row.verified}
                    onChange={(e) => updateRow(row.key, { verified: e.target.value })}
                    aria-label="สถานะ"
                  />
                </LabeledField>

                <div className="flex items-end justify-end lg:col-span-4">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.key)} aria-label="ลบแถวนี้">
                    <Trash2 className="h-4 w-4 text-serious" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Phase 26B Part C: structured Headquarters / Border Patrol
                  Division / Battalion / Company hierarchy, replacing the
                  single free-text "หน่วย" field as the primary input. */}
              <OrgHierarchyPicker
                tree={orgTree}
                value={{
                  headquartersId: row.headquartersId,
                  headquartersText: row.headquartersText,
                  regionId: row.regionId,
                  regionText: row.regionText,
                  battalionId: row.battalionId,
                  battalionText: row.battalionText,
                  companyId: row.companyId,
                  companyText: row.companyText,
                }}
                onChange={(orgValue) => updateRow(row.key, orgValue)}
              />

              {!row.companyId && !row.battalionId && !row.regionId && !row.headquartersId && row.unit ? (
                <p className="text-xs text-muted">
                  ข้อมูลเดิม (ยังไม่ได้แปลงเป็นรูปแบบใหม่): <span className="font-medium text-foreground">{row.unit}</span> — เลือกหน่วยด้านบนเพื่ออัปเดตเป็นรูปแบบโครงสร้างใหม่
                </p>
              ) : null}
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

function LabeledField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
