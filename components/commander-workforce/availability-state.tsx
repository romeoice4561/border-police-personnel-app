/**
 * Renders MetricAvailability — never converts unavailable into zero.
 */
import type { MetricAvailability } from "@/lib/commander_workforce/types";
import { cn } from "@/lib/ui/cn";

const REASON_TH: Record<
  Extract<MetricAvailability, { status: "unavailable" }>["reason"],
  string
> = {
  SOURCE_NOT_IMPLEMENTED: "ยังไม่มีแหล่งข้อมูลในระบบ",
  INSUFFICIENT_DATA: "ข้อมูลไม่เพียงพอสำหรับการประเมิน",
  OUT_OF_SCOPE: "อยู่นอกขอบเขตการประเมิน",
  NOT_APPLICABLE: "ไม่สามารถใช้กับชุดข้อมูลนี้",
};

export function AvailabilityState({
  availability,
  className,
}: {
  availability: MetricAvailability;
  className?: string;
}) {
  if (availability.status === "available") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-muted",
        className
      )}
      title={REASON_TH[availability.reason]}
    >
      ยังประเมินไม่ได้ — {REASON_TH[availability.reason]}
    </span>
  );
}

export function formatAvailabilityReasonTh(availability: MetricAvailability): string | null {
  if (availability.status === "available") return null;
  return REASON_TH[availability.reason];
}
