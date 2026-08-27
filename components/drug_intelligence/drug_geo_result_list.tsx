/**
 * DrugGeoResultList (Phase DI-8, Section 19/20).
 *
 * A synchronized table of EVERY case in the current filtered result — both
 * markers and no-coordinate cases — so a case without coordinates stays
 * reachable from the geographic workspace (Section 20: never silently
 * hidden). Clicking a marker-backed row selects/focuses it on the map;
 * clicking a no-coordinate row opens the case detail directly since there
 * is nothing to focus on the map (Section 19).
 */
"use client";

import Link from "next/link";
import { MapPin, MapPinOff } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import type { DrugGeoCaseMarkerView, DrugGeoNoCoordinateCaseView } from "@/lib/drug_intelligence/drug_geo_client";

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
  markers,
  noCoordinateCases,
  selectedCaseId,
  onSelectMarker,
}: {
  markers: DrugGeoCaseMarkerView[];
  noCoordinateCases: DrugGeoNoCoordinateCaseView[];
  selectedCaseId: string | null;
  onSelectMarker: (caseId: string) => void;
}) {
  const { t } = useT();

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-neutral-bg text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colCaseNumber")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colArrestDate")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colProvince")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colLocation")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colLeadUnit")}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t("di.map.colSuspects")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colSeized")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("di.map.colCoordinateStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {markers.map((m) => (
              <tr
                key={m.caseId}
                onClick={() => onSelectMarker(m.caseId)}
                className={`cursor-pointer border-b border-border last:border-0 hover:bg-neutral-bg/60 ${m.caseId === selectedCaseId ? "bg-accent/5" : ""}`}
              >
                <td className="px-3 py-2 font-medium text-accent">{m.caseNumber}</td>
                <td className="px-3 py-2 text-muted">{formatIsoDateTh(m.arrestDate)}</td>
                <td className="px-3 py-2 text-muted">{m.province || "—"}</td>
                <td className="px-3 py-2 text-muted">{m.locationName || "—"}</td>
                <td className="px-3 py-2 text-muted">{m.leadUnitText || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{m.suspectCount}</td>
                <td className="px-3 py-2 text-muted">{m.seizedItems.length > 0 ? m.seizedItems.map((g) => g.displayTh).join(" • ") : "—"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-good/10 px-2 py-0.5 text-xs text-good">
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {t("di.map.coordinateHas")}
                  </span>
                </td>
              </tr>
            ))}
            {noCoordinateCases.map((c) => (
              <tr key={c.caseId} className="border-b border-border last:border-0 hover:bg-neutral-bg/60">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/drug-intelligence/cases/${encodeURIComponent(c.caseId)}`} className="text-accent hover:underline">
                    {c.caseNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted">{formatIsoDateTh(c.arrestDate)}</td>
                <td className="px-3 py-2 text-muted">{c.province || "—"}</td>
                <td className="px-3 py-2 text-muted">—</td>
                <td className="px-3 py-2 text-muted">{c.reportingUnitText || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">—</td>
                <td className="px-3 py-2 text-muted">—</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-bg px-2 py-0.5 text-xs text-muted">
                    <MapPinOff className="h-3 w-3" aria-hidden="true" />
                    {t("di.map.coordinateMissing")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
