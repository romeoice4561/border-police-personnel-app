/**
 * DashboardTrainingPriority (Phase 45 completion pass, Task 10).
 *
 * "กำลังพลที่ควรพิจารณาส่งเข้ารับการอบรม" — renders the deterministic,
 * rule-ordered Training Priority list already produced by
 * lib/intelligence/training/priority.ts's buildTrainingPriorityList()
 * (composed once in lib/commander_dashboard/view_model.ts). This component
 * renders only — it never recalculates ordering, never derives a numerical
 * score (none exists; the engine explicitly does not produce one without a
 * real policy), and never fabricates a priority record from NoPolicy alone
 * (the engine's tier rules already exclude NoPolicy/Complete officers
 * entirely — see priority.ts).
 *
 * The WHOLE panel is hidden (returns null) when there are no real priority
 * records — never a decorative empty panel.
 */
"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DualScrollTable } from "@/components/ui/dual_scroll_table";
import { useT } from "@/components/i18n/language_provider";
import { TRAINING_STATUS_TONE } from "@/lib/intelligence/training/status_tone";
import { TRAINING_STATUS_DISPLAY_TH } from "@/lib/intelligence/training/display";
import type { TrainingPriorityOfficer } from "@/lib/intelligence/training/priority";

const PHOTO_COL_PX = 72;

/** Circular, object-cover, consistent-size Official Portrait avatar with a graceful icon fallback — matches DashboardPromotionPriority's OfficialPortraitAvatar exactly (Task 10: use canonical Official Portrait). */
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

export function DashboardTrainingPriority({ officers }: { officers: TrainingPriorityOfficer[] }) {
  const { t } = useT();

  // Task 10: hide the whole panel when there are no real priority records.
  if (officers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.trainingPriorityTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <DualScrollTable>
          <table className="w-full min-w-270 text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium" style={{ minWidth: PHOTO_COL_PX, width: PHOTO_COL_PX }}>{t("dashboard.priorityColumnPhoto")}</th>
                <th className="sticky z-10 bg-surface px-3 py-2 font-medium" style={{ left: PHOTO_COL_PX, minWidth: 220 }}>{t("dashboard.priorityColumnName")}</th>
                <th className="px-3 py-2 font-medium" style={{ minWidth: 220 }}>{t("dashboard.priorityColumnPosition")}</th>
                <th className="px-3 py-2 font-medium" style={{ minWidth: 150 }}>{t("dashboard.priorityColumnUnit")}</th>
                <th className="px-3 py-2 font-medium" style={{ minWidth: 180 }}>{t("commander.trainingStatus")}</th>
                <th className="px-3 py-2 font-medium" style={{ minWidth: 200 }}>{t("dashboard.trainingPriorityMissingCourses")}</th>
                <th className="px-3 py-2 font-medium" style={{ minWidth: 180 }}>{t("dashboard.priorityColumnStatus")}</th>
                <th className="px-3 py-2 font-medium" style={{ minWidth: 220 }}>{t("dashboard.trainingPriorityRecommendedAction")}</th>
                <th className="px-3 py-2 font-medium" style={{ minWidth: 110 }}>{t("dashboard.priorityColumnAction")}</th>
              </tr>
            </thead>
            <tbody>
              {officers.map((officer) => (
                <tr key={officer.officerId} className="border-b border-border align-middle last:border-b-0 hover:bg-neutral-bg">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2.5" style={{ minWidth: PHOTO_COL_PX, width: PHOTO_COL_PX }}>
                    <OfficialPortraitAvatar src={officer.officialPortraitUrl} alt={officer.displayName} />
                  </td>
                  <td className="sticky z-10 bg-surface px-3 py-2.5" style={{ left: PHOTO_COL_PX, minWidth: 220 }}>
                    <p className="whitespace-normal wrap-break-word font-medium text-foreground">
                      {officer.rank ? `${officer.rank} ` : ""}
                      {officer.displayName}
                    </p>
                  </td>
                  <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">{officer.position ?? "—"}</td>
                  <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">{officer.unit ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={TRAINING_STATUS_TONE[officer.trainingStatus]}>{TRAINING_STATUS_DISPLAY_TH[officer.trainingStatus]}</Badge>
                  </td>
                  <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">
                    {officer.missingCourseNames.length > 0 ? officer.missingCourseNames.join(", ") : "—"}
                  </td>
                  <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">{officer.promotionStatusTh ?? "—"}</td>
                  <td className="whitespace-normal wrap-break-word px-3 py-2.5 text-muted">{officer.recommendedActionTh}</td>
                  <td className="px-3 py-2.5">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/officers/${encodeURIComponent(officer.officerId)}`}>{t("dashboard.priorityColumnAction")}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DualScrollTable>
      </CardBody>
    </Card>
  );
}
