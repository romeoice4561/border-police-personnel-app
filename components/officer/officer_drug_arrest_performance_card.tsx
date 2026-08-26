/**
 * OfficerDrugArrestPerformanceCard (Phase DI-7.7, Section 2).
 *
 * "ผลงานการจับกุมยาเสพติด" — a compact, read-only summary card following the
 * SAME Card/CardHeader/CardTitle + Fact-primitive convention as
 * OfficerPromotionIntelligenceCard: every display value comes from the
 * already-composed, already-serialized view model — no arithmetic, no raw
 * enum rendering, no DB access in this component.
 *
 * Gated by can("drug.read") — Officer Profile has no server-verifiable
 * session (see app/officers/[id]/page.tsx's doc comment), so every
 * permission check on this route, including this one, happens client-side
 * via useAuth().can(), matching the officers.view family / drug.read's
 * existing convention everywhere else in the app.
 */
"use client";

import Link from "next/link";
import { ShieldAlert, Users, ClipboardCheck } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import type { OfficerDrugArrestPerformanceView } from "@/lib/drug_intelligence/officer_drug_arrest_performance_client";

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

function Kpi({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-neutral-bg p-3">
      <div className="text-muted" aria-hidden="true">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value.toLocaleString("th-TH")}</p>
      </div>
    </div>
  );
}

export function OfficerDrugArrestPerformanceCard({ summary }: { summary: OfficerDrugArrestPerformanceView | null }) {
  const { t } = useT();
  const { can } = useAuth();

  if (!can("drug.read")) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("officer.drugArrestPerformance.title")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {!summary ? (
          <EmptyState title={t("officer.drugArrestPerformance.emptyTitle")} message={t("officer.drugArrestPerformance.emptyMessage")} icon={<ShieldAlert className="h-8 w-8" />} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label={t("officer.drugArrestPerformance.totalCases")} value={summary.totalCases} icon={<ClipboardCheck className="h-5 w-5" />} />
              <Kpi label={t("officer.drugArrestPerformance.leadCases")} value={summary.leadCases} icon={<ShieldAlert className="h-5 w-5" />} />
              <Kpi label={t("officer.drugArrestPerformance.arrestingOfficerCases")} value={summary.arrestingOfficerCases} icon={<Users className="h-5 w-5" />} />
              <div className="flex items-center gap-3 rounded-xl border border-border bg-neutral-bg p-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{t("officer.drugArrestPerformance.latestArrestDate")}</p>
                  <p className="text-sm font-medium text-foreground">{formatIsoDateTh(summary.latestArrestDate)}</p>
                </div>
              </div>
            </div>

            {summary.aggregateSeizedItems.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("officer.drugArrestPerformance.aggregateSeizedTitle")}</p>
                <p className="mb-1 text-xs text-muted">{t("officer.drugArrestPerformance.aggregateSeizedCaveat")}</p>
                <ul className="space-y-0.5 text-sm text-foreground">
                  {summary.aggregateSeizedItems.map((g) => (
                    <li key={`${g.drugCategory}-${g.measurementKind}`}>- {g.displayTh}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-2 py-2 font-medium">{t("officer.drugArrestPerformance.colCaseNumber")}</th>
                    <th scope="col" className="px-2 py-2 font-medium">{t("officer.drugArrestPerformance.colArrestDate")}</th>
                    <th scope="col" className="px-2 py-2 font-medium">{t("officer.drugArrestPerformance.colLocation")}</th>
                    <th scope="col" className="px-2 py-2 font-medium">{t("officer.drugArrestPerformance.colLeadUnit")}</th>
                    <th scope="col" className="px-2 py-2 font-medium">{t("officer.drugArrestPerformance.colRole")}</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">{t("officer.drugArrestPerformance.colDefendants")}</th>
                    <th scope="col" className="px-2 py-2 font-medium">{t("officer.drugArrestPerformance.colSeized")}</th>
                    <th scope="col" className="px-2 py-2 font-medium">{t("officer.drugArrestPerformance.colStatus")}</th>
                    <th scope="col" className="px-2 py-2 font-medium">{t("officer.drugArrestPerformance.colWorkspace")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.cases.map((c) => (
                    <tr key={c.caseId} className="border-b border-border last:border-0">
                      <td className="px-2 py-2 font-medium text-foreground">{c.caseNumber}</td>
                      <td className="px-2 py-2 text-muted">{formatIsoDateTh(c.arrestDate)}</td>
                      <td className="px-2 py-2 text-muted">{[c.province, c.district].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="px-2 py-2 text-muted">{c.leadUnitText || "—"}</td>
                      <td className="px-2 py-2 text-muted">{c.roleLabelsTh.length > 0 ? c.roleLabelsTh.join(", ") : "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted">{c.defendantCount}</td>
                      <td className="px-2 py-2 text-muted">
                        {c.seizedItems.length > 0 ? c.seizedItems.map((g) => g.displayTh).join(" • ") : "—"}
                      </td>
                      <td className="px-2 py-2 text-muted">{c.statusLabelTh}</td>
                      <td className="px-2 py-2">
                        <Link href={`/drug-intelligence/cases/${encodeURIComponent(c.caseId)}`} className="text-accent hover:underline">
                          {t("officer.drugArrestPerformance.openCase")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
