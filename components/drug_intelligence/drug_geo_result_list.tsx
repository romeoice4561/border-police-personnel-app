/**
 * DrugGeoResultList — server-paginated V2 list (DI-10E.6B).
 *
 * Lightweight columns only. Suspect/seizure columns are not reintroduced.
 */
"use client";

import Link from "next/link";
import { MapPin, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import type { DrugMapListItemView } from "@/lib/drug_intelligence/drug_geo_client";

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

export function DrugGeoResultList({
  items,
  selectedCaseId,
  onSelectMarker,
  page,
  totalPages,
  onPageChange,
  fetching,
}: {
  items: DrugMapListItemView[];
  selectedCaseId: string | null;
  onSelectMarker: (caseId: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  fetching?: boolean;
}) {
  const { t } = useT();
  const prevDisabled = page <= 1 || Boolean(fetching);
  const nextDisabled = page >= totalPages || Boolean(fetching);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-neutral-bg text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colCaseNumber")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colArrestDate")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colProvince")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colLocation")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.filterReportingUnit")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colLeadUnit")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colCoordinateStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const selectable = row.hasCoordinates;
              return (
                <tr
                  key={row.caseId}
                  onClick={selectable ? () => onSelectMarker(row.caseId) : undefined}
                  className={`border-b border-border last:border-0 hover:bg-neutral-bg/60 ${selectable ? "cursor-pointer" : ""} ${row.caseId === selectedCaseId ? "bg-accent/5" : ""}`}
                >
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/drug-intelligence/cases/${encodeURIComponent(row.caseId)}`}
                      className="text-accent hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {row.caseNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted">{formatIsoDateTh(row.arrestDate)}</td>
                  <td className="px-3 py-2 text-muted">{row.province || "—"}</td>
                  <td className="px-3 py-2 text-muted">{row.locationName || row.district || "—"}</td>
                  <td className="px-3 py-2 text-muted">{row.reportingUnitText || "—"}</td>
                  <td className="px-3 py-2 text-muted">{row.leadUnitText || "—"}</td>
                  <td className="px-3 py-2">
                    {row.hasCoordinates ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-xs text-good">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {t("di.map.coordinateHas")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-bg px-2 py-0.5 text-xs text-muted">
                        <MapPinOff className="h-3 w-3" aria-hidden="true" />
                        {t("di.map.coordinateMissing")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={t("di.map.paginationLabel")}>
        <Button type="button" variant="outline" size="sm" className="min-h-10" disabled={prevDisabled} onClick={() => onPageChange(page - 1)}>
          {t("di.map.pagePrevious")}
        </Button>
        <p className="text-sm tabular-nums text-muted" data-testid="map-list-page-indicator">
          {t("di.map.pageIndicator").replace("{page}", String(page)).replace("{totalPages}", String(totalPages))}
        </p>
        <Button type="button" variant="outline" size="sm" className="min-h-10" disabled={nextDisabled} onClick={() => onPageChange(page + 1)}>
          {t("di.map.pageNext")}
        </Button>
      </nav>
    </div>
  );
}
