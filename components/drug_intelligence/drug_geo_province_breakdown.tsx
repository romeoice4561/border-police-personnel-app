/**
 * DrugGeoProvinceBreakdown — server `provinces[]` (DI-10E.6B).
 *
 * Named provinces remain clickable filters. The unknown bucket is visible
 * but not clickable — blank/null province must not be sent as "ไม่ระบุจังหวัด".
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import type { DrugMapProvinceView } from "@/lib/drug_intelligence/drug_geo_client";

export function DrugGeoProvinceBreakdown({
  rows,
  onSelectProvince,
}: {
  rows: DrugMapProvinceView[];
  onSelectProvince: (province: string) => void;
}) {
  const { t } = useT();

  if (rows.length === 0) {
    return <p className="text-sm text-muted">{t("common.noData")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-neutral-bg text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-3 py-2 font-medium">{t("di.map.filterProvince")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("di.map.provinceColCases")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("di.map.provinceColMarkers")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const clickable = !row.unspecified;
            return (
              <tr
                key={row.unspecified ? "__unspecified__" : row.province}
                onClick={clickable ? () => onSelectProvince(row.province) : undefined}
                className={`border-b border-border last:border-0 ${clickable ? "cursor-pointer hover:bg-neutral-bg/60" : ""}`}
              >
                <td className={`px-3 py-2 font-medium ${clickable ? "text-accent" : "text-muted"}`}>{row.province}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{row.caseCount.toLocaleString("th-TH")}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{row.withCoordinates.toLocaleString("th-TH")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
