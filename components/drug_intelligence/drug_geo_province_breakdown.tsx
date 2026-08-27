/**
 * DrugGeoProvinceBreakdown (Phase DI-8, Section 25/26).
 *
 * "แบ่งตามจังหวัด" view mode. Wording is deliberately neutral — "จำนวนคดีที่
 * บันทึกไว้" (recorded case count), never a concentration/risk claim
 * (Section 26: "Do not claim province-level criminal concentration").
 * Clicking a row applies the province filter (Section 26: "Click province:
 * apply province filter and zoom/fit relevant markers").
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import type { DrugGeoProvinceBreakdownRowView } from "@/lib/drug_intelligence/drug_geo_client";

export function DrugGeoProvinceBreakdown({ rows, onSelectProvince }: { rows: DrugGeoProvinceBreakdownRowView[]; onSelectProvince: (province: string) => void }) {
  const { t } = useT();

  if (rows.length === 0) {
    return <p className="text-sm text-muted">{t("common.noData")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-neutral-bg text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-3 py-2 font-medium">{t("di.map.filterProvince")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("di.map.provinceColCases")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("di.map.provinceColMarkers")}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t("di.map.provinceColPersons")}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t("di.map.provinceColSeized")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.province} onClick={() => onSelectProvince(row.province)} className="cursor-pointer border-b border-border last:border-0 hover:bg-neutral-bg/60">
              <td className="px-3 py-2 font-medium text-accent">{row.province}</td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">{row.caseCount.toLocaleString("th-TH")}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">{row.markerCount.toLocaleString("th-TH")}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted">{row.personCount.toLocaleString("th-TH")}</td>
              <td className="px-3 py-2 text-muted">{row.topSeizedItems.length > 0 ? row.topSeizedItems.map((g) => g.displayTh).join(" • ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
