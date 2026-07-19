"use client";

import type { OfficerFlag, OfficerPriority, PromotionStatus, RetirementStatus } from "@/lib/intelligence";
import { PROMOTION_STATUS_KEY, RETIREMENT_STATUS_KEY, PRIORITY_KEY, FLAG_KEY } from "@/lib/intelligence/commander_intelligence_copy";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";

type Tone = "good" | "warning" | "serious" | "critical" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "border-good/30 bg-good-bg text-good",
  warning: "border-warning/30 bg-warning-bg text-warning",
  serious: "border-serious/30 bg-serious-bg text-serious",
  critical: "border-critical/30 bg-critical-bg text-critical",
  neutral: "border-border bg-neutral-bg text-foreground",
};

function Badge({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone], className)}>
      {label}
    </span>
  );
}

const PROMOTION_STATUS_TONE: Record<PromotionStatus, Tone> = {
  eligible: "good",
  near_eligible: "warning",
  not_eligible: "serious",
  unknown: "neutral",
};

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  const { t } = useT();
  return <Badge label={t(PROMOTION_STATUS_KEY[status])} tone={PROMOTION_STATUS_TONE[status]} />;
}

const RETIREMENT_STATUS_TONE: Record<RetirementStatus, Tone> = {
  normal: "neutral",
  retiring_within_2_years: "serious",
  retiring_within_1_year: "critical",
  retired: "critical",
  unknown: "neutral",
};

export function RetirementStatusBadge({ status }: { status: RetirementStatus }) {
  const { t } = useT();
  return <Badge label={t(RETIREMENT_STATUS_KEY[status])} tone={RETIREMENT_STATUS_TONE[status]} />;
}

const PRIORITY_TONE: Record<OfficerPriority, Tone> = {
  low: "neutral",
  medium: "warning",
  high: "serious",
  critical: "critical",
};

export function PriorityBadge({ priority }: { priority: OfficerPriority }) {
  const { t } = useT();
  return <Badge label={t(PRIORITY_KEY[priority])} tone={PRIORITY_TONE[priority]} />;
}

export function FlagBadge({ flag }: { flag: OfficerFlag }) {
  const { t } = useT();
  const tone: Record<OfficerFlag["severity"], Tone> = {
    info: "good",
    warning: "warning",
    serious: "serious",
    critical: "critical",
  };
  return <Badge label={t(FLAG_KEY[flag.code])} tone={tone[flag.severity]} />;
}
