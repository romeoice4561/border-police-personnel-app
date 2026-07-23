"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderQueryFilters, CommanderSortField, DrilldownFilter, NumericFilter } from "@/components/commander/query/types";
import { matchesSkillFilter } from "@/lib/capability/skill_filter";
import { matchesDocumentIntelligenceFilters } from "@/lib/integration/navigation/document_filter_matching";
import { serializeCommanderDocumentFilters } from "@/lib/integration/navigation/drilldown_contract";
import { DOCUMENT_FILTER_QUERY_KEYS } from "@/lib/integration/navigation/document_filter_types";
import { CommanderQueryBuilder, type QueryMode } from "@/components/commander/filters/commander_query_builder";
import { CommanderSearchPresets } from "@/components/commander/filters/commander_search_presets";
import { CommanderQuerySummary } from "@/components/commander/summary/commander_query_summary";
import { CommanderIntelligenceSummary } from "@/components/commander/summary/commander_intelligence_summary";
import { CommanderEligibilityCards } from "@/components/commander/summary/commander_eligibility_cards";
import { CommanderQueryCharts } from "@/components/commander/charts/commander_query_charts";
import { CommanderTimelineCharts } from "@/components/commander/charts/commander_timeline_charts";
import { CommanderResultsTable } from "@/components/commander/results/commander_results_table";
import { CommanderExportBar } from "@/components/commander/query/commander_export_bar";
import { buildCommanderInsightTh } from "@/lib/commander_query/commander_insight";
import { describeFiltersTh, type CommanderExportMeta } from "@/lib/commander_query/commander_export";
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { formatFullThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import type { CommanderPreset } from "@/lib/commander_query/presets";
import { useT } from "@/components/i18n/language_provider";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function matchesNumber(value: number | null, filter: NumericFilter | undefined): boolean {
  if (!filter) return true;
  if (value == null) return false;
  if (filter.operator === "exactly") return Math.round(value) === filter.value;
  if (filter.operator === "at_least") return value >= filter.value;
  if (filter.operator === "more_than") return value > filter.value;
  return value < filter.value;
}

function matchesDrilldown(row: CommanderQueryOfficer, drilldown: DrilldownFilter | null): boolean {
  if (!drilldown) return true;
  return row[drilldown.field] === drilldown.value;
}

function applyFilters(row: CommanderQueryOfficer, filters: CommanderQueryFilters, drilldown: DrilldownFilter | null): boolean {
  if (!matchesDrilldown(row, drilldown)) return false;
  if (filters.rank && row.rank !== filters.rank) return false;
  if (filters.currentPosition && !(row.currentPosition ?? "").includes(filters.currentPosition)) return false;
  if (filters.positionLevel && row.positionLevel !== filters.positionLevel) return false;
  if (filters.regionId != null && row.regionId !== filters.regionId) return false;
  if (filters.battalionId != null && row.battalionId !== filters.battalionId) return false;
  if (filters.companyId != null && row.companyId !== filters.companyId) return false;
  if (filters.promotionStatus && row.promotionStatus !== filters.promotionStatus) return false;
  // Phase 42: richer Promotion Intelligence status (lib/intelligence/promotion),
  // distinct from the legacy score-ratio `promotionStatus` filter above.
  if (filters.promotionEligibilityStatus && row.promotionIntelligence.promotionStatus !== filters.promotionEligibilityStatus) return false;
  if (filters.flagCode && !row.flagCodes.includes(filters.flagCode)) return false;
  if (filters.priority && row.priority !== filters.priority) return false;
  if (filters.minProfileCompleteness != null && (row.profileCompletenessPercent ?? 0) < filters.minProfileCompleteness) return false;
  // Phase 41 Part 2: promotion-eligibility search. `fromRank`/`fromPositionLevel`
  // constrain the CURRENT rank/level; `toPositionLevel`/`eligibilityStatus`
  // constrain the officer's precomputed next-level eligibility.
  if (filters.fromRank && row.rank !== filters.fromRank) return false;
  if (filters.fromPositionLevel && row.positionLevel !== filters.fromPositionLevel) return false;
  if (filters.toPositionLevel && row.nextLevelEligibility?.targetLevel !== filters.toPositionLevel) return false;
  if (filters.readyForPromotion && row.nextLevelEligibility?.eligibleNow !== true) return false;
  if (filters.eligibilityStatus && row.nextLevelEligibility?.status !== filters.eligibilityStatus) return false;
  if (filters.promotionCycleBucket) {
    const expected = filters.promotionCycleBucket === "eligible_year_1" ? "eligible_this_cycle" : filters.promotionCycleBucket;
    if (row.promotionCycleBucket !== expected) return false;
  }
  // Phase 41 Part 5: preset boolean toggles.
  if (filters.eligibleTwoStepOnly && !row.eligibleTwoStep) return false;
  if (filters.mustSkipStepOnly && !row.mustSkipStep) return false;
  if (filters.missingGp7Only && row.hasGp7) return false;
  // Phase 44: capability filter — all present skill constraints must be met by the SAME recorded skill.
  if (filters.skill && !matchesSkillFilter(row.skillSignals, filters.skill)) return false;
  // Phase 42: Commander Dashboard retirement-awareness drill-down. Uses the
  // already-computed `retirementYear` (Gregorian, internal — see its own
  // doc comment) compared against the current Gregorian year; a cumulative
  // "within N years" match, matching how the Dashboard counts these bands.
  if (filters.retirementWithin) {
    if (row.retirementYear == null) return false;
    const horizonYears = filters.retirementWithin === "within-1-year" ? 1 : filters.retirementWithin === "within-3-years" ? 3 : 5;
    const currentYear = new Date().getUTCFullYear();
    if (row.retirementYear - currentYear > horizonYears) return false;
  }
  // Phase 45: Training Intelligence status filter — reads the SAME
  // TrainingSummary every other consumer (Dashboard, Officer Workspace) reads.
  if (filters.trainingStatus && row.trainingIntelligence.trainingStatus !== filters.trainingStatus) return false;
  // Phase 49.7: exact-year promotion filters — canonical fields only, no
  // recalculation. positionLevelStartYearBe is the same field the results
  // table already displays; firstEligibleYearBe reads the PROJECTED first-
  // eligible year (computable pre-eligibility, unlike eligibleFiscalYearBe).
  if (filters.positionLevelStartYearBe != null && row.positionLevelStartYearBe !== filters.positionLevelStartYearBe) return false;
  if (filters.firstEligibleYearBe != null && row.promotionIntelligence.firstEligibleFiscalYearBe !== filters.firstEligibleYearBe) return false;
  // Phase 49.8: reads the canonical PromotionSummary.confidence field
  // directly — no local recalculation, no Thai-label matching.
  if (filters.promotionDataQuality === "assessable" && row.promotionIntelligence.confidence !== "confirmed") return false;
  if (filters.promotionDataQuality === "not-assessable" && row.promotionIntelligence.confidence === "confirmed") return false;
  // Phase 45.1: Personnel Master Data filters (Task 9 — privacy-safe only).
  if (filters.academyClass != null && row.academyClass !== filters.academyClass) return false;
  if (filters.isGpfMember != null && row.isGpfMember !== filters.isGpfMember) return false;
  if (filters.isCooperativeMember != null && row.isCooperativeMember !== filters.isCooperativeMember) return false;
  if (filters.cooperativeName && !(row.cooperativeName ?? "").toLowerCase().includes(filters.cooperativeName.toLowerCase())) return false;
  // Phase 49A: document-intelligence filters — reads row.documentIntelligence
  // and row.documentExpiryInfo, both computed ONCE per officer in
  // toQueryOfficer.ts, never re-derived here.
  if (!matchesDocumentIntelligenceFilters(row.documentIntelligence, row.documentExpiryInfo, filters)) return false;
  return (
    matchesNumber(row.completedPromotionCycles, filters.completedPromotionCycles) &&
    matchesNumber(row.appointmentCycle, filters.appointmentCycle) &&
    matchesNumber(row.yearsInRank, filters.yearsInRank) &&
    matchesNumber(row.yearsInPosition, filters.yearsInPosition) &&
    matchesNumber(row.yearsInPositionLevel, filters.yearsInPositionLevel) &&
    matchesNumber(row.ageYears, filters.age) &&
    matchesNumber(row.governmentServiceYears, filters.governmentServiceYears)
  );
}

function sortRows(rows: CommanderQueryOfficer[], sortBy: CommanderSortField, direction: "asc" | "desc"): CommanderQueryOfficer[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    if (typeof aValue === "number" || typeof bValue === "number") {
      return (((aValue as number | null) ?? -1) - ((bValue as number | null) ?? -1)) * multiplier;
    }
    return String(aValue ?? "").localeCompare(String(bValue ?? ""), "th") * multiplier;
  });
}

