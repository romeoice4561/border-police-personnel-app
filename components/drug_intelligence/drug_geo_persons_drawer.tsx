/**
 * DrugGeoPersonsDrawer (Phase DI-8.2, Section 15) — "ดูผู้เกี่ยวข้อง".
 *
 * A compact list of the persons linked to one marker's case, each linking
 * to Person Profile. Only name + a Person Profile link are shown — the map
 * marker view (DrugGeoCaseMarkerView.personSummaries) carries just
 * personId/primaryFullName (Section 2: reuse existing architecture; adding
 * per-person role/nickname/network-role here would require a NEW per-person
 * fetch the map result doesn't already include, which this phase's own
 * "do not create a second seizure/map architecture" instruction argues
 * against). Never shows a national ID or other protected identifier
 * (Section 15's explicit rule) — there is none in this view model to begin
 * with, so nothing needs to be redacted.
 *
 * returnTo is forwarded into each Person Profile link so Person → Network
 * (and eventually back to Map) stays connected — same withReturnTo
 * mechanism every other Map-originated link already uses.
 */
"use client";

import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { useT } from "@/components/i18n/language_provider";
import { withReturnTo } from "@/lib/ui/return_context";
import type { DrugGeoPersonSummaryView } from "@/lib/drug_intelligence/drug_geo_client";

export function DrugGeoPersonsDrawer({
  open,
  onClose,
  caseNumber,
  persons,
  returnTo,
}: {
  open: boolean;
  onClose: () => void;
  caseNumber: string;
  persons: DrugGeoPersonSummaryView[];
  returnTo?: string;
}) {
  const { t } = useT();

  return (
    <Drawer open={open} onClose={onClose} titleId="drug-geo-persons-drawer-title" title={`${t("di.map.actionViewPersons")} — ${caseNumber}`}>
      {persons.length === 0 ? (
        <p className="text-sm text-muted">{t("di.map.noPersonsRecorded")}</p>
      ) : (
        <ul className="space-y-2">
          {persons.map((p) => (
            <li key={p.personId} className="rounded-lg border border-border p-3">
              <Link href={withReturnTo(`/drug-intelligence/persons/${encodeURIComponent(p.personId)}`, returnTo)} className="text-sm font-medium text-accent hover:underline">
                {p.primaryFullName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
