/**
 * DI-8.2B — Province / district area ranking panel.
 * Clicking a row applies the matching map filter (shared filter state).
 */

"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/language_provider";
import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { DrugGeoAreaRankRow } from "@/lib/drug_intelligence/drug_geo_area_intelligence";

function thaiDate(iso: string | null): string {
  if (!iso) return "—";
  return formatShortThaiDateTh(new Date(`${iso}T00:00:00.000Z`));
}

export function DrugGeoAreaRankingPanel({
  provinceRows,
  districtRows,
  onSelectProvince,
  onSelectDistrict,
}: {
  provinceRows: DrugGeoAreaRankRow[];
  districtRows: DrugGeoAreaRankRow[];
  onSelectProvince: (province: string) => void;
  onSelectDistrict: (district: string) => void;
}) {
  const { t } = useT();
  const [level, setLevel] = useState<"PROVINCE" | "DISTRICT">("PROVINCE");
  const rows = level === "PROVINCE" ? provinceRows : districtRows;

  return (
    <div data-testid="map-area-ranking" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{t("di.map.areaRankingTitle")}</p>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          <button
            type="button"
            className={`rounded-md px-2 py-0.5 text-xs ${level === "PROVINCE" ? "bg-accent text-accent-fg" : "text-muted"}`}
            onClick={() => setLevel("PROVINCE")}
          >
            {t("di.map.areaLevelProvince")}
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-0.5 text-xs ${level === "DISTRICT" ? "bg-accent text-accent-fg" : "text-muted"}`}
            onClick={() => setLevel("DISTRICT")}
          >
            {t("di.map.areaLevelDistrict")}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted">{t("di.map.areaRankingEmpty")}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.slice(0, 8).map((row) => (
            <li key={`${row.level}:${row.value}`}>
              <button
                type="button"
                disabled={row.unspecified}
                onClick={() => {
                  if (row.unspecified) return;
                  if (row.level === "PROVINCE") onSelectProvince(row.value);
                  else onSelectDistrict(row.value);
                }}
                className="flex w-full flex-col gap-0.5 rounded-lg border border-border bg-neutral-bg px-2 py-1.5 text-left transition-colors hover:border-accent disabled:cursor-default disabled:opacity-70"
              >
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-foreground">{row.value}</span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {row.eventCount.toLocaleString("th-TH")} ({row.percentOfFiltered}%)
                  </span>
                </span>
                <span className="text-[11px] text-muted">
                  {t("di.map.areaWithCoords")}: {row.withCoordinates.toLocaleString("th-TH")} ·{" "}
                  {t("di.map.areaWithoutCoords")}: {row.withoutCoordinates.toLocaleString("th-TH")}
                </span>
                <span className="text-[11px] text-muted">
                  {thaiDate(row.earliestArrestDate)} – {thaiDate(row.latestArrestDate)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
