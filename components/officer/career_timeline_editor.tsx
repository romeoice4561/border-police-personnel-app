/**
 * CareerTimelineEditor (Phase 23A — Officer Profile Workspace, Section 2).
 *
 * The editable counterpart to CareerTimelineSection (which remains read-only,
 * used when the workspace is not in edit mode). Supports add row / remove
 * row / edit row; Year and Rank are dropdowns (never free text — the spec
 * explicitly forbids "31"/"32" instead of "2531"/"2532"); Position is free
 * text; Unit is a Combobox (existing units suggested, but a brand-new value
 * is always allowed); Source ("ที่มาของข้อมูล") and สถานะ ("Verified") are
 * dropdowns. Drag-to-reorder is NOT implemented (spec marks it "Future").
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
import { YEAR_OPTIONS } from "@/lib/officer_profile/year_options";
import { TIMELINE_SOURCE_OPTIONS, TIMELINE_VERIFIED_OPTIONS } from "@/lib/officer_profile/timeline_status_options";
import { emptyTimelineRow, type TimelineDraftRow } from "@/components/officer/use_officer_workspace";

const YEAR_SELECT_OPTIONS = YEAR_OPTIONS.map((y) => ({ value: y, label: y }));
const RANK_SELECT_OPTIONS = RANK_OPTIONS.map((r) => ({ value: r, label: r }));
const SOURCE_SELECT_OPTIONS = TIMELINE_SOURCE_OPTIONS.map((s) => ({ value: s, label: s }));
const VERIFIED_SELECT_OPTIONS = TIMELINE_VERIFIED_OPTIONS.map((v) => ({ value: v, label: v }));

export interface CareerTimelineEditorProps {
  rows: TimelineDraftRow[];
  onChange: (rows: TimelineDraftRow[]) => void;
  /** Existing unit names across the officer's own timeline, for the Unit combobox's suggestions. */
  knownUnits: readonly string[];
}

export function CareerTimelineEditor({ rows, onChange, knownUnits }: CareerTimelineEditorProps) {
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
            <div key={row.key} className="grid grid-cols-1 gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-6">
              <LabeledField label="ปี">
                <Select
                  options={YEAR_SELECT_OPTIONS}
                  placeholder="เลือกปี"
                  value={row.year}
                  onChange={(e) => updateRow(row.key, { year: e.target.value })}
                  aria-label="ปี"
                />
              </LabeledField>

              <LabeledField label="ยศ">
                <Select
                  options={RANK_SELECT_OPTIONS}
                  placeholder="– ไม่ระบุ –"
                  value={row.rank}
                  onChange={(e) => updateRow(row.key, { rank: e.target.value })}
                  aria-label="ยศ"
                />
              </LabeledField>

              <LabeledField label="ตำแหน่ง" className="lg:col-span-2">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="เช่น ผบ.ร้อย"
                  value={row.position}
                  onChange={(e) => updateRow(row.key, { position: e.target.value })}
                  aria-label="ตำแหน่ง"
                />
              </LabeledField>

              <LabeledField label="หน่วย" className="lg:col-span-2">
                <Combobox
                  value={row.unit}
                  onChange={(value) => updateRow(row.key, { unit: value })}
                  suggestions={knownUnits}
                  placeholder="พิมพ์หรือเลือกหน่วย"
                  aria-label="หน่วย"
                />
              </LabeledField>

              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.key)}
                  aria-label="ลบแถวนี้"
                >
                  <Trash2 className="h-4 w-4 text-serious" aria-hidden="true" />
                </Button>
              </div>

              <LabeledField label="ที่มาของข้อมูล" className="lg:col-span-3">
                <Select
                  options={SOURCE_SELECT_OPTIONS}
                  placeholder="– ไม่ระบุ –"
                  value={row.source}
                  onChange={(e) => updateRow(row.key, { source: e.target.value })}
                  aria-label="ที่มาของข้อมูล"
                />
              </LabeledField>

              <LabeledField label="สถานะ" className="lg:col-span-3">
                <Select
                  options={VERIFIED_SELECT_OPTIONS}
                  value={row.verified}
                  onChange={(e) => updateRow(row.key, { verified: e.target.value })}
                  aria-label="สถานะ"
                />
              </LabeledField>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function LabeledField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
