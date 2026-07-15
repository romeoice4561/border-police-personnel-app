/**
 * SalaryEvaluationCard (Phase 28B — Career Intelligence Engine; Phase 28C —
 * "Current Eligibility" title + accent border added to visually distinguish
 * it from SalarySimulationCard's unsaved-draft preview).
 *
 * Presentational-only display of career_salary_engine.ts's
 * evaluateTwoStepEligibility() result for the CURRENT Buddhist-Era year,
 * evaluated against PERSISTED salary history — status (🟢 Eligible / 🔴 Not
 * Eligible / 🟡 Unknown) plus the human-readable reason. No business logic
 * lives here — this component only renders an already-computed
 * EvaluationResult, so the identical rule Dashboard/Search/Reports/a future
 * AI layer/Commander View use is what the officer profile shows. Never
 * changes while the user edits — only after Save (see SalarySimulationCard).
 */
"use client";

import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { EligibilityStatus, type EvaluationResult } from "@/lib/officer_profile/career_salary_engine";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { formatLocalizedYearBE } from "@/lib/i18n/format_date";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_META: Record<
  EligibilityStatus,
  { icon: typeof CheckCircle2; iconClass: string; tone: NonNullable<BadgeProps["tone"]>; labelKey: TranslationKey }
> = {
  [EligibilityStatus.Eligible]: { icon: CheckCircle2, iconClass: "text-good", tone: "good", labelKey: "officer.twoStepEligible" },
  [EligibilityStatus.NotEligible]: { icon: XCircle, iconClass: "text-critical", tone: "critical", labelKey: "officer.twoStepNotEligible" },
  [EligibilityStatus.Unknown]: { icon: HelpCircle, iconClass: "text-warning", tone: "warning", labelKey: "officer.twoStepUnknown" },
};

export function SalaryEvaluationCard({ result }: { result: EvaluationResult }) {
  const { t, language } = useT();
  const meta = STATUS_META[result.status];
  const Icon = meta.icon;

  return (
    <Card className="border-2 border-accent">
      <CardHeader>
        <CardTitle>{t("officer.currentEligibility")} {formatLocalizedYearBE(result.yearBE, language)}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 shrink-0 ${meta.iconClass}`} aria-hidden="true" />
          <Badge tone={meta.tone}>{t(meta.labelKey)}</Badge>
        </div>
        <p className="text-sm text-muted">{result.reason}</p>
      </CardBody>
    </Card>
  );
}
