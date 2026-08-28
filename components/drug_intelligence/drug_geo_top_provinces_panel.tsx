/**
 * DrugGeoTopProvincesPanel (Phase DI-8.2, Section 11) — "จังหวัดที่มีคดีสูงสุด".
 *
 * Reuses DrugGeoResultView.provinceBreakdown as-is — it's ALREADY sorted by
 * caseCount descending (composeDrugGeoResult's own sort), so this only
 * slices the top N; it does not re-sort or re-aggregate. Renders nothing
 * when there is no province data at all (Section 11: "do not display fake
 * rankings when data is absent"), never a padded/fabricated row.
 */
"use client";

import { useT } from "@/components/i18n/language_provider";
import type { DrugGeoProvinceBreakdownRowView } from "@/lib/drug_intelligence/drug_geo_client";

const TOP_N = 5;

export function DrugGeoTopProvincesPanel({ rows }: { rows: DrugGeoProvinceBreakdownRowView[] }) {
  const { t } = useT();
  const top = rows.slice(0, TOP_N);

  if (top.length === 0) {
    return <p className="text-xs text-muted">{t("di.map.topProvincesEmpty")}</p>;
  }

  return (
    <ol className="space-y-1.5">
      {top.map((row) => (
        <li key={row.province} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-foreground">{row.province}</span>
          <span className="shrink-0 tabular-nums text-muted">
            {row.caseCount.toLocaleString("th-TH")} {t("di.map.topProvincesUnit")}
          </span>
        </li>
      ))}
    </ol>
  );
}
