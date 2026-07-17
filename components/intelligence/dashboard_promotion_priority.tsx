/**
 * DashboardPromotionPriority (Phase 42 — Commander Dashboard Intelligence,
 * Task 4; Commander Promotion UX refinement pass — presentation/terminology
 * only).
 *
 * "ผู้ควรได้รับการพิจารณาก่อน" — the commander-facing priority list. Every
 * row is a PromotionCandidateViewModel already sorted highest-priority-first
 * and formatted by lib/commander_dashboard/view_model.ts. This component
 * renders only — it never recalculates the priority score, sorts
 * differently, or derives a date/duration/status itself.
 *
 * Commander Promotion UX refinement (presentation/terminology only, no
 * calculation changed):
 *   - Column order: รูป, ยศ ชื่อ-สกุล, ตำแหน่ง, หน่วย, ปีเกษียณอายุราชการ,
 *     อายุราชการ, คุณสมบัติ, สถานะ, ปีนี้เป็นปีที่, ดำรงตำแหน่งระดับนี้มา, ดูประวัติ.
 *   - "คุณสมบัติ" answers "ครบขึ้นตำแหน่งอะไร" (e.g. "ครบขึ้น ผกก."), built
 *     from PromotionSummary.targetPosition — not a generic "Eligible" label.
 *   - "สถานะ" uses PromotionSummary's own Thai status text (displayStatusTh),
 *     the existing status mapping — not re-derived here.
 *   - "ปีนี้เป็นปีที่" shows ONLY the number (promotionYearOrdinal), sourced
 *     from PromotionSummary.overdueYears — never calculated from today's date.
 *   - "ดำรงตำแหน่งระดับนี้มา" shows whole years at the CURRENT position
 *     level (displayYearsAtLevelTh) — replaces the old cycle-count column.
 *   - Horizontal scroll UX: DualScrollTable (top + bottom scrollbar, synced,
 *     Shift+wheel, click-and-drag) wraps the table; รูป/ยศ ชื่อ-สกุล columns
 *     are sticky (position: sticky) so they stay visible while scrolling.
 */
"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DualScrollTable } from "@/components/ui/dual_scroll_table";
import { useT } from "@/components/i18n/language_provider";
import type { PromotionCandidateViewModel } from "@/lib/commander_dashboard/types";

/** Phase 43 B5/B8: photo column min-width (72px) and avatar diameter (52px, within the 48-56px recommended range). */
const PHOTO_COL_PX = 72;

/** Circular, object-cover, consistent-size Official Portrait avatar with a graceful icon fallback when no trusted portrait exists. Never a gallery thumbnail. */
function OfficialPortraitAvatar({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- small circular avatar, not a content image worth next/image's overhead here.
    return <img src={src} alt={alt} className="h-13 w-13 shrink-0 rounded-full border border-border object-cover" loading="lazy" />;
  }
  return (
    <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-border bg-neutral-bg text-muted" aria-hidden="true">
      <User className="h-5 w-5" />
    </span>
  );
}

export function DashboardPromotionPriority({ candidates }: { candidates: PromotionCandidateViewModel[] }) {
  const { t } = useT();

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{t("dashboard.priorityListTitle")}</CardTitle>
          <p className="mt-0.5 text-xs text-muted">{t("dashboard.priorityListSubtitle")}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/commander-search?promotionEligibilityStatus=AlreadyEligible">{t("dashboard.priorityViewAll")}</Link>
        </Button>
      </CardHeader>
      <CardBody className="p-0">
        {candidates.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">{t("dashboard.priorityEmpty")}</p>
        ) : (
          <DualScrollTable>
            <table className="w-full min-w-270 text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium" style={{ minWidth: PHOTO_COL_PX, width: PHOTO_COL_PX }}>{t("dashboard.priorityColumnPhoto")}</th>
                  <th className="sticky z-10 bg-surface px-3 py-2 font-medium" style={{ left: PHOTO_COL_PX, minWidth: 220 }}>{t("dashboard.priorityColumnName")}</th>
                  <th className="px-3 py-2 font-medium" style={{ minWidth: 260 }}>{t("dashboard.priorityColumnPosition")}</th>
                  <th className="px-3 py-2 font-medium" style={{ minWidth: 150 }}>{t("dashboard.priorityColumnUnit")}</th>
                  <th className="px-3 py-2 font-medium" style={{ minWidth: 130 }}>{t("dashboard.priorityColumnRetirementYear")}</th>
                  <th className="px-3 py-2 font-medium" style={{ minWidth: 150 }}>{t("dashboard.priorityColumnServiceYears")}</th>
                  <th className="px-3 py-2 font-medium" style={{ minWidth: 180 }}>{t("dashboard.priorityColumnQualification")}</th>
                  <th className="px-3 py-2 font-medium" style={{ minWidth: 180 }}>{t("dashboard.priorityColumnStatus")}</th>
                  <th className="px-3 py-2 text-center font-medium" style={{ minWidth: 110 }}>{t("dashboard.priorityColumnEligibleDuration")}</th>
                  <th className="px-3 py-2 font-medium" style={{ minWidth: 160 }}>{t("dashboard.priorityColumnYearsAtLevel")}</th>
                  <th className="px-3 py-2 font-medium" style={{ minWidth: 110 }}>{t("dashboard.priorityColumnAction")}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.officerId} className="border-b border-border align-middle last:border-b-0 hover:bg-neutral-bg">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2.5" style={{ minWidth: PHOTO_COL_PX, width: PHOTO_COL_PX }}>
                      <OfficialPortraitAvatar src={candidate.officialPortraitUrl} alt={candidate.displayName} />
                    </td>
                    <td className="sticky z-10 bg-surface px-3 py-2.5" style={{ left: PHOTO_COL_PX, minWidth: 220 }}>
                      <p className="whitespace-normal wrap-break-word font-medium text-foreground">
                        {candidate.rank ? `${candidate.rank} ` : ""}
                        {candidate.displayName}
                      </p>
                    </td>
                    <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">{candidate.currentPosition ?? "—"}</td>
                    <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">{candidate.currentUnit ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted">{candidate.displayRetirementYearTh ?? "—"}</td>
                    <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">{candidate.displayServiceDurationTh ?? "—"}</td>
                    <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">{candidate.displayTargetQualificationTh ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={candidate.promotionStatus === "AlreadyEligible" ? "warning" : "accent"}>{candidate.displayStatusTh}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-foreground">
                      {candidate.promotionYearOrdinal ?? <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{candidate.displayYearsAtLevelTh ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={candidate.href}>{t("dashboard.priorityColumnAction")}</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DualScrollTable>
        )}
      </CardBody>
    </Card>
  );
}
