import type { OfficerFlag, OfficerPriority, PromotionStatus, RetirementStatus } from "@/lib/intelligence";
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

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  const meta: Record<PromotionStatus, { label: string; tone: Tone }> = {
    eligible: { label: "Promotion Ready", tone: "good" },
    near_eligible: { label: "Near Promotion", tone: "warning" },
    not_eligible: { label: "Not Eligible", tone: "serious" },
    unknown: { label: "Promotion Unknown", tone: "neutral" },
  };
  return <Badge {...meta[status]} />;
}

export function RetirementStatusBadge({ status }: { status: RetirementStatus }) {
  const meta: Record<RetirementStatus, { label: string; tone: Tone }> = {
    normal: { label: "Retirement Normal", tone: "neutral" },
    retiring_within_2_years: { label: "Retiring < 2 Years", tone: "serious" },
    retiring_within_1_year: { label: "Retiring < 1 Year", tone: "critical" },
    retired: { label: "Retired", tone: "critical" },
    unknown: { label: "Retirement Unknown", tone: "neutral" },
  };
  return <Badge {...meta[status]} />;
}

export function PriorityBadge({ priority }: { priority: OfficerPriority }) {
  const meta: Record<OfficerPriority, { label: string; tone: Tone }> = {
    low: { label: "Low Priority", tone: "neutral" },
    medium: { label: "Medium Priority", tone: "warning" },
    high: { label: "High Priority", tone: "serious" },
    critical: { label: "Critical Priority", tone: "critical" },
  };
  return <Badge {...meta[priority]} />;
}

export function FlagBadge({ flag }: { flag: OfficerFlag }) {
  const tone: Record<OfficerFlag["severity"], Tone> = {
    info: "good",
    warning: "warning",
    serious: "serious",
    critical: "critical",
  };
  return <Badge label={flag.label} tone={tone[flag.severity]} />;
}
