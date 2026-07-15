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
  [EligibilityStatus.Unknown]: { icon: HelpCircle, iconClass: "text-warning", tone: "warning", labelKey: "officer.cannotDetermine" },
};

export function SalarySimulationCard({ result }: { result: EvaluationResult }) {
  const { t, language } = useT();
  const meta = STATUS_META[result.status];
  const Icon = meta.icon;

  return (
    <Card className="border-2 border-warning">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{t("officer.careerSimulation")} {formatLocalizedYearBE(result.yearBE, language)}</CardTitle>
        <Badge tone="warning">{t("officer.preview")}</Badge>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs font-medium text-muted">{t("officer.ifSavedNow")}</p>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 shrink-0 ${meta.iconClass}`} aria-hidden="true" />
          <Badge tone={meta.tone}>{t(meta.labelKey)}</Badge>
        </div>
        <p className="text-sm text-muted">{result.reason}</p>
      </CardBody>
    </Card>
  );
}
