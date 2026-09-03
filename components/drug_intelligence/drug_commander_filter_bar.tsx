/**
 * CommanderFilterBar (Phase 2B).
 *
 * Canonical dashboard filters: FY, custom dates, reporting unit cascade, province.
 * Updates shareable URL state. Reset restores current FY / all units / all provinces.
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { useOrgTree } from "@/lib/ui/hooks";
import { battalionsForRegion, companiesForBattalion } from "@/lib/organization/org_tree";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { cn } from "@/lib/ui/cn";

export interface CommanderFilterState {
  fy?: string;
  from?: string;
  to?: string;
  hqId?: string;
  regionId?: string;
  battalionId?: string;
  companyId?: string;
  province?: string;
  status?: string;
}

interface CommanderFilterBarProps {
  filterState: CommanderFilterState;
  displayFiscalYearTh?: string;
  className?: string;
}

const THAI_FY_OPTIONS = [
  { label: "ปีงบประมาณ 2569", value: "2569" },
  { label: "ปีงบประมาณ 2568", value: "2568" },
  { label: "ปีงบประมาณ 2567", value: "2567" },
];

function selectClassName(): string {
  return "h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent";
}

export function CommanderFilterBar({ filterState, displayFiscalYearTh, className }: CommanderFilterBarProps) {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgTree = useOrgTree();
  const tree = orgTree.data;
  const currentFy = computeFiscalYearSummary();

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const next = params.toString();
      router.push(next ? `?${next}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  const selectedHq = filterState.hqId ? Number(filterState.hqId) : null;
  const selectedRegion = filterState.regionId ? Number(filterState.regionId) : null;
  const selectedBattalion = filterState.battalionId ? Number(filterState.battalionId) : null;
  const regions = (tree?.regions ?? []).filter((r) => selectedHq === null || r.headquartersId === selectedHq);
  const emptyTree = { headquarters: [], regions: [], battalions: [], companies: [] };
  const battalions =
    selectedRegion !== null
      ? battalionsForRegion(tree ?? emptyTree, selectedRegion)
      : (tree?.battalions ?? []);
  const companies =
    selectedBattalion !== null
      ? companiesForBattalion(tree ?? emptyTree, selectedBattalion)
      : [];

  const hasFilters = Boolean(
    filterState.fy ||
      filterState.from ||
      filterState.to ||
      filterState.hqId ||
      filterState.regionId ||
      filterState.battalionId ||
      filterState.companyId ||
      filterState.province ||
      filterState.status
  );

  const unitLabel =
    (selectedBattalion !== null && tree?.battalions.find((b) => b.id === selectedBattalion)?.nameTh) ||
    (selectedRegion !== null && tree?.regions.find((r) => r.id === selectedRegion)?.nameTh) ||
    (selectedHq !== null && tree?.headquarters.find((h) => h.id === selectedHq)?.nameTh) ||
    t("di.command.scopeAll");

  const fyLabel =
    filterState.from && filterState.to
      ? `${filterState.from} – ${filterState.to}`
      : (displayFiscalYearTh ?? currentFy.displayFiscalYearTh);

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm text-muted" data-testid="commander-filter-summary">
        {t("di.command.filterSummary")}: {fyLabel} • {unitLabel} • {filterState.province || t("di.command.scopeAllProvinces")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[160px] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-fy">{t("di.command.filterFy")}</label>
          <select
            id="cmd-fy"
            value={filterState.fy ?? String(currentFy.fiscalYearBe)}
            onChange={(e) => {
              pushParams((params) => {
                params.delete("from");
                params.delete("to");
                if (e.target.value) params.set("fy", e.target.value);
                else params.delete("fy");
              });
            }}
            className={selectClassName()}
          >
            {THAI_FY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-from">{t("di.command.filterFrom")}</label>
          <input
            id="cmd-from"
            type="date"
            value={filterState.from ?? ""}
            onChange={(e) => {
              pushParams((params) => {
                params.delete("fy");
                if (e.target.value) params.set("from", e.target.value);
                else params.delete("from");
              });
            }}
            className={selectClassName()}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-to">{t("di.command.filterTo")}</label>
          <input
            id="cmd-to"
            type="date"
            value={filterState.to ?? ""}
            onChange={(e) => {
              pushParams((params) => {
                params.delete("fy");
                if (e.target.value) params.set("to", e.target.value);
                else params.delete("to");
              });
            }}
            className={selectClassName()}
          />
        </div>

        <div className="flex min-w-[160px] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-hq">{t("di.command.filterHq")}</label>
          <select
            id="cmd-hq"
            value={filterState.hqId ?? ""}
            onChange={(e) => {
              pushParams((params) => {
                if (e.target.value) params.set("hqId", e.target.value);
                else params.delete("hqId");
                params.delete("regionId");
                params.delete("battalionId");
                params.delete("companyId");
              });
            }}
            className={selectClassName()}
          >
            <option value="">{t("di.command.scopeAll")}</option>
            {(tree?.headquarters ?? []).map((h) => (
              <option key={h.id} value={String(h.id)}>{h.nameTh}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[160px] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-region">{t("di.command.filterRegion")}</label>
          <select
            id="cmd-region"
            value={filterState.regionId ?? ""}
            onChange={(e) => {
              pushParams((params) => {
                if (e.target.value) params.set("regionId", e.target.value);
                else params.delete("regionId");
                params.delete("battalionId");
                params.delete("companyId");
              });
            }}
            className={selectClassName()}
          >
            <option value="">{t("di.command.scopeAll")}</option>
            {regions.map((r) => (
              <option key={r.id} value={String(r.id)}>{r.nameTh}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[180px] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-battalion">{t("di.command.filterBattalion")}</label>
          <select
            id="cmd-battalion"
            value={filterState.battalionId ?? ""}
            onChange={(e) => {
              pushParams((params) => {
                if (e.target.value) params.set("battalionId", e.target.value);
                else params.delete("battalionId");
                params.delete("companyId");
              });
            }}
            className={selectClassName()}
          >
            <option value="">{t("di.command.scopeAll")}</option>
            {battalions.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.nameTh}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[180px] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-company">{t("di.command.filterCompany")}</label>
          <select
            id="cmd-company"
            value={filterState.companyId ?? ""}
            disabled={selectedBattalion === null}
            onChange={(e) => {
              pushParams((params) => {
                if (e.target.value) params.set("companyId", e.target.value);
                else params.delete("companyId");
              });
            }}
            className={selectClassName()}
          >
            <option value="">{t("di.command.scopeAll")}</option>
            {companies.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.nameTh}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[160px] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-province">{t("di.command.filterProvince")}</label>
          <select
            id="cmd-province"
            value={filterState.province ?? ""}
            onChange={(e) => {
              pushParams((params) => {
                if (e.target.value) params.set("province", e.target.value);
                else params.delete("province");
              });
            }}
            className={selectClassName()}
          >
            <option value="">{t("di.command.scopeAllProvinces")}</option>
            {THAI_PROVINCE_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => router.push("?", { scroll: false })}>
            {t("di.command.filterReset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
