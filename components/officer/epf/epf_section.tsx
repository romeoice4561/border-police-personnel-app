/**
 * EpfSection (Phase 46 — Foundation; Phase 46A — Intelligence Dashboard;
 * Phase 46B — Executive UX & Intelligence Polish;
 * Phase 46C — Executive Layout & Information Hierarchy Refinement).
 *
 * The "Electronic Personnel File (e-PF)" document center — replaces
 * DocumentsSection's rendering slot in the officer workspace (positioned
 * immediately before the Media/Photo Gallery section). Structured by
 * category (see lib/document/document_categories.ts), with e-PF-local
 * search/filter/sort, a detail drawer, and the same underlying
 * upload/download/delete/history endpoints the original DocumentsSection
 * used — no API/behavior regression, only a restructured presentation layer.
 *
 * Phase 46A's intelligence layer (lib/document/epf_intelligence.ts) is
 * UNCHANGED — this phase only reorders/consolidates PRESENTATION.
 *
 * Phase 46C deduplication (spec §1/§13 — "each important metric appears only
 * once"):
 *   - Completion %, document count, storage used, and last update now live
 *     ONLY in EpfHeroSummary (which also now carries the Healthy/Needs
 *     Attention/Incomplete verdict, folded in from the old separate badge).
 *   - EpfFileHealthCard was merged with the old separate completeness card —
 *     it shows Complete/Missing/Unknown counts + a compact secondary bar,
 *     never repeating the Hero's giant percentage figure.
 *   - EpfKpiDashboard (8 cards that mostly re-showed Hero data) was REMOVED
 *     and replaced by EpfSecondaryStats, which shows only information not
 *     displayed anywhere else: categories used, largest file, image/PDF/
 *     other counts, and a storage-type distribution bar.
 *   - AI Insights now renders immediately under the Hero (spec §4), with
 *     Recommended Next Actions beside it on desktop / below on mobile
 *     (spec §5).
 *   - The Missing Documents panel is now grouped into Required/Professional/
 *     Optional sections (lib/document/epf_missing_document_groups.ts — a
 *     static, presentation-only classification, never a business rule).
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IdCard,
  FileStack,
  GraduationCap,
  BookOpen,
  Award,
  HeartPulse,
  Wallet,
  Crosshair,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";
import type { OfficerDocument } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { getDocumentCategories } from "@/lib/document/document_categories";
import { getDocumentTypes } from "@/lib/document/document_types";
import { documentStatus } from "@/lib/document/document_status";
import {
  computeDashboardStats,
  computeCompleteness,
  missingChecklistItems,
  computeRecentActivity,
  computeStorageSummary,
  computeCategoryRollups,
} from "@/lib/document/epf_intelligence";
import { computeFileHealth, computeInsights, computeRecommendedActions, groupRecentActivity } from "@/lib/document/epf_insights";
import { EditableSectionCard } from "@/components/officer/editable_section_card";
import { EpfCategoryGroup } from "@/components/officer/epf/epf_category_group";
import { EpfSearchFilterBar, type EpfFilterState } from "@/components/officer/epf/epf_search_filter_bar";
import { EpfDetailDrawer } from "@/components/officer/epf/epf_detail_drawer";
import { EpfEmptyState } from "@/components/officer/epf/epf_empty_state";
import { EpfSecondaryStats } from "@/components/officer/epf/epf_secondary_stats";
import { EpfHeroSummary } from "@/components/officer/epf/epf_hero_summary";
import { EpfFileHealthCard } from "@/components/officer/epf/epf_file_health_card";
import { EpfInsightsCard } from "@/components/officer/epf/epf_insights_card";
import { EpfNextActionsCard } from "@/components/officer/epf/epf_next_actions_card";
import { EpfMissingPanel } from "@/components/officer/epf/epf_missing_panel";
import { EpfRecentActivity } from "@/components/officer/epf/epf_recent_activity";
import { EpfQuickActions } from "@/components/officer/epf/epf_quick_actions";
import { useT } from "@/components/i18n/language_provider";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  IDENTITY: IdCard,
  OFFICIAL_PERSONNEL: FileStack,
  EDUCATION: GraduationCap,
  TRAINING: BookOpen,
  AWARDS: Award,
  MEDICAL: HeartPulse,
  FINANCIAL: Wallet,
  WEAPONS_QUALIFICATION: Crosshair,
  MISCELLANEOUS: FolderKanban,
};

const DEFAULT_FILTER_STATE: EpfFilterState = {
  search: "",
  category: "ALL",
  status: "ALL",
  year: "ALL",
  uploadedBy: "ALL",
  sort: "newest",
};

export function EpfSection({
  officerId,
  documents,
  portrait,
}: {
  officerId: string;
  documents: OfficerDocument[];
  /** Already-resolved by the workspace — used only to derive the "Official Portrait" completeness signal (source !== "PLACEHOLDER"). Never triggers a portrait upload from here. */
  portrait?: ResolvedOfficerPortrait;
}) {
  const { t } = useT();
  const router = useRouter();
  const [filterState, setFilterState] = useState<EpfFilterState>(DEFAULT_FILTER_STATE);
  const [detailTypeCode, setDetailTypeCode] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set(getDocumentCategories().map((c) => c.code)));

  const onRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const documentTypes = getDocumentTypes();
  const categories = getDocumentCategories();

  const activeByType = useMemo(() => {
    const map = new Map<string, OfficerDocument>();
    for (const doc of documents) {
      if (!doc.isActive) continue;
      const existing = map.get(doc.documentType);
      if (!existing || doc.version > existing.version) map.set(doc.documentType, doc);
    }
    return map;
  }, [documents]);

  const allRows = useMemo(
    () => documentTypes.map((typeDef) => ({ code: typeDef.code, doc: activeByType.get(typeDef.code) ?? null })),
    [documentTypes, activeByType]
  );

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const doc of documents) {
      if (doc.uploadedAt) years.add(String(new Date(doc.uploadedAt).getFullYear()));
    }
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [documents]);

  const availableUploaders = useMemo(() => {
    const names = new Set<string>();
    for (const doc of documents) {
      if (doc.uploadedBy) names.add(doc.uploadedBy);
    }
    return [...names].sort();
  }, [documents]);

  const filteredRows = useMemo(() => {
    const search = filterState.search.trim().toLowerCase();
    let rows = allRows.filter((row) => {
      if (filterState.status !== "ALL" && documentStatus(row.doc) !== filterState.status) return false;
      if (filterState.year !== "ALL") {
        const uploadedYear = row.doc?.uploadedAt ? String(new Date(row.doc.uploadedAt).getFullYear()) : null;
        if (uploadedYear !== filterState.year) return false;
      }
      if (filterState.uploadedBy !== "ALL" && row.doc?.uploadedBy !== filterState.uploadedBy) return false;
      if (search) {
        const def = documentTypes.find((d) => d.code === row.code);
        const haystack = [def?.labelEn, def?.labelTh, row.doc?.title, row.doc?.originalFilename]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    if (filterState.sort === "alphabetical") {
      rows = [...rows].sort((a, b) => {
        const la = documentTypes.find((d) => d.code === a.code)?.labelEn ?? a.code;
        const lb = documentTypes.find((d) => d.code === b.code)?.labelEn ?? b.code;
        return la.localeCompare(lb);
      });
    } else if (filterState.sort === "oldest" || filterState.sort === "newest") {
      rows = [...rows].sort((a, b) => {
        const ta = a.doc?.uploadedAt ? new Date(a.doc.uploadedAt).getTime() : 0;
        const tb = b.doc?.uploadedAt ? new Date(b.doc.uploadedAt).getTime() : 0;
        return filterState.sort === "newest" ? tb - ta : ta - tb;
      });
    }

    return rows;
  }, [allRows, documentTypes, filterState]);

  const rowsByCategory = useMemo(() => {
    const filteredCodes = new Set(filteredRows.map((r) => r.code));
    return categories
      .filter((cat) => filterState.category === "ALL" || filterState.category === cat.code)
      .map((cat) => ({
        category: cat,
        rows: filteredRows.filter((row) => cat.typeCodes.includes(row.code) && filteredCodes.has(row.code)),
      }));
  }, [categories, filteredRows, filterState.category]);

  const totalUploaded = activeByType.size;
  const totalTypes = documentTypes.length;
  const hasAnyDocument = totalUploaded > 0;
  const hasVisibleResults = rowsByCategory.some((g) => g.rows.length > 0);

  // ── Phase 46A intelligence (unchanged) ──────────────────────────────────────
  const dashboardStats = useMemo(() => computeDashboardStats(documents), [documents]);
  const hasOfficialPortrait = portrait ? portrait.source !== "PLACEHOLDER" : false;
  const completeness = useMemo(() => computeCompleteness(documents, hasOfficialPortrait), [documents, hasOfficialPortrait]);
  const missingItems = useMemo(() => missingChecklistItems(completeness), [completeness]);
  const recentActivity = useMemo(() => computeRecentActivity(documents), [documents]);
  const storageSummary = useMemo(() => computeStorageSummary(documents), [documents]);
  const categoryRollups = useMemo(() => computeCategoryRollups(documents), [documents]);
  const rollupByCategory = useMemo(() => new Map(categoryRollups.map((r) => [r.categoryCode, r])), [categoryRollups]);

  // ── Phase 46B executive layer — reads only the results above ───────────────
  const fileHealth = useMemo(() => computeFileHealth(completeness), [completeness]);
  const insights = useMemo(() => computeInsights(completeness, dashboardStats, documents), [completeness, dashboardStats, documents]);
  const nextActions = useMemo(
    () => computeRecommendedActions(completeness, documents, recentActivity),
    [completeness, documents, recentActivity]
  );
  const groupedActivity = useMemo(() => groupRecentActivity(recentActivity), [recentActivity]);

  const handleExpandAll = useCallback(() => {
    setExpandedCategories(new Set(categories.map((c) => c.code)));
  }, [categories]);
  const handleCollapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);
  const toggleCategory = useCallback((code: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  return (
    <EditableSectionCard title={`${t("epf.sectionTitle")} (${totalUploaded}/${totalTypes})`}>
      <p className="mb-5 text-xs text-muted">{t("epf.sectionSubtitle")}</p>

      {!hasAnyDocument ? (
        <EpfEmptyState onUpload={() => setDetailTypeCode(documentTypes[0]?.code ?? null)} />
      ) : (
        <div className="space-y-6">
          {/* 1. Hero — the ONE place completion %, health verdict, document
              count, storage, and last update are shown. */}
          <EpfHeroSummary stats={dashboardStats} completeness={completeness} health={fileHealth} />

          {/* 2. AI Insights immediately under the Hero (spec §4 — first thing
              read), Recommended Actions beside it on desktop / below on
              mobile (spec §5). */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EpfInsightsCard insights={insights} />
            {nextActions.length > 0 ? (
              <EpfNextActionsCard actions={nextActions} onUploadMissing={(code) => setDetailTypeCode(code)} />
            ) : null}
          </div>

          {/* 3. File Health — Complete/Missing/Unknown breakdown only;
              the headline percentage lives in the Hero, not repeated here. */}
          <EpfFileHealthCard completeness={completeness} />

          {/* 4. Secondary stats — information NOT shown anywhere else
              (categories used, largest file, image/PDF/other + distribution). */}
          <EpfSecondaryStats stats={dashboardStats} storage={storageSummary} />

          {/* 5. Missing Documents — grouped Required/Professional/Optional. */}
          <EpfMissingPanel missingItems={missingItems} onUpload={(code) => setDetailTypeCode(code)} />

          {/* 6. Recent Activity — compact timeline, no longer paired with a
              duplicate storage card (storage now lives in Secondary Stats). */}
          <EpfRecentActivity groups={groupedActivity} />

          <div className="border-t border-border pt-5">
            <EpfQuickActions
              onUpload={() => setDetailTypeCode(documentTypes[0]?.code ?? null)}
              onExpandAll={handleExpandAll}
              onCollapseAll={handleCollapseAll}
            />
          </div>

          <EpfSearchFilterBar
            state={filterState}
            onChange={setFilterState}
            availableYears={availableYears}
            availableUploaders={availableUploaders}
          />

          {!hasVisibleResults ? (
            <p className="py-6 text-center text-sm text-muted">{t("epf.searchNoResults")}</p>
          ) : (
            <div className="space-y-3">
              {rowsByCategory.map(({ category, rows }) => {
                const rollup = rollupByCategory.get(category.code);
                if (rows.length === 0 || !rollup) return null;
                return (
                  <EpfCategoryGroup
                    key={category.code}
                    category={category}
                    icon={CATEGORY_ICON[category.code] ?? FolderKanban}
                    officerId={officerId}
                    rows={rows}
                    rollup={rollup}
                    expanded={expandedCategories.has(category.code)}
                    onToggle={() => toggleCategory(category.code)}
                    onRefresh={onRefresh}
                    onOpenDetails={setDetailTypeCode}
                    onOpenHistory={setDetailTypeCode}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* The "History" button opens this same drawer — it already includes
          the Upload History section, so a separate history-only drawer would
          just duplicate the chrome for no UX benefit. */}
      <EpfDetailDrawer
        key={detailTypeCode ?? "closed"}
        open={detailTypeCode !== null}
        onClose={() => setDetailTypeCode(null)}
        officerId={officerId}
        typeCode={detailTypeCode ?? ""}
        doc={detailTypeCode ? activeByType.get(detailTypeCode) ?? null : null}
        onRefresh={onRefresh}
      />
    </EditableSectionCard>
  );
}
