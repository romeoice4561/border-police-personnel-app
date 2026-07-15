import type { OfficerWithRelations } from "@/lib/database/query_types";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { buildOfficerPromotionCycleDisplay } from "@/lib/promotion_cycle/service";
import {
  formatAppointmentCycle,
  formatCompletedCyclesCount,
  formatEligibleOverdueYears,
  formatEligibleSinceCycle,
  formatPromotionOverdueLabel,
  formatReadyForLevelLabel,
} from "@/lib/promotion_cycle/display";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{display}</dd>
    </div>
  );
}

/** Phase 42B: current-position promotion cycle summary using police appointment-cycle terminology. */
export function PromotionCycleSection({ officer }: { officer: OfficerWithRelations }) {
  const summary = buildOfficerPromotionCycleDisplay(officer);

  if (!summary) {
    return (
      <EditableSectionCard title="Promotion Cycle / วาระแต่งตั้ง">
        <p className="text-sm text-muted">ไม่สามารถคำนวณวาระแต่งตั้งได้ — ตรวจสอบ Career Timeline</p>
      </EditableSectionCard>
    );
  }

  const overdueLabel =
    formatEligibleOverdueYears(summary.overdueCycles) ??
    formatPromotionOverdueLabel(summary.overdueCycles);
  const readyLabel = summary.readyLabel ?? (summary.targetLevel ? formatReadyForLevelLabel(summary.targetLevel) : null);

  return (
    <EditableSectionCard title="Promotion Cycle / วาระแต่งตั้ง">
      <dl className="grid grid-cols-2 gap-4">
        <Field label="Current Position Level / ระดับตำแหน่ง" value={summary.positionLevel} />
        <Field label="Current Position / ตำแหน่ง" value={summary.currentPosition} />
        <Field label="Appointment Cycle / รอบแต่งตั้ง" value={formatAppointmentCycle(summary.appointmentCycle)} />
        <Field label="Completed Cycles / ครบวาระ" value={formatCompletedCyclesCount(summary.completedCycles)} />
        <Field label="Eligible Since / ครบตั้งแต่" value={formatEligibleSinceCycle(summary.eligibleCycle)} />
        <Field label="Eligible Overdue / เกินกำหนด" value={overdueLabel} />
        <Field label="Target Position / ครบขึ้น" value={summary.targetLevel} />
        {summary.eligibleNow && readyLabel ? (
          <div className="col-span-2 rounded-lg border border-good/30 bg-good/5 px-3 py-2">
            <p className="text-sm font-semibold text-foreground">{readyLabel}</p>
            {summary.eligibleSinceLabel ? <p className="text-xs text-muted">Eligible Since {summary.eligibleSinceLabel}</p> : null}
            {overdueLabel ? <p className="text-xs text-muted">{overdueLabel}</p> : null}
          </div>
        ) : null}
      </dl>
    </EditableSectionCard>
  );
}
