/**
 * DrugGeoMarkerPopup (Phase DI-8, Section 17/18/24).
 *
 * Marker click -> popup content. Read-only, presentation-only — every value
 * comes from the already-composed DrugGeoCaseMarkerView (Section 18: reuses
 * the canonical seizure grouping/formatting, never combines COUNT and MASS).
 * Actions only render when the underlying data supports them (Section 17:
 * "Only show actions that make sense for available data").
 */
"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import type { DrugGeoCaseMarkerView } from "@/lib/drug_intelligence/drug_geo_client";

function formatIsoDateTh(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getUTCDate();
  const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const month = months[d.getUTCMonth() + 1] ?? "";
  const yearBe = d.getUTCFullYear() + 543;
  return `${day} ${month} ${yearBe}`;
}

export function DrugGeoMarkerPopup({ marker }: { marker: DrugGeoCaseMarkerView }) {
  const { t } = useT();

  return (
    <div className="w-64 space-y-2 text-sm">
      <div>
        <p className="font-semibold text-foreground">{marker.caseNumber}</p>
        <p className="text-xs text-muted">{marker.title}</p>
      </div>

      <dl className="space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-muted">{t("di.map.popupArrestDate")}</dt>
          <dd className="text-xs font-medium text-foreground">{formatIsoDateTh(marker.arrestDate)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-muted">{t("di.map.popupProvinceDistrict")}</dt>
          <dd className="text-xs font-medium text-foreground">{[marker.province, marker.district].filter(Boolean).join(" / ") || "—"}</dd>
        </div>
        {marker.locationName ? (
          <div className="flex justify-between gap-2">
            <dt className="text-xs text-muted">{t("di.map.popupLocation")}</dt>
            <dd className="text-xs font-medium text-foreground">{marker.locationName}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-muted">{t("di.map.popupSuspects")}</dt>
          <dd className="text-xs font-medium text-foreground">{marker.suspectCount.toLocaleString("th-TH")}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-muted">{t("di.map.popupLeadUnit")}</dt>
          <dd className="text-xs font-medium text-foreground">{marker.leadUnitText || "—"}</dd>
        </div>
        {marker.participatingUnitCount > 0 ? (
          <div className="flex justify-between gap-2">
            <dt className="text-xs text-muted">{t("di.map.popupParticipatingUnits")}</dt>
            <dd className="text-xs font-medium text-foreground">{marker.participatingUnitCount.toLocaleString("th-TH")}</dd>
          </div>
        ) : null}
        {marker.officerCount > 0 ? (
          <div className="flex justify-between gap-2">
            <dt className="text-xs text-muted">{t("di.map.popupOfficerCount")}</dt>
            <dd className="text-xs font-medium text-foreground">{marker.officerCount.toLocaleString("th-TH")}</dd>
          </div>
        ) : null}
      </dl>

      {marker.seizedItems.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.map.popupSeized")}</p>
          <ul className="mt-0.5 space-y-0.5">
            {marker.seizedItems.map((g) => (
              <li key={`${g.drugCategory}-${g.measurementKind}`} className="text-xs text-foreground">
                {g.displayTh}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {marker.hasUnreviewedAlert ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-warning-bg px-2 py-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("di.map.popupHasAlert")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/drug-intelligence/cases/${encodeURIComponent(marker.caseId)}`}>{t("di.map.actionOpenCase")}</Link>
        </Button>
        {marker.suspectCount > 0 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/drug-intelligence/cases/${encodeURIComponent(marker.caseId)}`}>{t("di.map.actionViewPersons")}</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href={`/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(marker.caseId)}`}>{t("di.map.actionOpenNetwork")}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/drug-intelligence/timeline?caseId=${encodeURIComponent(marker.caseId)}`}>{t("di.map.actionViewTimeline")}</Link>
        </Button>
      </div>
    </div>
  );
}
