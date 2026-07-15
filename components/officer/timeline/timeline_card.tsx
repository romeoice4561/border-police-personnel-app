/**
 * TimelineCard (Phase 45 — Timeline Workspace UX, Part 1–12).
 *
 * ONE Timeline record rendered as a clearly-separated, collapsible card. The
 * always-visible TimelineHeader lets a user identify the entry without opening
 * it; the collapsible body holds the SAME fields the old flat editor had —
 * moved here verbatim, no field/business-logic change. Alternating background,
 * strong border, and hover/focus highlighting make each record obvious (Part
 * 4/10). The current-position entry is forced expanded and gets a stronger
 * success accent (Part 3).
 *
 * Part 6: exactly ONE verification control in edit mode (the structured
 * verificationStatus). Changing it also syncs the legacy `verified` column via
 * the parent's updateRow (see the onChange below) — no DB/API change.
 *
 * Pure controlled component: all state (the draft row) and mutations come from
 * the parent editor via props. Only local UI state is the collapse flag, owned
 * by the parent so "current is always open" is enforced consistently.
 */
"use client";

import type { TimelineDraftRow } from "@/components/officer/use_officer_workspace";
import type { TimelineCardStatus } from "@/lib/officer_profile/timeline_ux";
import { legacyVerifiedFromStatus } from "@/lib/officer_profile/timeline_ux";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ThaiDatePicker } from "@/components/ui/thai_date_picker";
import { formatThaiDate } from "@/lib/officer_profile/thai_date";
import { OrgHierarchyPicker } from "@/components/officer/org_hierarchy_picker";
import { RANK_OPTIONS } from "@/lib/officer_profile/rank_options";
import { POSITION_OPTIONS } from "@/lib/officer_profile/position_options";
import { TIMELINE_SOURCE_OPTIONS } from "@/lib/officer_profile/timeline_status_options";
import { VERIFIED_BY_OPTIONS } from "@/lib/officer_profile/verification_options";
import { TimelineHeader } from "@/components/officer/timeline/timeline_header";
import { TimelineActions } from "@/components/officer/timeline/timeline_actions";
import { TimelineVerificationBadge } from "@/components/officer/timeline/timeline_verification_badge";
import {
  DAY_SELECT_OPTIONS,
  MONTH_SELECT_OPTIONS,
  YEAR_BE_SELECT_OPTIONS,
  POSITION_LEVEL_SELECT_OPTIONS,
  VERIFICATION_STATUS_SELECT_OPTIONS,
} from "@/components/officer/timeline/timeline_field_options";

