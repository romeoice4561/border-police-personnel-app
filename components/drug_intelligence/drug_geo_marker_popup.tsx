/**
 * DrugGeoMarkerPopup — V2 lightweight popup (DI-10E.6B).
 *
 * Only fields available from DrugMapQueryService markers. Relation-heavy
 * sections (persons / seizures / officers / alerts) are omitted until 6C.
 */
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { withReturnTo } from "@/lib/ui/return_context";
import { DRUG_CASE_STATUS_META, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import type { DrugMapMarkerView } from "@/lib/drug_intelligence/drug_geo_client";

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

function statusLabelTh(status: string): string {
  return isValidDrugCaseStatus(status) ? DRUG_CASE_STATUS_META[status].labelTh : status;
}

export function DrugGeoMarkerPopup({ marker, returnTo }: { marker: DrugMapMarkerView; returnTo?: string }) {
  const { t } = useT();

  return (
    <div className="w-64 space-y-2 text-sm">
      <div>
        <p className="font-semibold text-slate-900">{marker.caseNumber}</p>
        <p className="text-xs text-slate-600">{statusLabelTh(marker.status)}</p>
      </div>

      <dl className="space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-slate-600">{t("di.map.popupArrestDate")}</dt>
          <dd className="text-xs font-medium text-slate-900">{formatIsoDateTh(marker.arrestDate)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-slate-600">{t("di.map.popupProvinceDistrict")}</dt>
          <dd className="text-xs font-medium text-slate-900">{[marker.province, marker.district].filter(Boolean).join(" / ") || "—"}</dd>
        </div>
        {marker.locationName ? (
          <div className="flex justify-between gap-2">
            <dt className="text-xs text-slate-600">{t("di.map.popupLocation")}</dt>
            <dd className="text-xs font-medium text-slate-900">{marker.locationName}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-slate-600">{t("di.map.filterReportingUnit")}</dt>
          <dd className="text-xs font-medium text-slate-900">{marker.reportingUnitText || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-slate-600">{t("di.map.popupLeadUnit")}</dt>
          <dd className="text-xs font-medium text-slate-900">{marker.leadUnitText || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5 border-t border-slate-200 pt-2">
        <Button asChild size="sm" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100">
          <Link href={withReturnTo(`/drug-intelligence/cases/${encodeURIComponent(marker.caseId)}`, returnTo)}>{t("di.map.actionOpenCase")}</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100">
          <Link href={withReturnTo(`/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(marker.caseId)}`, returnTo)}>{t("di.map.actionOpenNetwork")}</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100">
          <Link href={withReturnTo(`/drug-intelligence/timeline?caseId=${encodeURIComponent(marker.caseId)}`, returnTo)}>{t("di.map.actionViewTimeline")}</Link>
        </Button>
      </div>
    </div>
  );
}
