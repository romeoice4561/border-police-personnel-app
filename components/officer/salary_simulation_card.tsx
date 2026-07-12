/**
 * SalarySimulationCard (Phase 28C — Career Intelligence Live Simulation).
 *
 * Presentational-only preview of career_salary_engine.ts's
 * evaluateTwoStepEligibility() result for the CURRENT (unsaved) draft rows
 * being edited in SalaryHistoryEditor. Exactly the same engine call as
 * SalaryEvaluationCard (Phase 28B) — the only difference is the input
 * (draft rows vs. persisted rows) and the visual treatment (orange border +
 * "Preview" badge, so a user editing history can never confuse this
 * simulation with the officer's actual current eligibility, which never
 * changes until Save). No database, no repository, no API — pure UI.
 */
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { EligibilityStatus, type EvaluationResult } from "@/lib/officer_profile/career_salary_engine";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_META: Record<
  EligibilityStatus,
  { icon: typeof CheckCircle2; iconClass: string; tone: NonNullable<BadgeProps["tone"]>; labelTh: string; labelEn: string }
> = {
  [EligibilityStatus.Eligible]: {
    icon: CheckCircle2,
    iconClass: "text-good",
    tone: "good",
    labelTh: "มีสิทธิ์ 2 ขั้น",
    labelEn: "Eligible",
  },
  [EligibilityStatus.NotEligible]: {
    icon: XCircle,
    iconClass: "text-critical",
    tone: "critical",
    labelTh: "ไม่มีสิทธิ์ 2 ขั้น",
    labelEn: "Not Eligible",
  },
  [EligibilityStatus.Unknown]: {
    icon: HelpCircle,
    iconClass: "text-warning",
    tone: "warning",
    labelTh: "ไม่สามารถระบุได้",
    labelEn: "Cannot determine",
  },
};

export function SalarySimulationCard({ result }: { result: EvaluationResult }) {
  const meta = STATUS_META[result.status];
  const Icon = meta.icon;

  return (
    <Card className="border-2 border-warning">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>จำลองผลการประเมิน พ.ศ. {result.yearBE} / Career Simulation</CardTitle>
        <Badge tone="warning">พรีวิว / Preview</Badge>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs font-medium text-muted">หากบันทึกตอนนี้ / If saved now</p>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 shrink-0 ${meta.iconClass}`} aria-hidden="true" />
          <Badge tone={meta.tone}>
            {meta.labelTh} / {meta.labelEn}
          </Badge>
        </div>
        <p className="text-sm text-muted">{result.reason}</p>
      </CardBody>
    </Card>
  );
}
