/**
 * CommanderFilterBar (Phase 2B / 2C).
 *
 * Canonical dashboard filters: FY, custom Thai calendar dates, reporting unit
 * cascade, province. Custom dates use ThaiDatePicker (ISO wire, BE display).
 * Pending URLSearchParams merge so rapid from→to cannot drop the other bound.
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ThaiDatePicker, THAI_EXPIRY_YEAR_BE_MIN, THAI_EXPIRY_YEAR_BE_MAX } from "@/components/ui/thai_date_picker";
import { useT } from "@/components/i18n/language_provider";
import { useOrgTree } from "@/lib/ui/hooks";
import { battalionsForRegion, companiesForBattalion } from "@/lib/organization/org_tree";
import { THAI_PROVINCE_OPTIONS } from "@/lib/officer_profile/thai_province_options";
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { cn } from "@/lib/ui/cn";
import {
  COMMANDER_INCOMPLETE_RANGE_MESSAGE_TH,
  COMMANDER_INVALID_RANGE_MESSAGE_TH,
  commanderHasActiveFilters,
  commanderPeriodKind,
  formatCommanderPeriodLabel,
  sanitizeCommanderOrgState,
  commanderOrgStateEquals,
  type CommanderUrlState,
} from "@/lib/drug_intelligence/drug_commander_scope";

export type CommanderFilterState = CommanderUrlState;

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

const COMMANDER_YEAR_RANGE = { min: THAI_EXPIRY_YEAR_BE_MIN, max: THAI_EXPIRY_YEAR_BE_MAX };

function selectClassName(): string {
  return "h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent";
}

function stateFromParams(params: URLSearchParams): CommanderUrlState {
  return {
    fy: params.get("fy") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    hqId: params.get("hqId") ?? undefined,
    regionId: params.get("regionId") ?? undefined,
    battalionId: params.get("battalionId") ?? undefined,
    companyId: params.get("companyId") ?? undefined,
    province: params.get("province") ?? undefined,
    status: params.get("status") ?? undefined,
  };
}

function writeStateToParams(params: URLSearchParams, state: CommanderUrlState): void {
  const keys = ["fy", "from", "to", "hqId", "regionId", "battalionId", "companyId", "province", "status"] as const;
  for (const key of keys) {
    const value = state[key];
    if (value) params.set(key, value);
    else params.delete(key);
  }
}

export function CommanderFilterBar({ filterState, displayFiscalYearTh, className }: CommanderFilterBarProps) {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgTree = useOrgTree();
  const tree = orgTree.data;
  const currentFy = computeFiscalYearSummary();
  const pendingParamsRef = useRef<URLSearchParams | null>(null);
  const rangeErrorId = useId();

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = pendingParamsRef.current
        ? new URLSearchParams(pendingParamsRef.current.toString())
        : new URLSearchParams(searchParams.toString());
      mutate(params);
      pendingParamsRef.current = new URLSearchParams(params.toString());
      const next = params.toString();
      router.push(next ? `/drug-intelligence/command?${next}` : "/drug-intelligence/command", { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const current = searchParams.toString();
    if (pendingParamsRef.current && pendingParamsRef.current.toString() === current) {
      pendingParamsRef.current = null;
    }
  }, [searchParams]);

  useEffect(() => {
    if (!tree) return;
    const source = pendingParamsRef.current ?? new URLSearchParams(searchParams.toString());
    const current = stateFromParams(source);
    const sanitized = sanitizeCommanderOrgState(current, tree);
    if (commanderOrgStateEquals(current, sanitized)) return;
    pushParams((params) => writeStateToParams(params, sanitized));
    // Org ids + tree only — do not re-run on custom date edits.
  }, [tree, filterState.hqId, filterState.regionId, filterState.battalionId, filterState.companyId, pushParams, searchParams]);

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

  const periodKind = commanderPeriodKind(filterState);
  const rangeInvalid = periodKind === "invalid";
  const rangeIncomplete = periodKind === "incomplete";
  const fyFallback = displayFiscalYearTh ?? currentFy.displayFiscalYearTh;
  const periodLabel = formatCommanderPeriodLabel(filterState, fyFallback);
  const hasFilters = commanderHasActiveFilters(filterState);

  const unitLabel =
    (selectedBattalion !== null && tree?.battalions.find((b) => b.id === selectedBattalion)?.nameTh) ||
    (selectedRegion !== null && tree?.regions.find((r) => r.id === selectedRegion)?.nameTh) ||
    (selectedHq !== null && tree?.headquarters.find((h) => h.id === selectedHq)?.nameTh) ||
    t("di.command.scopeAllReportingUnits");

  const fySelectValue = periodKind === "fy" ? (filterState.fy ?? String(currentFy.fiscalYearBe)) : "custom";

  // Phase 2C.1: Production same-pathname router.push is a no-op (DI-8.2.1 class).
  // Reset is the only Commander action that must drop ALL query state, so it
  // uses a real browser navigation to the canonical clean path.
  const resetCommanderFilters = useCallback(() => {
    window.location.assign("/drug-intelligence/command");
  }, []);

  function setCustomDate(bound: "from" | "to", iso: string) {
    pushParams((params) => {
      params.delete("fy");
      if (iso) params.set(bound, iso);
      else params.delete(bound);
    });
  }

  return (
    <div className={cn("space-y-3 overflow-visible", className)}>
      <p className="text-sm text-muted" data-testid="commander-filter-summary">
        {t("di.command.filterSummary")}: {periodLabel} • {unitLabel} • {filterState.province || t("di.command.scopeAllProvinces")}
      </p>
      <p className="text-xs text-muted">{t("di.command.filterReportingUnitHint")}</p>
      <div className="flex flex-wrap items-end gap-3 overflow-visible">
        <div className="flex min-w-[160px] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-fy">{t("di.command.filterFy")}</label>
          <select
            id="cmd-fy"
            value={fySelectValue}
            onChange={(e) => {
              if (e.target.value === "custom") return;
              pushParams((params) => {
                params.delete("from");
                params.delete("to");
                if (e.target.value) params.set("fy", e.target.value);
                else params.delete("fy");
              });
            }}
            className={selectClassName()}
            aria-label={t("di.command.filterFy")}
          >
            {periodKind !== "fy" ? (
              <option value="custom">{t("di.command.filterCustomPeriod")}</option>
            ) : null}
            {THAI_FY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[11rem] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-from">{t("di.command.filterFrom")}</label>
          <ThaiDatePicker
            id="cmd-from"
            value={filterState.from ?? ""}
            onChange={(iso) => setCustomDate("from", iso)}
            placeholder={t("di.command.filterDatePlaceholder")}
            aria-label={t("di.command.filterFromAria")}
            aria-invalid={rangeInvalid}
            aria-describedby={rangeInvalid || rangeIncomplete ? rangeErrorId : undefined}
            outputFormat="iso"
            displayFormat="short"
            commitOnBrowse={false}
            showTodayButton
            yearRangeBE={COMMANDER_YEAR_RANGE}
            data-testid="commander-date-from"
          />
        </div>

        <div className="flex min-w-[11rem] flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="cmd-to">{t("di.command.filterTo")}</label>
          <ThaiDatePicker
            id="cmd-to"
            value={filterState.to ?? ""}
            onChange={(iso) => setCustomDate("to", iso)}
            placeholder={t("di.command.filterDatePlaceholder")}
            aria-label={t("di.command.filterToAria")}
            aria-invalid={rangeInvalid}
            aria-describedby={rangeInvalid || rangeIncomplete ? rangeErrorId : undefined}
            outputFormat="iso"
            displayFormat="short"
            commitOnBrowse={false}
            showTodayButton
            yearRangeBE={COMMANDER_YEAR_RANGE}
            data-testid="commander-date-to"
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="commander-filter-reset"
            onClick={resetCommanderFilters}
          >
            {t("di.command.filterReset")}
          </Button>
        ) : null}
      </div>
      {rangeInvalid ? (
        <p id={rangeErrorId} role="alert" className="text-sm text-serious" data-testid="commander-date-range-error">
          {COMMANDER_INVALID_RANGE_MESSAGE_TH}
        </p>
      ) : null}
      {rangeIncomplete ? (
        <p id={rangeErrorId} className="text-sm text-muted" data-testid="commander-date-range-incomplete">
          {COMMANDER_INCOMPLETE_RANGE_MESSAGE_TH}
        </p>
      ) : null}
    </div>
  );
}