const DEFAULT_SORT: CommanderSortField = "priority";
const DEFAULT_SORT_DIRECTION: "asc" | "desc" = "desc";

export function CommanderQueryCenter({
  dataset,
  initialFilters,
}: {
  dataset: CommanderQueryDataset;
  /** Phase 42: seeds the filter state from a shareable URL (e.g. a Commander Dashboard drill-down link). Every OTHER filter field is still applied once on mount only — pure client state, matching the existing convention. Phase 49A's document-intelligence fields are the one exception: see the URL-sync effect below, which keeps them (and ONLY them) continuously reflected in the URL so reload/back/forward/bookmark all reproduce the exact same document-filtered result, per spec. */
  initialFilters?: CommanderQueryFilters;
}) {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<CommanderQueryFilters>(initialFilters ?? {});
  const [mode, setMode] = useState<QueryMode>("personnel");
  const [activePresetId, setActivePresetId] = useState<string | undefined>(undefined);
  const [activeCardLevel, setActiveCardLevel] = useState<string | undefined>(undefined);
  const [drilldown, setDrilldown] = useState<DrilldownFilter | null>(null);
  const [sortBy, setSortBy] = useState<CommanderSortField>(DEFAULT_SORT);

  // Phase 49A (§5): document-intelligence filters are the URL's source of
  // truth. Every OTHER filter stays pure client state (unchanged, matching
  // the pre-existing convention) — this effect touches ONLY the 7
  // document-filter query keys, leaving any other param (promotion,
  // training, etc.) exactly as the browser already has it. router.replace
  // (not push) avoids spamming browser history on every keystroke/toggle
  // while still keeping the address bar and reload/bookmark behavior
  // accurate; native back/forward across an ACTUAL navigation (e.g.
  // arriving via a Dashboard drill-down link, then hitting Back) is
  // unaffected since that's a real history entry Next.js already handles.
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of DOCUMENT_FILTER_QUERY_KEYS) next.delete(key);
    const documentParams = serializeCommanderDocumentFilters(filters);
    for (const [key, value] of Object.entries(documentParams)) next.set(key, value);
    const nextQuery = next.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `/commander-search?${nextQuery}` : "/commander-search", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes `router`/`searchParams` (stable-enough Next.js APIs; including them causes an update loop since this effect itself changes the URL) — only `filters` should re-trigger sync.
  }, [filters]);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(DEFAULT_SORT_DIRECTION);
  const resultsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const matches = dataset.officers.filter((row) => applyFilters(row, filters, drilldown));
    return sortRows(matches, sortBy, sortDirection);
  }, [dataset.officers, drilldown, filters, sortBy, sortDirection]);

  /** Task A6: deterministic (non-LLM), recomputed only when the filtered set changes. */
  const insight = useMemo(() => buildCommanderInsightTh(filtered), [filtered]);

  /** Task A7: export/print metadata — Thai title, filters applied, result count, Buddhist-Era generation date, current fiscal year. */
  const exportMeta: CommanderExportMeta = useMemo(() => {
    const now = new Date();
    return {
      titleTh: "รายงานผลการค้นหากำลังพล (ผู้บังคับบัญชา)",
      filtersAppliedTh: describeFiltersTh(filters),
      resultCount: filtered.length,
      generatedOnTh: `สร้างเมื่อ ${formatFullThaiDateTh(now)}`,
      fiscalYearTh: computeFiscalYearSummary(now).displayFiscalYearTh,
    };
  }, [filtered.length, filters]);

  /** When the user hand-edits filters, any active preset/card selection no longer describes the state. */
  function handleFilterChange(next: CommanderQueryFilters) {
    setFilters(next);
    setActivePresetId(undefined);
    setActiveCardLevel(undefined);
  }

  /** Clear the filter VALUES only (keep the current mode). Part 6. */
  function clearFilters() {
    setFilters({});
    setDrilldown(null);
    setActivePresetId(undefined);
    setActiveCardLevel(undefined);
  }

  /** Reset EVERYTHING to defaults. Part 6. */
  function resetAll() {
    setFilters({});
    setDrilldown(null);
    setActivePresetId(undefined);
    setActiveCardLevel(undefined);
    setMode("personnel");
    setSortBy(DEFAULT_SORT);
    setSortDirection(DEFAULT_SORT_DIRECTION);
  }

  function applyPreset(preset: CommanderPreset) {
    setFilters(preset.filters);
    setDrilldown(null);
    setActivePresetId(preset.id);
    setActiveCardLevel(undefined);
    // A "ready for level" preset naturally belongs to the promotion view.
    if (preset.filters.toPositionLevel) setMode("promotion");
  }

  function applyEligibilityCard(cardFilters: CommanderQueryFilters) {
    setFilters(cardFilters);
    setDrilldown(null);
    setActivePresetId(undefined);
    setActiveCardLevel(cardFilters.toPositionLevel);
    setMode("promotion");
  }

  /** Task A2: clicking an Intelligence Summary status card replaces filters with just that status — the same field Commander Dashboard drill-down links already use. */
  function applyIntelligenceSummaryCard(cardFilters: CommanderQueryFilters) {
    setFilters(cardFilters);
    setDrilldown(null);
    setActivePresetId(undefined);
    setActiveCardLevel(undefined);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <CommanderQueryBuilder
          options={dataset.options}
          value={filters}
          mode={mode}
          onModeChange={setMode}
          onChange={handleFilterChange}
          onApply={() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          onClearFilters={clearFilters}
          onResetAll={resetAll}
        />
        <CommanderExportBar officers={filtered} meta={exportMeta} />
      </aside>

      <section ref={resultsRef} className="min-w-0 space-y-5">
        <CommanderSearchPresets activePresetId={activePresetId} onApply={applyPreset} />
        <CommanderEligibilityCards officers={filtered} activeLevel={activeCardLevel} onSelect={(f) => applyEligibilityCard(f)} />
        {drilldown ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
            <span className="text-foreground">{t("commander.drilldown")}: {drilldown.label}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDrilldown(null)}>{t("commander.clearDrilldown")}</Button>
          </div>
        ) : null}
        <Card>
          <CardBody className="text-sm text-foreground">{insight}</CardBody>
        </Card>
        <CommanderIntelligenceSummary
          officers={filtered}
          activeStatus={filters.promotionEligibilityStatus}
          onSelectStatus={applyIntelligenceSummaryCard}
        />
        <CommanderQuerySummary officers={filtered} onDrilldown={setDrilldown} />
        <CommanderQueryCharts officers={filtered} onDrilldown={setDrilldown} />
        <CommanderTimelineCharts officers={filtered} onDrilldown={setDrilldown} />
        <CommanderResultsTable officers={filtered} documentFiltersActive={DOCUMENT_FILTER_QUERY_KEYS.some((key) => filters[key] !== undefined)} />
      </section>
    </div>
  );
}
