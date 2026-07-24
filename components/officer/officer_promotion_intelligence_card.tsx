/**
 * OfficerPromotionIntelligenceCard (Phase 49.12 / 49.12A).
 *
 * Commander-facing “สรุปความพร้อมเลื่อนระดับ”. Every display value comes from
 * buildPromotionPresentation — no promotion arithmetic in this component.
 * Phase 49.12A is visual polish only (hierarchy, timeline, spacing).
 */
import type { ReactNode } from "react";
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import {
  buildPromotionPresentation,
  type PromotionPresentationTone,
  type RequirementPresentationState,
  type TimelinePresentationState,
} from "@/lib/officer_intelligence/promotion_presentation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/cn";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  CircleAlert,
  CircleHelp,
  Clock3,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

function toneToBadge(tone: PromotionPresentationTone): "good" | "warning" | "serious" | "neutral" {
  return tone;
}

const TONE_TEXT: Record<PromotionPresentationTone, string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  neutral: "text-foreground",
};

const TONE_ICON: Record<PromotionPresentationTone, string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  neutral: "text-muted",
};

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium leading-snug text-foreground">
        {value ?? <span className="font-normal text-muted">—</span>}
      </dd>
    </div>
  );
}

function SectionLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-xs font-semibold tracking-wide text-muted">
      {children}
    </h3>
  );
}

/** Compact executive KPI tile — status-first hierarchy, equal height. */
function PromotionKpi({
  label,
  value,
  tone = "neutral",
  icon,
  subtitle,
  emphasize = false,
}: {
  label: string;
  value: string;
  tone?: PromotionPresentationTone;
  icon: ReactNode;
  subtitle?: string | null;
  /** Status KPI: value is the visual hero (not the percentage tile). */
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[7.25rem] flex-col rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors duration-200 hover:border-accent/35",
        emphasize && "ring-1 ring-accent/20"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("shrink-0", TONE_ICON[tone])} aria-hidden="true">
          {icon}
        </span>
        <p className="truncate text-[11px] font-medium tracking-wide text-muted">{label}</p>
      </div>
      <p
        className={cn(
          "mt-1.5 wrap-break-word leading-snug",
          emphasize
            ? // Status is the visual hero — readable Thai, semantic color + ring (not a giant %).
              cn("text-base font-semibold sm:text-[1.05rem]", TONE_TEXT[tone])
            : // Supporting metrics ~15% smaller than workspace text-2xl KPI default.
              cn("text-base font-semibold tabular-nums sm:text-lg", TONE_TEXT[tone])
        )}
      >
        {value}
      </p>
      {subtitle ? (
        <p className="mt-auto pt-1 text-[11px] leading-snug text-muted">{subtitle}</p>
      ) : (
        <span className="mt-auto" aria-hidden="true" />
      )}
    </div>
  );
}

function RequirementIcon({ state }: { state: RequirementPresentationState }) {
  if (state === "complete") {
    return <Check className="h-4 w-4 shrink-0 text-good" aria-hidden="true" />;
  }
  if (state === "blocked") {
    return <ShieldAlert className="h-4 w-4 shrink-0 text-serious" aria-hidden="true" />;
  }
  if (state === "missing") {
    return <CircleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />;
  }
  return <CircleHelp className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />;
}

function requirementStateAria(state: RequirementPresentationState): string {
  switch (state) {
    case "complete":
      return "ครบแล้ว";
    case "missing":
      return "ยังขาด";
    case "unknown":
      return "ยังไม่มีข้อมูลเพียงพอ";
    case "blocked":
      return "มีข้อจำกัด";
  }
}

function timelineStateLabel(state: TimelinePresentationState): string {
  switch (state) {
    case "past":
      return "ผ่านแล้ว";
    case "current":
      return "ปัจจุบัน";
    case "future":
      return "คาดการณ์";
    case "unknown":
      return "ไม่ทราบ";
  }
}

