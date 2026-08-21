/**
 * Drug Intelligence landing page (Phase DI-1 Round 2, Section 4).
 *
 * Summary-first: KPI row (clickable), quick actions gated on permission.
 * No network/timeline/map widgets in DI-1 (Section 4/23) — those pages
 * simply don't exist yet, not a disabled placeholder cluttering this page.
 */
"use client";

import Link from "next/link";
import { FileText, Users, Phone, Smartphone, Car, Plus, List } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { DrugKpiTile } from "@/components/drug_intelligence/drug_kpi_tile";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugStats } from "@/lib/drug_intelligence/drug_intelligence_hooks";

export default function DrugIntelligenceLandingPage() {
  const { user, can } = useAuth();
  const { t } = useT();
  const stats = useDrugStats(user?.id ?? null);

  return (
    <div className="space-y-6">
      <PageHeader title={t("di.landing.title")} description={t("di.landing.description")} />

      {stats.isPending ? (
        <LoadingState rows={2} />
      ) : stats.isError ? (
        <ErrorState message={(stats.error as Error).message} onRetry={() => stats.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <DrugKpiTile label={t("di.landing.kpiCases")} value={stats.data.totalCases} icon={FileText} href="/drug-intelligence/cases" />
          <DrugKpiTile label={t("di.landing.kpiPersons")} value={stats.data.totalPersons} icon={Users} href="/drug-intelligence/cases" />
          <DrugKpiTile label={t("di.landing.kpiPhones")} value={stats.data.totalPhones} icon={Phone} href="/drug-intelligence/cases" />
          <DrugKpiTile label={t("di.landing.kpiDevices")} value={stats.data.totalDevices} icon={Smartphone} href="/drug-intelligence/cases" />
          <DrugKpiTile label={t("di.landing.kpiVehicles")} value={stats.data.totalVehicles} icon={Car} href="/drug-intelligence/cases" />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t("di.landing.quickActions")}</h2>
        <div className="flex flex-wrap gap-2">
          {can("drug.create") ? (
            <Button asChild>
              <Link href="/drug-intelligence/cases/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("di.list.newCase")}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/drug-intelligence/cases">
              <List className="h-4 w-4" aria-hidden="true" />
              {t("di.landing.viewAllCases")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