export interface TimelineCardProps {
  row: TimelineDraftRow;
  index: number;
  total: number;
  status: TimelineCardStatus;
  expanded: boolean;
  organizationEngine: OrganizationEngine;
  unitNameSuggestions: readonly string[];
  onToggle: () => void;
  onUpdate: (patch: Partial<TimelineDraftRow>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** Derives the header's date / position / unit summary lines from the draft row. */
function summarize(row: TimelineDraftRow, t: (k: "timeline.noDate" | "timeline.noPosition" | "timeline.noUnit") => string): {
  date: string;
  position: string;
  unit: string;
} {
  const date = row.yearBE != null || row.isPresent ? formatThaiDate(row) : row.year.trim() || t("timeline.noDate");
  const position = row.position.trim() || t("timeline.noPosition");
  const unit =
    (row.companyText || row.battalionText || row.regionText || row.headquartersText || row.unit).trim() || t("timeline.noUnit");
  return { date, position, unit };
}

export function TimelineCard({
  row,
  index,
  total,
  status,
  expanded,
  organizationEngine,
  unitNameSuggestions,
  onToggle,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: TimelineCardProps) {
  const { t } = useT();
  const bodyId = `timeline-body-${row.key}`;
  const summary = summarize(row, t);

  // Part 4: alternating background (token colors — light + dark safe). Part 3/6:
  // the current entry gets a STRONGER success accent — a thicker success border,
  // a success tint, and a success ring so it clearly stands out from the rest.
  const altBg = index % 2 === 0 ? "bg-surface" : "bg-neutral-bg/40";
  const cardTone = row.isPresent
    ? "border-good bg-good-bg/40 ring-1 ring-good/40"
    : `border-border ${altBg}`;

  return (
    <div
      className={cn(
        "rounded-xl border-2 p-4 transition-all sm:p-5",
        cardTone,
        // Part 10: hover + focus-within highlight the whole card (subtle lift).
        "hover:border-accent/60 hover:shadow-md focus-within:border-accent"
      )}
    >
      <TimelineHeader
        index={index}
        total={total}
        dateSummary={summary.date}
        positionSummary={summary.position}
        unitSummary={summary.unit}
        isPresent={row.isPresent}
        status={status}
        expanded={expanded}
        bodyId={bodyId}
        onToggle={onToggle}
      />

      {expanded ? (
        <div id={bodyId} className="mt-4 space-y-3 border-t border-border pt-4">
          {/* Structured Day / Month / Year(B.E.) + Appointment Cycle + Present. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-12">
            <LabeledField label="วัน" className="lg:col-span-2">
              <Select
                options={DAY_SELECT_OPTIONS}
                value={row.day != null ? String(row.day) : ""}
                onChange={(e) => onUpdate({ day: e.target.value ? Number(e.target.value) : null })}
                disabled={row.isPresent}
                aria-label="วัน"
              />
            </LabeledField>

            <LabeledField label="เดือน" className="lg:col-span-3">
              <Select
                options={MONTH_SELECT_OPTIONS}
                value={row.month != null ? String(row.month) : ""}
                onChange={(e) => onUpdate({ month: e.target.value ? Number(e.target.value) : null })}
                disabled={row.isPresent}
                aria-label="เดือน"
              />
            </LabeledField>

            <LabeledField label="ปี (พ.ศ.)" className="lg:col-span-3">
              <Select
                options={YEAR_BE_SELECT_OPTIONS}
                value={row.yearBE != null ? String(row.yearBE) : ""}
                onChange={(e) => {
                  const yearBE = e.target.value ? Number(e.target.value) : null;
                  onUpdate({ yearBE, appointmentCycle: row.appointmentCycle ?? yearBE });
                }}
                aria-label="ปี (พ.ศ.)"
              />
            </LabeledField>

            <LabeledField label="รอบแต่งตั้ง / Appointment Cycle" className="lg:col-span-2">
              <Select
                options={YEAR_BE_SELECT_OPTIONS}
                value={row.appointmentCycle != null ? String(row.appointmentCycle) : ""}
                onChange={(e) => onUpdate({ appointmentCycle: e.target.value ? Number(e.target.value) : null })}
                aria-label="รอบแต่งตั้ง"
              />
            </LabeledField>

            <LabeledField label="สถานะปัจจุบัน" className="lg:col-span-2">
              <label className="flex h-9.5 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={row.isPresent}
                  onChange={(e) => onUpdate({ isPresent: e.target.checked, day: e.target.checked ? null : row.day })}
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

          {/* Rank -> Position -> Position Level -> Data Source (order preserved). */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <LabeledField label="ยศ">
              <Combobox value={row.rank} onChange={(value) => onUpdate({ rank: value })} suggestions={RANK_OPTIONS} placeholder="เลือกหรือพิมพ์ยศ" aria-label="ยศ" />
            </LabeledField>

            <LabeledField label="ตำแหน่ง" className="lg:col-span-3">
              <Combobox value={row.position} onChange={(value) => onUpdate({ position: value })} suggestions={POSITION_OPTIONS} placeholder="เลือกหรือพิมพ์ตำแหน่ง" aria-label="ตำแหน่ง" />
            </LabeledField>

            <LabeledField label="ระดับตำแหน่ง / Position Level" className="lg:col-span-2">
              <Select options={POSITION_LEVEL_SELECT_OPTIONS} value={row.positionLevel} onChange={(e) => onUpdate({ positionLevel: e.target.value })} aria-label="ระดับตำแหน่ง" />
            </LabeledField>

            <LabeledField label="ที่มาของข้อมูล" className="lg:col-span-6">
              <Combobox value={row.source} onChange={(value) => onUpdate({ source: value })} suggestions={TIMELINE_SOURCE_OPTIONS} placeholder="เลือกหรือพิมพ์ที่มา" aria-label="ที่มาของข้อมูล" />
            </LabeledField>
          </div>

          {/* Structured organization hierarchy. */}
          <OrgHierarchyPicker
            organizationEngine={organizationEngine}
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
            onChange={(orgValue) => onUpdate(orgValue)}
          />

          {/* Legacy free-text unit name. */}
          <LabeledField label="ชื่อหน่วย (ข้อมูลเดิม)">
            <Combobox value={row.unit} onChange={(value) => onUpdate({ unit: value })} suggestions={unitNameSuggestions} placeholder="เช่น ร้อย ตชด.415" aria-label="ชื่อหน่วย" />
          </LabeledField>

          {/* Part 6: ONE verification control. Changing it syncs the legacy
              `verified` column too, so both DB fields stay consistent with no
              schema/API change. The verified triad lives at the END of the card. */}
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <LabeledField label={t("timeline.verificationStatus")}>
              <Select
                options={VERIFICATION_STATUS_SELECT_OPTIONS}
                value={row.verificationStatus}
                onChange={(e) => onUpdate({ verificationStatus: e.target.value, verified: legacyVerifiedFromStatus(e.target.value) })}
                aria-label={t("timeline.verificationStatus")}
              />
            </LabeledField>

            <LabeledField label={t("timeline.verifiedBy")}>
              <Combobox value={row.verifiedBy} onChange={(value) => onUpdate({ verifiedBy: value })} suggestions={VERIFIED_BY_OPTIONS} placeholder={t("timeline.verifiedBy")} aria-label={t("timeline.verifiedBy")} />
            </LabeledField>

            <LabeledField label={t("timeline.verifiedDate")}>
              <ThaiDatePicker value={row.verifiedDate} onChange={(value) => onUpdate({ verifiedDate: value })} placeholder="เลือกวันที่ (พ.ศ.)" aria-label={t("timeline.verifiedDate")} />
            </LabeledField>

            <LabeledField label={t("timeline.verificationRemark")}>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                rows={1}
                value={row.verificationRemark}
                onChange={(e) => onUpdate({ verificationRemark: e.target.value })}
                aria-label={t("timeline.verificationRemark")}
              />
            </LabeledField>
          </div>

          {/* Read-mode-style single verification badge + reorder/delete actions. */}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <TimelineVerificationBadge verificationStatus={row.verificationStatus} />
            <TimelineActions
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onDelete={onDelete}
            />
          </div>
        </div>
      ) : null}
    </div>
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