function MilestoneDot({ state }: { state: TimelinePresentationState }) {
  if (state === "current") {
    return (
      <span
        className="relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-surface shadow-[0_0_0_3px] shadow-accent/15"
        aria-hidden="true"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
    );
  }
  if (state === "future") {
    return (
      <span
        className="relative z-10 h-3 w-3 shrink-0 rounded-full border border-dashed border-muted bg-surface"
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className="relative z-10 h-3 w-3 shrink-0 rounded-full border border-border bg-muted/40"
      aria-hidden="true"
    />
  );
}

export function OfficerPromotionIntelligenceCard({ viewModel }: { viewModel: OfficerIntelligenceViewModel }) {
  const p = buildPromotionPresentation(viewModel);

  const readinessSubtitle =
    p.progressPercent == null
      ? "ประเมินจากข้อมูลระยะเวลาเท่านั้น"
      : p.progressPercent >= 100
        ? "ครบเกณฑ์ด้านระยะเวลา"
        : "ความพร้อมด้านระยะเวลา — ไม่ใช่โอกาสแต่งตั้ง";

  const allRequirementsComplete =
    p.requirementItems.length > 0 && p.requirementItems.every((i) => i.state === "complete");
  const showEmptyChecklist =
    (p.requirementsEmptyMessageTh != null && allRequirementsComplete) || p.requirementItems.length === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>สรุปความพร้อมเลื่อนระดับ</CardTitle>
        <p className="text-sm leading-snug text-muted">ข้อมูลสนับสนุนการพิจารณาเลื่อนระดับตำแหน่ง</p>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* 1. Compact KPI row — status is the visual hero */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <PromotionKpi
            label="สถานะ"
            value={p.kpiStatusLabelTh}
            tone={p.statusTone}
            emphasize
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
          />
          <PromotionKpi
            label="ครบคุณสมบัติครั้งแรก"
            value={p.kpiFirstEligibleYearLabel}
            tone="neutral"
            icon={<CalendarDays className="h-3.5 w-3.5" />}
          />
          <PromotionKpi
            label="ความพร้อมด้านระยะเวลา"
            value={p.kpiReadinessLabel}
            tone={p.progressPercent != null && p.progressPercent >= 100 ? "good" : "neutral"}
            icon={<Activity className="h-3.5 w-3.5" />}
            subtitle={readinessSubtitle}
          />
          <PromotionKpi
            label="ระยะเวลาที่เหลือ"
            value={p.kpiRemainingTenureLabel}
            tone="neutral"
            icon={<Clock3 className="h-3.5 w-3.5" />}
          />
        </div>

        {/* 2. Decision status */}
        <section aria-labelledby="promotion-decision-status" className="space-y-2">
          <h3 id="promotion-decision-status" className="sr-only">
            สถานะการพิจารณา
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={toneToBadge(p.statusTone)}>{p.statusLabelTh}</Badge>
            {p.targetLevelLabel ? (
              <span className="text-sm text-muted">เป้าหมาย: {p.targetLevelLabel}</span>
            ) : null}
          </div>
          <p className="text-base font-semibold leading-snug text-foreground">{p.statusHeadlineTh}</p>
          <p className="text-sm leading-relaxed text-foreground/90">{p.statusSummaryTh}</p>
        </section>

        {/* 3. Promotion path */}
        <section aria-labelledby="promotion-path" className="rounded-lg border border-border px-3 py-3">
          <SectionLabel id="promotion-path">เส้นทางเลื่อนระดับ</SectionLabel>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">ระดับตำแหน่งปัจจุบัน</p>
              <p className="wrap-break-word text-sm font-semibold leading-snug text-foreground">
                {p.currentLevelLabel ?? "—"}
              </p>
            </div>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted sm:block" aria-hidden="true" />
            <span className="text-muted sm:hidden" aria-hidden="true">
              ↓
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">เป้าหมายถัดไป</p>
              <p className="wrap-break-word text-sm font-semibold leading-snug text-foreground">
                {p.targetLevelLabel ?? "—"}
              </p>
            </div>
          </div>
        </section>

        {/* 4. Tenure progress — bar visually restrained */}
        <section aria-labelledby="promotion-tenure" className="space-y-4">
          <SectionLabel id="promotion-tenure">ความคืบหน้าด้านระยะเวลา</SectionLabel>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="เริ่มดำรงระดับนี้" value={p.positionLevelStartLabel} />
            <Fact label="ดำรงระดับมาแล้ว" value={p.completedTenureLabel} />
            <Fact label="เกณฑ์ขั้นต่ำ" value={p.requiredTenureLabel} />
            <Fact label="ระยะเวลาที่เหลือ" value={p.remainingTenureLabel} />
          </dl>
          {p.progressPercent != null && p.progressLabelTh != null ? (
            <div className="mx-auto w-[78%] max-w-xl space-y-1.5 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{p.progressLabelTh}</span>
                <span className="tabular-nums text-muted">{p.kpiReadinessLabel}</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-neutral-bg"
                role="progressbar"
                aria-label={`ความคืบหน้าด้านระยะเวลา ${p.progressLabelTh}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={p.progressPercent}
              >
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${p.progressPercent}%` }}
                />
              </div>
              <p className="text-center text-[11px] leading-snug text-muted">
                {p.progressPercent >= 100
                  ? "ครบเกณฑ์ด้านระยะเวลา — ไม่รับรองการแต่งตั้ง"
                  : "สัดส่วนระยะเวลาดำรงระดับเท่านั้น ไม่ใช่โอกาสได้รับการแต่งตั้ง"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">ความคืบหน้า: ประเมินไม่ได้</p>
          )}
        </section>

        {/* 5. Eligibility summary */}
        <section aria-labelledby="promotion-eligibility" className="space-y-2.5">
          <SectionLabel id="promotion-eligibility">สรุปคุณสมบัติ</SectionLabel>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="ครบคุณสมบัติครั้งแรก" value={p.firstEligibleYearLabel} />
            <Fact label="ปีที่มีสิทธิ์" value={p.eligibilityYearOrdinalLabel} />
            <Fact label="รอบการพิจารณา" value={p.appointmentRoundLabel} />
            <Fact label="ระยะเวลาที่รอ" value={p.waitingLabel} />
          </dl>
          {p.confidenceLabelTh ? (
            <p className="text-xs text-muted">ความน่าเชื่อถือของข้อมูล: {p.confidenceLabelTh}</p>
          ) : null}
        </section>

        {/* 6. Missing requirements */}
        <section aria-labelledby="promotion-requirements" className="space-y-2.5">
          <SectionLabel id="promotion-requirements">สิ่งที่ยังขาด</SectionLabel>
          {showEmptyChecklist ? (
            <p className="flex items-start gap-2 rounded-md px-1 py-0.5 text-sm text-foreground transition-colors duration-200 hover:bg-neutral-bg/60">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" />
              <span>
                <span className="sr-only">ครบแล้ว — </span>
                {p.requirementsEmptyMessageTh ?? "ไม่มีข้อจำกัดที่ระบบตรวจพบ"}
              </span>
            </p>
          ) : (
            <ul className="space-y-1">
              {p.requirementItems.map((item) => (
                <li
                  key={item.key}
                  className="flex items-start gap-2 rounded-md px-1 py-1 text-sm text-foreground transition-colors duration-200 hover:bg-neutral-bg/60"
                >
                  <RequirementIcon state={item.state} />
                  <span className="leading-snug">
                    <span className="sr-only">{requirementStateAria(item.state)} — </span>
                    {item.labelTh}
                    <span className="text-muted"> — {item.detailTh}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 7. Timeline — horizontal on xl, vertical otherwise */}
        <section aria-labelledby="promotion-timeline" className="space-y-3">
          <SectionLabel id="promotion-timeline">เส้นทางการเลื่อนระดับ</SectionLabel>

          {/* Desktop / wide: horizontal stepped timeline */}
          <ol className="hidden xl:grid xl:grid-cols-[repeat(auto-fit,minmax(0,1fr))] xl:gap-0">
            {p.timelineItems.map((item, index) => (
              <li
                key={`h-${item.key}`}
                className="group relative flex min-w-0 flex-col items-center px-2 text-center transition-colors duration-200"
              >
                <div className="relative mb-2 flex w-full items-center justify-center">
                  {index > 0 ? (
                    <span className="absolute top-1/2 right-1/2 left-0 h-px -translate-y-1/2 bg-border" aria-hidden="true" />
                  ) : null}
                  {index < p.timelineItems.length - 1 ? (
                    <span className="absolute top-1/2 right-0 left-1/2 h-px -translate-y-1/2 bg-border" aria-hidden="true" />
                  ) : null}
                  <MilestoneDot state={item.state} />
                </div>
                <p className="text-[11px] font-semibold text-muted group-hover:text-foreground">
                  {item.yearLabel}
                  <span className="ml-1 font-normal">({timelineStateLabel(item.state)})</span>
                </p>
                <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{item.titleTh}</p>
                {item.detailTh ? <p className="mt-0.5 text-[11px] leading-snug text-muted">{item.detailTh}</p> : null}
              </li>
            ))}
          </ol>

          {/* Mobile / tablet: vertical timeline */}
          <ol className="space-y-0 xl:hidden">
            {p.timelineItems.map((item, index) => (
              <li
                key={`v-${item.key}`}
                className="group relative flex gap-3 rounded-md pb-4 transition-colors duration-200 last:pb-0 hover:bg-neutral-bg/40"
              >
                {index < p.timelineItems.length - 1 ? (
                  <span className="absolute top-3 bottom-0 left-[5px] w-px bg-border" aria-hidden="true" />
                ) : null}
                <div className="mt-1 flex w-3.5 shrink-0 justify-center">
                  <MilestoneDot state={item.state} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-xs font-semibold text-muted">
                    {item.yearLabel}
                    <span className="ml-2 font-normal">({timelineStateLabel(item.state)})</span>
                  </p>
                  <p className="text-sm font-medium leading-snug text-foreground">{item.titleTh}</p>
                  {item.detailTh ? <p className="text-xs leading-snug text-muted">{item.detailTh}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 8. Recommended action — compact */}
        <section
          aria-labelledby="promotion-action"
          className="rounded-lg border border-border bg-neutral-bg/70 px-3 py-2"
        >
          <SectionLabel id="promotion-action">สิ่งที่ควรดำเนินการ</SectionLabel>
          <p className="mt-1 text-sm leading-snug text-foreground">{p.recommendedActionTh}</p>
        </section>

        {/* 9. Summary — readable body */}
        <section aria-labelledby="promotion-reason" className="rounded-lg border border-border px-3 py-2">
          <SectionLabel id="promotion-reason">สรุปเพื่อการพิจารณา</SectionLabel>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-foreground">{p.reasonTh}</p>
        </section>

        {/* 10. Disclaimer */}
        <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted">
          ข้อมูลนี้ใช้สนับสนุนการพิจารณา ไม่ใช่คำสั่งแต่งตั้งอัตโนมัติ และไม่รับรองว่าจะได้รับการแต่งตั้ง
        </p>
      </CardBody>
    </Card>
  );
}
