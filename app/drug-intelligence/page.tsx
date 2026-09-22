/**
 * Drug Intelligence landing page (Phase DI-1 Round 2, Section 4).
 *
 * Summary-first: KPI row (clickable), quick actions gated on permission.
 * No network/timeline/map widgets in DI-1 (Section 4/23) — those pages
 * simply don't exist yet, not a disabled placeholder cluttering this page.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { FileText, Users, Phone, Smartphone, Car, Plus, List, ScanSearch, Search, FolderDown } from "lucide-react";
import { PageHeader } from "@/components/common/page_header";
import { LoadingState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { DrugKpiTile } from "@/components/drug_intelligence/drug_kpi_tile";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugStats } from "@/lib/drug_intelligence/drug_intelligence_hooks";

export default function DrugIntelligenceLandingPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const { t } = useT();
  const stats = useDrugStats(user?.id ?? null);
  const [searchDraft, setSearchDraft] = useState("");

  function goToSearch() {
    if (!searchDraft.trim()) return;
    router.push(`/drug-intelligence/search?${new URLSearchParams({ q: searchDraft }).toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("di.landing.title")} description={t("di.landing.description")} />

      {can("drug.read") ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goToSearch();
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t("di.search.placeholder")}
            aria-label={t("di.search.title")}
            className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-24 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Button type="submit" size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2" disabled={!searchDraft.trim()}>
            <ScanSearch className="h-4 w-4" aria-hidden="true" />
            {t("di.search.searchButton")}
          </Button>
        </form>
      ) : null}

      {stats.isPending ? (
        <LoadingState rows={2} />
      ) : stats.isError ? (
        <ErrorState message={(stats.error as Error).message} onRetry={() => stats.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* DI-8.6: each KPI now routes to ITS OWN list/search surface instead of
              all five silently landing on /cases (previous behavior — a broken
              "clickable KPI" affordance). Persons has a real list page; Phones/
              Devices/Vehicles have no dedicated list route (only /[id] detail
              routes exist — see app/drug-intelligence/{phones,devices,vehicles}/),
              so they route to Search Center pre-filtered by entity type, the
              correct existing surface for that data (di.search entityType param,
              app/drug-intelligence/search/page.tsx). */}
          <DrugKpiTile label={t("di.landing.kpiCases")} value={stats.data.totalCases} icon={FileText} href="/drug-intelligence/cases" />
          <DrugKpiTile label={t("di.landing.kpiPersons")} value={stats.data.totalPersons} icon={Users} href="/drug-intelligence/persons" />
          <DrugKpiTile label={t("di.landing.kpiPhones")} value={stats.data.totalPhones} icon={Phone} href="/drug-intelligence/search?entityType=PHONE" />
          <DrugKpiTile label={t("di.landing.kpiDevices")} value={stats.data.totalDevices} icon={Smartphone} href="/drug-intelligence/search?entityType=DEVICE" />
          <DrugKpiTile label={t("di.landing.kpiVehicles")} value={stats.data.totalVehicles} icon={Car} href="/drug-intelligence/search?entityType=VEHICLE" />
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
          {can("drug.export") ? (
            <Button asChild variant="outline" data-testid="landing-reports-link">
              <Link href="/drug-intelligence/reports">
                <FolderDown className="h-4 w-4" aria-hidden="true" />
                {t("di.reports.title")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
