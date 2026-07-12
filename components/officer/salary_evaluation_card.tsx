/**
 * SalaryEvaluationCard (Phase 28B — Career Intelligence Engine).
 *
 * Presentational-only display of career_salary_engine.ts's
 * evaluateTwoStepEligibility() result for the CURRENT Buddhist-Era year —
 * status (🟢 Eligible / 🔴 Not Eligible / 🟡 Unknown) plus the human-readable
 * reason. No business logic lives here — this component only renders an
 * already-computed EvaluationResult, so the identical rule Dashboard/
 * Search/Reports/a future AI layer/Commander View use is what the officer
 * profile shows.
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
    labelEn: "Unknown",
  },
};

export function SalaryEvaluationCard({ result }: { result: EvaluationResult }) {
  const meta = STATUS_META[result.status];
  const Icon = meta.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ผลการประเมินสิทธิ์ 2 ขั้น พ.ศ. {result.yearBE} / Two-Step Eligibility</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
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
