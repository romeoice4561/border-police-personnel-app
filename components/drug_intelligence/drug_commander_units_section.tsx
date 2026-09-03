/**
 * CommanderUnitsSection (Phase 2B).
 *
 * Unit performance table — multiple dimensions shown, NOT a combined score.
 * Desktop: table with columns หน่วย | คดี | ผู้ถูกจับ | ยาบ้า (เม็ด) | ไอซ์ (กก.)
 * Mobile: stacked card layout.
 * Max 20 units.
 */
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import { useOrgTree } from "@/lib/ui/hooks";
import { cn } from "@/lib/ui/cn";
import type { CommanderUnitsData } from "@/lib/drug_intelligence/drug_commander_dashboard_types";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { commanderUnitCasesHref } from "@/lib/drug_intelligence/drug_commander_drilldown";
import type { CommanderUrlState } from "@/lib/drug_intelligence/drug_commander_scope";

interface Props {
  data: CommanderUnitsData | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  filter: CommanderDashboardFilter;
  urlState?: CommanderUrlState;
}

export function CommanderUnitsSection({ data, isLoading, isError, onRetry, filter, urlState }: Props) {
  const { t } = useT();
  const orgTree = useOrgTree();

  function unitLabel(row: CommanderUnitsData["rows"][number]): string {
    if (row.unitId === null) return row.unitLabel;
    const tree = orgTree.data;
    if (!tree) return row.unitLabel;
    if (data?.groupBy === "company") return tree.companies.find((c) => c.id === row.unitId)?.nameTh ?? row.unitLabel;
    if (data?.groupBy === "region") return tree.regions.find((r) => r.id === row.unitId)?.nameTh ?? row.unitLabel;
    return tree.battalions.find((b) => b.id === row.unitId)?.nameTh ?? row.unitLabel;
  }

  return (
    <section aria-labelledby="units-heading">
      <CardHeader className="mb-1 px-0">
        <CardTitle id="units-heading">{t("di.command.unitsTitle")}</CardTitle>
      </CardHeader>
      <p className="text-xs text-muted mb-4">{t("di.command.unitsSubtitle")}</p>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState message={t("di.command.loadError")} onRetry={onRetry} />
      )}

      {!isLoading && !isError && data && (
        (() => {
          const unassigned = data.unassignedCaseCount ?? 0;
          const assigned = data.assignedCaseCount ?? data.rows.reduce((sum, row) => sum + row.caseCount, 0);
          if (data.rows.length === 0 && assigned === 0 && unassigned === 0) {
            return <p className="text-sm text-muted py-4">{t("di.command.unitsEmptyNoCases")}</p>;
          }
          if (data.rows.length === 0 && unassigned > 0) {
            return (
              <p className="text-sm text-muted py-4">
                {t("di.command.unitsEmptyAllUnassigned").replace("{count}", String(unassigned))}
              </p>
            );
          }
          if (data.rows.length === 0) {
            return <p className="text-sm text-muted py-4">{t("di.command.unitsEmpty")}</p>;
          }
          return (
          <>
            {unassigned > 0 ? (
              <p className="mb-3 text-xs text-muted" data-testid="commander-units-unassigned">
                {t("di.command.unitsUnassigned").replace("{count}", String(unassigned))}
              </p>
            ) : null}
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm" aria-label={t("di.command.unitsTitle")}>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="py-2 pr-4 font-medium">{t("di.command.unitsColUnit")}</th>
                    <th className="py-2 pr-4 font-medium text-right">{t("di.command.unitsColCases")}</th>
                    <th className="py-2 pr-4 font-medium text-right">{t("di.command.unitsColPersons")}</th>
                    <th className="py-2 pr-4 font-medium text-right">{t("di.command.unitsColMeth")}</th>
                    <th className="py-2 font-medium text-right">{t("di.command.unitsColCrystal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, idx) => (
                    <tr
                      key={row.unitId ?? `null-${idx}`}
                      className={cn("border-b border-border/50", idx % 2 === 0 ? "" : "bg-neutral-bg/30")}
                    >
                      <td className="py-2 pr-4 font-medium">
                        <Link
                          href={commanderUnitCasesHref(filter, row.unitId, data.groupBy, urlState)}
                          className="rounded hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {unitLabel(row)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.caseCount.toLocaleString("th-TH")}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.arrestedPersonCount.toLocaleString("th-TH")}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted">
                        {row.methTabletCount !== null
                          ? row.methTabletCount.toLocaleString("th-TH")
                          : <span className="text-muted/50">—</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted">
                        {row.iceCrystalKg !== null
                          ? row.iceCrystalKg.toLocaleString("th-TH", { maximumFractionDigits: 3 })
                          : <span className="text-muted/50">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked */}
            <div className="flex flex-col gap-3 md:hidden">
              {data.rows.map((row, idx) => (
                <Link
                  key={row.unitId ?? `null-${idx}`}
                  href={commanderUnitCasesHref(filter, row.unitId, data.groupBy, urlState)}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                <Card className="p-4 hover:border-accent/50">
                  <div className="mb-2 font-medium">{unitLabel(row)}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted">{t("di.command.unitsColCases")}</span>
                    <span className="text-right tabular-nums font-medium">{row.caseCount.toLocaleString("th-TH")}</span>
                    <span className="text-muted">{t("di.command.unitsColPersons")}</span>
                    <span className="text-right tabular-nums">{row.arrestedPersonCount.toLocaleString("th-TH")}</span>
                    {row.methTabletCount !== null && (
                      <>
                        <span className="text-muted">{t("di.command.unitsColMeth")}</span>
                        <span className="text-right tabular-nums">{row.methTabletCount.toLocaleString("th-TH")}</span>
                      </>
                    )}
                    {row.iceCrystalKg !== null && (
                      <>
                        <span className="text-muted">{t("di.command.unitsColCrystal")}</span>
                        <span className="text-right tabular-nums">
                          {row.iceCrystalKg.toLocaleString("th-TH", { maximumFractionDigits: 3 })}
                        </span>
                      </>
                    )}
                  </div>
                </Card>
                </Link>
              ))}
            </div>
          </>
          );
        })()
      )}
    </section>
  );
}
