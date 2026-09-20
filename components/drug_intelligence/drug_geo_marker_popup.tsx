/**
 * DrugGeoMarkerPopup — lightweight V2 marker fields plus lazy 6C detail.
 */
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { withReturnTo } from "@/lib/ui/return_context";
import { DRUG_CASE_STATUS_META, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import type { DrugMapMarkerView } from "@/lib/drug_intelligence/drug_geo_client";
import type { DrugMapCaseDetailState } from "@/lib/drug_intelligence/use_drug_map_case_detail";
import { formatThaiOperationalDate } from "@/lib/drug_intelligence/di_date_helpers";

function statusLabelTh(status: string): string {
  return isValidDrugCaseStatus(status) ? DRUG_CASE_STATUS_META[status].labelTh : status;
}

export function DrugGeoMarkerPopup({
  marker,
  returnTo,
  detail,
}: {
  marker: DrugMapMarkerView;
  returnTo?: string;
  detail?: DrugMapCaseDetailState;
}) {
  const { t, language } = useT();
  const payload = detail?.data;

  return (
    <div className="max-h-80 w-72 space-y-2 overflow-y-auto text-sm" data-testid="map-marker-popup">
      <div>
        <p className="font-semibold text-slate-900">{marker.caseNumber}</p>
        <p className="text-xs text-slate-600">{statusLabelTh(marker.status)}</p>
      </div>

      <dl className="space-y-1">
        <div className="flex justify-between gap-2">
          <dt className="text-xs text-slate-600">{t("di.map.popupArrestDate")}</dt>
          <dd className="text-xs font-medium text-slate-900">{marker.arrestDate ? formatThaiOperationalDate(marker.arrestDate) : "—"}</dd>
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

      {detail?.isLoading ? (
        <p className="text-xs text-slate-600" data-testid="map-detail-loading" role="status">
          {t("di.map.detailLoading")}
        </p>
      ) : null}

      {detail?.isError ? (
        <div className="space-y-1" data-testid="map-detail-error" role="alert">
          <p className="text-xs text-slate-700">{t("di.map.detailError")}</p>
          <Button type="button" size="sm" variant="outline" className="min-h-10 border-slate-300 bg-white text-slate-900" onClick={detail.retry}>
            {t("di.map.detailRetry")}
          </Button>
        </div>
      ) : null}

      {payload && payload.persons.items.length > 0 ? (
        <section data-testid="map-detail-persons">
          <h3 className="text-xs font-semibold text-slate-800">{t("di.map.detailPersonsTitle")}</h3>
          <ul className="mt-1 space-y-1">
            {payload.persons.items.map((person) => {
              const roleLabel = isValidDrugCasePersonRole(person.role)
                ? language === "en"
                  ? DRUG_CASE_PERSON_ROLE_LABELS[person.role].labelEn
                  : DRUG_CASE_PERSON_ROLE_LABELS[person.role].labelTh
                : person.role;
              return (
                <li key={person.personId} className="flex justify-between gap-2 text-xs">
                  <Link
                    href={withReturnTo(`/drug-intelligence/persons/${encodeURIComponent(person.personId)}`, returnTo)}
                    className="font-medium text-accent hover:underline"
                  >
                    {person.displayName}
                  </Link>
                  <span className="shrink-0 text-slate-600">{roleLabel}</span>
                </li>
              );
            })}
          </ul>
          {payload.persons.truncated ? <p className="mt-1 text-xs text-slate-600">{t("di.map.detailTruncated")}</p> : null}
        </section>
      ) : null}

      {payload && payload.seizures.items.length > 0 ? (
        <section data-testid="map-detail-seizures">
          <h3 className="text-xs font-semibold text-slate-800">{t("di.map.detailSeizuresTitle")}</h3>
          <ul className="mt-1 space-y-1">
            {payload.seizures.items.map((item) => (
              <li key={`${item.drugCategory}-${item.measurementKind}-${item.displayUnit ?? ""}`} className="text-xs text-slate-900">
                {item.displayTh}
              </li>
            ))}
          </ul>
          {payload.seizures.truncated ? <p className="mt-1 text-xs text-slate-600">{t("di.map.detailTruncated")}</p> : null}
        </section>
      ) : null}

      {payload && payload.participatingUnits.items.length > 0 ? (
        <section data-testid="map-detail-units">
          <h3 className="text-xs font-semibold text-slate-800">{t("di.map.detailUnitsTitle")}</h3>
          <ul className="mt-1 space-y-1">
            {payload.participatingUnits.items.map((unit) => (
              <li key={unit.unitName} className="text-xs text-slate-900">
                {unit.unitName}
              </li>
            ))}
          </ul>
          {payload.participatingUnits.truncated ? <p className="mt-1 text-xs text-slate-600">{t("di.map.detailTruncated")}</p> : null}
        </section>
      ) : null}

      {payload && payload.officers.count > 0 ? (
        <p className="text-xs text-slate-800" data-testid="map-detail-officers">
          {t("di.map.detailOfficersTitle")}: {payload.officers.count.toLocaleString("th-TH")}
        </p>
      ) : null}

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
