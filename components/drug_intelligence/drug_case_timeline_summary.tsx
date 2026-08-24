/**
 * Case Workspace's compact "ไทม์ไลน์และพื้นที่ของคดีนี้" section (Phase DI-7,
 * Section 13). Reads the already-loaded case detail directly (no second
 * fetch) — this is purely a presentational summary of fields the workspace
 * already has, plus a drill-down link into the full Timeline workspace
 * scoped to this case.
 */
"use client";

import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import { toGregorianDateInputValue } from "@/lib/officer_profile/thai_personnel_date";

export function DrugCaseTimelineSummary({
  caseId,
  arrestDate,
  province,
  district,
  subdistrict,
  latitude,
  longitude,
}: {
  caseId: string;
  arrestDate: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  latitude: string | null;
  longitude: string | null;
}) {
  const { t } = useT();
  const hasCoordinates = latitude !== null && longitude !== null;

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            {t("di.timeline.caseWorkspaceTitle")}
          </p>
          <Link href={`/drug-intelligence/timeline?caseId=${encodeURIComponent(caseId)}`} className="text-xs text-accent hover:underline">
            {t("di.timeline.viewFullTimeline")}
          </Link>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
          {arrestDate ? toGregorianDateInputValue(arrestDate) : "—"}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
          {[province, district, subdistrict].filter(Boolean).join(" / ") || "—"}
        </p>
        <p className="text-xs text-muted">{hasCoordinates ? t("di.timeline.coordinateAvailable") : t("di.timeline.coordinateUnavailable")}</p>
      </CardBody>
    </Card>
  );
}
