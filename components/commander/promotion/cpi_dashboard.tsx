/**
 * Commander Promotion Intelligence client workspace (Phase 50 / 50A / 50B).
 * Presentation-only: filterPreparedRows + ViewModel. No domain recalculation.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  FileSpreadsheet,
  FilterX,
  Inbox,
  Printer,
  ShieldAlert,
  Users,
} from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace/workspace_header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { cn } from "@/lib/ui/cn";
import {
  EMPTY_PROMOTION_FILTER,
  EXECUTIVE_BUCKET_LABEL_TH,
  PRIORITY_LABEL_TH,
  type ActionUrgency,
  type CommanderPromotionFilterState,
  type CommanderPromotionViewModel,
  type ExecutiveBucket,
  type ExecutivePriorityBand,
  type PreparedPromotionRow,
} from "@/lib/commander_promotion/types";
import { filterPreparedRows, mergeFilter, countActiveFilters } from "@/lib/commander_promotion/filter_rows";
import { computeFilteredQuickStats } from "@/lib/commander_promotion/quick_stats";
import { buildCommanderPromotionCsv, promotionCsvFilename } from "@/lib/commander_promotion/export_csv";
import {
  parsePromotionFilterFromSearchParams,
  promotionFiltersEqual,
  promotionQueryNeedsNavigation,
  serializePromotionFilterToQuery,
} from "@/lib/commander_promotion/url_filter";

const PHOTO_COL = 56;
const QUEUE_PREVIEW = 8;
const SECTION_GAP = "space-y-8"; // 32px major rhythm
const GRID_GAP = "gap-3"; // 12px card grid

const ORG_LEVEL_LABEL_TH: Record<string, string> = {
  region: "ภาค",
  division: "กองกำกับการ",
  company: "กองร้อย",
};

const ORG_LEVEL_INDENT: Record<string, string> = {
  region: "pl-2",
  division: "pl-5",
  company: "pl-8",
};

const WATCHLIST_ORDER = ["ready", "collision", "nextYear", "incomplete", "training", "history"] as const;

const CPI_PRINT_STYLE = `
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body { background: white !important; }
  aside, nav, header.app-topbar, .print\\:hidden { display: none !important; }
  .cpi-print-root { color: #111; }
  .cpi-print-cover { display: block !important; break-after: avoid; }
  .cpi-screen-only { display: none !important; }
  .cpi-table-scroll { overflow: visible !important; border: 1px solid #ccc !important; }
  .cpi-table-scroll table { min-width: 0 !important; width: 100% !important; font-size: 10px; }
  .cpi-table-scroll thead { display: table-header-group; }
  .cpi-table-scroll tr { break-inside: avoid; }
  .cpi-table-scroll th,
  .cpi-table-scroll td { background: white !important; color: #111 !important; }
  .cpi-sticky-shadow { box-shadow: none !important; }
}
`;

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function priorityTone(band: ExecutivePriorityBand): "critical" | "serious" | "warning" | "neutral" {
  if (band === "Critical") return "critical";
  if (band === "High") return "serious";
  if (band === "Medium") return "warning";
  return "neutral";
}

function urgencyTone(urgency: ActionUrgency): "critical" | "serious" | "warning" | "neutral" {
  if (urgency === "Critical") return "critical";
  if (urgency === "High") return "serious";
  if (urgency === "Normal") return "warning";
  return "neutral";
}

function EmptyBlock({ title, detail, onReset }: { title: string; detail: string; onReset?: () => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-center">
      <Inbox className="h-7 w-7 text-muted" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-md text-xs text-muted">{detail}</p>
      {onReset ? (
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          {t("cpi.resetFilters")}
        </Button>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
  id,
  description,
  action,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3" aria-labelledby={id ? `${id}-heading` : undefined}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id={id ? `${id}-heading` : undefined} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function BarRows({
  rows,
  showPercent,
  total,
}: {
  rows: Array<{ label: string; count: number; tone?: "accent" | "warning" | "serious" }>;
  showPercent?: boolean;
  total?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const denom = total && total > 0 ? total : null;
  if (rows.every((r) => r.count === 0)) {
    return <EmptyBlock title="ไม่มีข้อมูลกราฟ" detail="ยังไม่มีรายการในชุดข้อมูลนี้" />;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const pct = denom != null ? Math.round((row.count / denom) * 100) : null;
        const fill =
          row.tone === "warning" ? "bg-warning" : row.tone === "serious" ? "bg-serious" : "bg-accent";
        return (
          <li key={row.label} className="grid grid-cols-[minmax(0,1.2fr)_2fr_auto] items-center gap-2 text-sm">
            <span className="truncate text-muted" title={row.label}>
              {row.label}
            </span>
            <span className="h-3 overflow-hidden rounded-full bg-neutral-bg ring-1 ring-border/70" aria-hidden="true">
              <span className={cn("block h-full rounded-full", fill)} style={{ width: `${(row.count / max) * 100}%` }} />
            </span>
            <span className="min-w-[4.5rem] text-right tabular-nums font-medium text-foreground">
              {row.count.toLocaleString("th-TH")}
              {showPercent && pct != null ? <span className="ml-1 text-xs font-normal text-muted">({pct}%)</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function kpiEmphasis(bucket: ExecutiveBucket): "hero" | "warn" | "neutral" {
  if (bucket === "alreadyEligible" || bucket === "eligibleThisYear") return "hero";
  if (bucket === "incomplete") return "warn";
  return "neutral";
}

export function CpiDashboard({ model }: { model: CommanderPromotionViewModel }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tableRef = useRef<HTMLDivElement>(null);
  /** Skip one URL→state pass after we write the URL from a user action (echo). */
  const skipUrlToStateRef = useRef(false);
  const filterRef = useRef<CommanderPromotionFilterState>(
    parsePromotionFilterFromSearchParams(new URLSearchParams(searchParams.toString()))
  );

  const [filter, setFilter] = useState<CommanderPromotionFilterState>(() => filterRef.current);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<keyof PreparedPromotionRow | "name">("priorityOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [printScope, setPrintScope] = useState<"filtered" | "selected">("filtered");
  const [secondaryActionsOpen, setSecondaryActionsOpen] = useState(false);

  useEffect(() => {
    const reset = () => setPrintScope("filtered");
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const replaceFilterUrl = useCallback(
    (next: CommanderPromotionFilterState) => {
      const desired = serializePromotionFilterToQuery(next);
      // Prefer the live location query — useSearchParams can lag a tick behind
      // history updates, which would incorrectly skip a clear/replace.
      const currentQuery =
        typeof window !== "undefined"
          ? window.location.search.replace(/^\?/, "")
          : searchParams.toString();
      if (!promotionQueryNeedsNavigation(currentQuery, desired)) return;
      skipUrlToStateRef.current = true;
      const href = desired ? `${pathname}?${desired}` : pathname;
      router.replace(href, { scroll: false });
      // Some App Router builds no-op replace(pathname) while a query is present;
      // keep the address bar aligned when clearing filters.
      if (!desired && typeof window !== "undefined" && window.location.search) {
        window.history.replaceState(window.history.state, "", pathname);
      }
    },
    [pathname, router, searchParams]
  );

  const clearFilters = useCallback(() => {
    const next: CommanderPromotionFilterState = { ...EMPTY_PROMOTION_FILTER, search: "" };
    filterRef.current = next;
    setFilter(next);
    setSelected(new Set());
    replaceFilterUrl(next);
  }, [replaceFilterUrl]);

  // URL → state for deep links / Back / Forward only. Never call the router here.
  useEffect(() => {
    if (skipUrlToStateRef.current) {
      skipUrlToStateRef.current = false;
      return;
    }
    const fromUrl = parsePromotionFilterFromSearchParams(new URLSearchParams(searchParams.toString()));
    if (promotionFiltersEqual(filterRef.current, fromUrl)) return;
    filterRef.current = fromUrl;
    setFilter(fromUrl);
  }, [searchParams]);

  const applyFilter = useCallback(
    (patch: Partial<CommanderPromotionFilterState>, scrollToTable = true) => {
      const next = mergeFilter(filterRef.current, patch);
      filterRef.current = next;
      setFilter(next);
      setSelected(new Set());
      replaceFilterUrl(next);
      if (scrollToTable) {
        requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    },
    [replaceFilterUrl]
  );

  const filtered = useMemo(() => filterPreparedRows(model.rows, filter), [model.rows, filter]);
  const quick = useMemo(() => computeFilteredQuickStats(filtered), [filtered]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.fullName.localeCompare(b.fullName, "th");
      else if (sortKey === "readinessPercent") cmp = (a.readinessPercent ?? -1) - (b.readinessPercent ?? -1);
      else if (sortKey === "firstEligibleYearBe") cmp = (a.firstEligibleYearBe ?? 9999) - (b.firstEligibleYearBe ?? 9999);
      else if (sortKey === "priorityOrder") cmp = a.priorityOrder - b.priorityOrder;
      else if (sortKey === "remainingTenureYears") cmp = (a.remainingTenureYears ?? 999) - (b.remainingTenureYears ?? 999);
      else cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "th");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const selectedRows = useMemo(() => sorted.filter((r) => selected.has(r.officerId)), [sorted, selected]);

  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(filtered.map((r) => r.officerId));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportRows(rows: PreparedPromotionRow[]) {
    const org =
      filter.companyKey != null
        ? model.filterOptions.companies.find((c) => c.key === filter.companyKey)?.label ?? "ทั้งหมด"
        : filter.divisionKey != null
          ? model.filterOptions.divisions.find((d) => d.key === filter.divisionKey)?.label ?? "ทั้งหมด"
          : filter.regionKey != null
            ? model.filterOptions.regions.find((r) => r.key === filter.regionKey)?.label ?? "ทั้งหมด"
            : "ทั้งหมด";
    const csv = buildCommanderPromotionCsv(rows, {
      organizationLabel: org,
      appointmentYearBe: model.appointmentYearBe,
      generatedDateTh: new Date(model.generatedAtIso).toLocaleDateString("th-TH"),
      filter,
      recordCount: rows.length,
    });
    downloadCsv(csv, promotionCsvFilename(model.appointmentYearBe));
  }

  async function copyText(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(ok);
      setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("คัดลอกไม่สำเร็จ");
      setTimeout(() => setCopyMsg(null), 2000);
    }
  }

  function runPrint(scope: "filtered" | "selected") {
    setPrintScope(scope);
    requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 40);
    });
  }

  const orgBreadcrumb = [
    filter.regionKey ? model.filterOptions.regions.find((r) => r.key === filter.regionKey)?.label : null,
    filter.divisionKey ? model.filterOptions.divisions.find((d) => d.key === filter.divisionKey)?.label : null,
    filter.companyKey ? model.filterOptions.companies.find((c) => c.key === filter.companyKey)?.label : null,
  ].filter(Boolean) as string[];

  const chips: Array<{ key: string; label: string; clear: Partial<CommanderPromotionFilterState> }> = [];
  if (filter.bucket) chips.push({ key: "bucket", label: EXECUTIVE_BUCKET_LABEL_TH[filter.bucket], clear: { bucket: null } });
  if (filter.priority) chips.push({ key: "priority", label: `ความสำคัญ: ${PRIORITY_LABEL_TH[filter.priority]}`, clear: { priority: null } });
  if (filter.promotionReadyOnly) chips.push({ key: "ready", label: "พร้อมเลื่อนระดับ", clear: { promotionReadyOnly: null } });
  if (filter.retirementWindow) chips.push({ key: "retire", label: `เกษียณ: ${filter.retirementWindow}`, clear: { retirementWindow: null } });
  if (filter.blocker) chips.push({ key: "blocker", label: `ข้อจำกัด: ${filter.blocker}`, clear: { blocker: null } });
  if (filter.dataQuality) chips.push({ key: "dq", label: `คุณภาพข้อมูล: ${filter.dataQuality}`, clear: { dataQuality: null } });
  if (filter.search.trim()) chips.push({ key: "search", label: `ค้นหา: ${filter.search}`, clear: { search: "" } });
  if (filter.eligibleYear != null) chips.push({ key: "year", label: `พ.ศ. ${filter.eligibleYear}`, clear: { eligibleYear: null } });
  if (filter.eligibleYearMin != null || filter.eligibleYearMax != null) {
    chips.push({
      key: "yearRange",
      label: `ปีที่มีสิทธิ์ ${filter.eligibleYearMin ?? "…"}–${filter.eligibleYearMax ?? "…"}`,
      clear: { eligibleYearMin: null, eligibleYearMax: null },
    });
  }

  const filteredQueue = useMemo(() => {
    const ids = new Set(filtered.map((r) => r.officerId));
    return model.promotionQueue.filter((q) => ids.has(q.officerId));
  }, [filtered, model.promotionQueue]);

  const printRecordCount = printScope === "selected" ? selectedRows.length : filtered.length;
  const generatedDateTh = new Date(model.generatedAtIso).toLocaleDateString("th-TH");
  const summary = model.executiveSummary;

  const kpiOrder: ExecutiveBucket[] = [
    "eligibleThisYear",
    "alreadyEligible",
    "nextYear",
    "notYetEligible",
    "incomplete",
    "noTarget",
  ];
  const kpisOrdered = kpiOrder
    .map((bucket) => model.kpis.find((k) => k.bucket === bucket))
    .filter((k): k is NonNullable<typeof k> => k != null);

  const primaryActions = model.actionCenter.filter((a) => a.urgency === "Critical" || a.urgency === "High");
  const secondaryActions = model.actionCenter.filter((a) => a.urgency === "Normal" || a.urgency === "Informational");

  const orgRows = useMemo(() => {
    const rows = [...model.organizationComparison];
    rows.sort((a, b) => {
      const score = (o: (typeof rows)[number]) =>
        o.alreadyEligible * 1000 + o.eligibleThisYear * 100 + o.promotionReady * 10 + (o.averageReadiness ?? 0);
      return score(b) - score(a);
    });
    return rows.slice(0, 24);
  }, [model.organizationComparison]);

  const pipelineRows = useMemo(() => {
    const byYear = new Map<number, number>();
    for (const f of model.workloadForecast) byYear.set(f.yearBe, f.count);
    for (const t of model.timelineByYear) {
      if (!byYear.has(t.yearBe)) byYear.set(t.yearBe, t.count);
    }
    return [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([yearBe, count]) => ({
        label: `พ.ศ. ${yearBe}`,
        count,
        yearBe,
        isCurrent: yearBe === model.appointmentYearBe,
      }));
  }, [model.workloadForecast, model.timelineByYear, model.appointmentYearBe]);

  const retirement = model.retirementCollisions;
  const retirementTotal = retirement.within1.count + retirement.within3.count + retirement.within5.count;

  const watchlistSorted = useMemo(() => {
    const map = new Map(model.executiveWatchlist.map((w) => [w.key, w]));
    const ordered = WATCHLIST_ORDER.map((k) => map.get(k)).filter((w): w is NonNullable<typeof w> => w != null);
    const rest = model.executiveWatchlist.filter((w) => !WATCHLIST_ORDER.includes(w.key as (typeof WATCHLIST_ORDER)[number]));
    return [...ordered, ...rest].sort((a, b) => {
      if (a.count === 0 && b.count > 0) return 1;
      if (b.count === 0 && a.count > 0) return -1;
      return 0;
    });
  }, [model.executiveWatchlist]);

  const meaningfulInsights = useMemo(() => {
    // Prefer insights that do not merely restate the four executive banner numbers.
    return model.commanderInsights.filter((insight) => {
      const text = `${insight.titleTh} ${insight.detailTh}`;
      const restatesBanner =
        text.includes(String(summary.alreadyEligibleCount)) &&
        text.includes("ครบคุณสมบัติมาแล้ว") &&
        !text.includes("หน่วยงาน") &&
        !text.includes("ภาระ") &&
        !text.includes("ข้อจำกัด");
      return !restatesBanner;
    }).slice(0, 4);
  }, [model.commanderInsights, summary.alreadyEligibleCount]);

  const dataQualitySorted = useMemo(() => {
    const severityRank = { serious: 0, warning: 1, neutral: 2 } as const;
    return [...model.dataQuality].sort((a, b) => {
      const s = severityRank[a.severity] - severityRank[b.severity];
      if (s !== 0) return s;
      return b.count - a.count;
    });
  }, [model.dataQuality]);

  return (
    <div className={cn("cpi-print-root", SECTION_GAP)}>
      <style>{CPI_PRINT_STYLE}</style>

      <header className="cpi-print-cover mb-4 hidden rounded-none border-2 border-neutral-400 bg-white px-8 py-6 text-black print:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
          กองบัญชาการตำรวจตระเวนชายแดน
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t("cpi.title")}</h1>
        <p className="mt-1 text-sm text-neutral-700">{t("cpi.subtitle")}</p>
        <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-600">ปีพิจารณา (พ.ศ.)</dt>
            <dd className="font-medium">{model.appointmentYearBe}</dd>
          </div>
          <div>
            <dt className="text-neutral-600">วันที่จัดทำ</dt>
            <dd className="font-medium">{generatedDateTh}</dd>
          </div>
          <div>
            <dt className="text-neutral-600">ขอบเขตการพิมพ์</dt>
            <dd className="font-medium">
              {printScope === "selected" ? `รายการที่เลือก (${printRecordCount})` : `รายการตามตัวกรอง (${printRecordCount})`}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-600">หน่วยงาน</dt>
            <dd className="font-medium">{orgBreadcrumb.length > 0 ? orgBreadcrumb.join(" › ") : "ทั้งหมด"}</dd>
          </div>
        </dl>
      </header>

      <div className="cpi-screen-only print:hidden">
        <WorkspaceHeader
          title={t("cpi.title")}
          subtitle={t("cpi.subtitle")}
          breadcrumb={[
            { label: t("dashboard.breadcrumbHome"), href: "/dashboard" },
            { label: t("cpi.title") },
          ]}
        />
      </div>

      {/* 2–3. Executive Command Summary */}
      <section
        aria-labelledby="cpi-banner"
        className={cn(
          "rounded-2xl border border-border bg-surface px-4 py-4 shadow-sm sm:px-6 sm:py-5",
          printScope === "selected" && "print:hidden"
        )}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end">
          <div className="min-w-0">
            <h2 id="cpi-banner" className="text-base font-semibold text-foreground sm:text-lg">
              สรุปสถานการณ์การเลื่อนระดับ
            </h2>
            <p className="mt-0.5 text-sm text-muted">ปีพิจารณา พ.ศ. {model.appointmentYearBe}</p>
            <p className="mt-3 flex items-start gap-2 text-sm font-medium leading-snug text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                <span className="text-muted">ประเด็นเร่งด่วน: </span>
                {summary.urgentSummaryTh}
              </span>
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">ครบคุณสมบัติมาแล้ว</p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground sm:text-5xl">
                {summary.alreadyEligibleCount.toLocaleString("th-TH")}
              </span>
              <span className="text-sm text-muted">นาย</span>
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
              <div>
                <dt className="text-[11px] leading-snug text-muted">ครบในปีนี้</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {summary.eligibleThisYearCount.toLocaleString("th-TH")}
                  <span className="ml-1 text-xs font-normal text-muted">นาย</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] leading-snug text-muted">จะครบปีหน้า</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {summary.nextYearCount.toLocaleString("th-TH")}
                  <span className="ml-1 text-xs font-normal text-muted">นาย</span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] leading-snug text-muted">ข้อมูลไม่สมบูรณ์</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-warning">
                  {summary.incompleteCount.toLocaleString("th-TH")}
                  <span className="ml-1 text-xs font-normal text-muted">นาย</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* 4. Executive KPI Strip */}
      <div className="cpi-screen-only print:hidden">
        <Section title="ตัวชี้วัดผู้บริหาร" description="หกกลุ่มสถานะแบบแยกกัน — คลิกเพื่อกรองตาราง">
          <div className={cn("grid grid-cols-2 items-stretch sm:grid-cols-3 xl:grid-cols-6", GRID_GAP)}>
            {kpisOrdered.map((kpi) => {
              const emphasis = kpiEmphasis(kpi.bucket);
              const active = filter.bucket === kpi.bucket;
              return (
                <button
                  key={kpi.bucket}
                  type="button"
                  onClick={() => applyFilter({ ...EMPTY_PROMOTION_FILTER, bucket: kpi.bucket })}
                  className={cn(
                    "flex h-full flex-col rounded-xl border px-3 py-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    active ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/40",
                    emphasis === "hero" && !active && "border-accent/30",
                    emphasis === "warn" && !active && "border-warning/40"
                  )}
                >
                  <span
                    className={cn(
                      "text-2xl font-semibold tabular-nums sm:text-3xl",
                      emphasis === "warn" ? "text-warning" : "text-foreground"
                    )}
                  >
                    {kpi.count.toLocaleString("th-TH")}
                  </span>
                  <span className="mt-1 text-xs font-medium leading-snug text-muted">{kpi.labelTh}</span>
                </button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* 5. Priority Queue */}
      <div className="cpi-screen-only print:hidden">
        <Section
          id="cpi-queue"
          title="คิวลำดับความสำคัญ"
          description={`แสดง ${Math.min(QUEUE_PREVIEW, filteredQueue.length).toLocaleString("th-TH")} จาก ${filteredQueue.length.toLocaleString("th-TH")} รายการที่ตรงตัวกรอง · ลำดับเป็นการจัดเพื่อช่วยตรวจสอบ ไม่ใช่ผลการพิจารณาแต่งตั้ง`}
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              ดูทั้งหมดในตาราง
            </Button>
          }
        >
          {filteredQueue.length === 0 ? (
            <EmptyBlock title="ไม่มีรายการในคิว" detail={t("cpi.noMatch")} onReset={clearFilters} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-bg text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2.5">ความสำคัญ</th>
                    <th className="px-3 py-2.5">รูป</th>
                    <th className="px-3 py-2.5">ยศ / ชื่อ</th>
                    <th className="px-3 py-2.5">ตำแหน่งปัจจุบัน</th>
                    <th className="px-3 py-2.5">เป้าหมาย</th>
                    <th className="px-3 py-2.5">สถานะ</th>
                    <th className="px-3 py-2.5">ดำเนินการ</th>
                    <th className="px-3 py-2.5">โปรไฟล์</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.slice(0, QUEUE_PREVIEW).map((q) => (
                    <tr key={q.officerId} className="border-t border-border hover:bg-neutral-bg/40">
                      <td className="px-3 py-2.5">
                        <Badge tone={priorityTone(q.priorityBand)}>{PRIORITY_LABEL_TH[q.priorityBand]}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <OfficerPhoto thumbnailUrl={q.portraitUrl} name={q.fullName} size={40} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={q.profileHref} className="block hover:underline">
                          <span className="text-xs text-muted">{q.rankLabel}</span>
                          <span className="block text-[15px] font-semibold leading-snug text-foreground">{q.fullName}</span>
                        </Link>
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5 leading-snug">{q.currentPositionLabel}</td>
                      <td className="max-w-[12rem] px-3 py-2.5 leading-snug">{q.targetPositionLabel ?? "—"}</td>
                      <td className="px-3 py-2.5">{q.statusLabelTh}</td>
                      <td className="max-w-[14rem] px-3 py-2.5 text-muted leading-snug">{q.recommendedActionTh}</td>
                      <td className="px-3 py-2.5">
                        <Link href={q.profileHref} className="text-accent hover:underline">
                          เปิด
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted">
            ลำดับนี้เป็นการจัดลำดับเพื่อช่วยตรวจสอบข้อมูล ไม่ใช่ผลการพิจารณาแต่งตั้ง
          </p>
        </Section>
      </div>

      {/* 6. Action Center */}
      <div className="cpi-screen-only print:hidden">
        <Section title="ศูนย์ปฏิบัติการผู้บังคับบัญชา" description="รายการดำเนินการเชิงเร่งด่วนจากชุดข้อมูลเดียวกัน">
          {primaryActions.length === 0 && secondaryActions.length === 0 ? (
            <EmptyBlock title="ยังไม่มีรายการดำเนินการ" detail="ไม่พบการดำเนินการที่ระบบจัดลำดับจากข้อมูลปัจจุบัน" />
          ) : (
            <div className="space-y-2">
              {primaryActions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left hover:bg-neutral-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={() => applyFilter({ ...EMPTY_PROMOTION_FILTER, ...a.filter })}
                >
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={urgencyTone(a.urgency)}>{a.urgency === "Critical" ? "วิกฤต" : "สูง"}</Badge>
                      <span className="text-sm font-semibold">{a.labelTh}</span>
                      <span className="tabular-nums text-sm text-muted">({a.count.toLocaleString("th-TH")})</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{a.descriptionTh}</span>
                  </span>
                  <span className="shrink-0 self-center text-xs font-medium text-accent">ดูรายการ</span>
                </button>
              ))}
              {secondaryActions.length > 0 ? (
                <div className="rounded-xl border border-border/80">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-muted hover:bg-neutral-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    onClick={() => setSecondaryActionsOpen((v) => !v)}
                    aria-expanded={secondaryActionsOpen}
                  >
                    <span>รายการรอง ({secondaryActions.length})</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", secondaryActionsOpen && "rotate-180")} aria-hidden="true" />
                  </button>
                  {secondaryActionsOpen ? (
                    <ul className="space-y-1 border-t border-border px-2 py-2">
                      {secondaryActions.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-neutral-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            onClick={() => applyFilter({ ...EMPTY_PROMOTION_FILTER, ...a.filter })}
                          >
                            <span className="min-w-0">
                              <Badge tone={urgencyTone(a.urgency)} className="mr-2">
                                {a.urgency === "Normal" ? "ปกติ" : "เพื่อทราบ"}
                              </Badge>
                              {a.labelTh}
                            </span>
                            <span className="tabular-nums text-muted">{a.count}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </Section>
      </div>

      {/* 7. Organization Comparison */}
      <div className="cpi-screen-only print:hidden">
        <Section title="เปรียบเทียบหน่วยงาน" description="จัดเรียงตามความสำคัญเชิงบริหารจากยอดครบคุณสมบัติ / พร้อมเลื่อน">
          {orgRows.length === 0 ? (
            <EmptyBlock title="ยังไม่มีข้อมูลหน่วยงาน" detail="ไม่พบการจัดกลุ่มหน่วยงานจากชุดข้อมูลปัจจุบัน" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-bg text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2">หน่วยงาน</th>
                    <th className="px-3 py-2">ระดับ</th>
                    <th className="px-3 py-2">พร้อม</th>
                    <th className="px-3 py-2">ปีนี้</th>
                    <th className="px-3 py-2">มาแล้ว</th>
                    <th className="px-3 py-2">ไม่สมบูรณ์</th>
                    <th className="min-w-[10rem] px-3 py-2">พร้อมเฉลี่ย</th>
                  </tr>
                </thead>
                <tbody>
                  {orgRows.map((org) => (
                    <tr key={`${org.level}-${org.key}`} className="border-t border-border hover:bg-neutral-bg/50">
                      <td className={cn("px-3 py-2", ORG_LEVEL_INDENT[org.level])}>
                        <button
                          type="button"
                          className={cn(
                            "rounded-sm text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                            org.level === "region" ? "font-semibold text-foreground" : "font-medium text-accent"
                          )}
                          onClick={() => applyFilter(org.filter)}
                        >
                          {org.labelTh}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">
                          {ORG_LEVEL_LABEL_TH[org.level] ?? org.level}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden="true" />
                          {org.promotionReady}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{org.eligibleThisYear}</td>
                      <td className="px-3 py-2 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                          {org.alreadyEligible}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-serious" aria-hidden="true" />
                          {org.incomplete}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {org.averageReadiness != null ? (
                          <div className="flex items-center gap-2">
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-bg ring-1 ring-border/60" aria-hidden="true">
                              <span
                                className="block h-full rounded-full bg-accent"
                                style={{ width: `${Math.min(100, org.averageReadiness)}%` }}
                              />
                            </span>
                            <span className="w-10 text-right tabular-nums text-xs">{org.averageReadiness}%</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {/* 8. Promotion Pipeline (merged forecast + timeline) */}
      <div className="cpi-screen-only print:hidden">
        <Section
          title="เส้นทางกำลังพลที่จะเข้าสู่เกณฑ์พิจารณา"
          description="ค่าจาก firstEligibleYearBe เท่านั้น — ไม่ใช่ประมาณการแต่งตั้ง"
        >
          {pipelineRows.length === 0 ? (
            <EmptyBlock title="ยังไม่มีปีที่มีสิทธิ์" detail="ไม่มี firstEligibleYearBe ในชุดข้อมูล" />
          ) : (
            <ul className="space-y-2.5 rounded-xl border border-border px-3 py-3">
              {pipelineRows.map((row) => {
                const max = Math.max(1, ...pipelineRows.map((r) => r.count));
                return (
                  <li key={row.yearBe}>
                    <button
                      type="button"
                      className={cn(
                        "grid w-full grid-cols-[6.5rem_1fr_4rem] items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-neutral-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        row.isCurrent && "bg-accent/5"
                      )}
                      onClick={() => applyFilter({ ...EMPTY_PROMOTION_FILTER, eligibleYear: row.yearBe })}
                    >
                      <span className={cn("tabular-nums", row.isCurrent && "font-semibold text-accent")}>
                        {row.label}
                        {row.isCurrent ? <span className="ml-1 text-[10px] font-medium">ปีนี้</span> : null}
                      </span>
                      <span className="h-3 overflow-hidden rounded-full bg-neutral-bg ring-1 ring-border/60" aria-hidden="true">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums font-medium">{row.count.toLocaleString("th-TH")} นาย</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* 9. Promotion vs Retirement */}
      <div className="cpi-screen-only print:hidden">
        <Section title="เลื่อนระดับ × เกษียณ" description="หน้าต่าง 3 ปี และ 5 ปีเป็นแบบสะสม">
          {retirementTotal === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-good" aria-hidden="true" />
                ไม่พบผู้พร้อมเลื่อนระดับที่เข้าใกล้เกษียณภายใน 5 ปี
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[retirement.within1, retirement.within3, retirement.within5].map((card) => (
                  <span key={card.key} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
                    {card.labelTh}: 0
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-border px-3 py-3">
              {[retirement.within1, retirement.within3, retirement.within5].map((card, index) => (
                <button
                  key={card.key}
                  type="button"
                  className={cn(
                    "flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-neutral-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    index === 0 && card.count > 0 && "bg-warning/5"
                  )}
                  onClick={() => applyFilter({ ...EMPTY_PROMOTION_FILTER, ...card.filter })}
                >
                  <span>
                    <span className={cn("text-sm font-semibold", index === 0 ? "text-foreground" : "text-muted")}>
                      {card.labelTh}
                    </span>
                    {card.count > 0 && card.topNames.length > 0 ? (
                      <span className="mt-0.5 block text-xs text-muted">{card.topNames.slice(0, 2).join(" · ")}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-lg font-semibold">{card.count.toLocaleString("th-TH")} นาย</span>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* 10. Readiness + Blocking */}
      <div className="cpi-screen-only grid gap-6 print:hidden xl:grid-cols-2">
        <Section title="การกระจายความพร้อมด้านระยะเวลา">
          <BarRows
            rows={model.readinessDistribution.map((d) => ({
              label: d.labelTh,
              count: d.count,
              tone: d.key === "unknown" ? "warning" : "accent",
            }))}
            showPercent
            total={model.totalOfficers}
          />
          <p className="text-xs text-muted">
            เปอร์เซ็นต์คือความคืบหน้าด้านระยะเวลาเท่านั้น ไม่ใช่โอกาสได้รับการแต่งตั้ง
          </p>
        </Section>
        <Section title="ปัจจัยที่ขัดขวาง">
          {model.blockingFactors.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-good" aria-hidden="true" />
              ไม่มีข้อจำกัดที่ระบบตรวจพบ
            </p>
          ) : (
            <ul className="space-y-1.5">
              {model.blockingFactors.map((b) => {
                const serious = b.key === "missingLevelStart" || b.key === "Unknown" || b.key === "noTarget";
                return (
                  <li key={b.key}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        serious ? "border-warning/40 hover:bg-warning/5" : "border-border hover:bg-neutral-bg/60"
                      )}
                      onClick={() => applyFilter({ ...EMPTY_PROMOTION_FILTER, ...b.filter })}
                    >
                      <span>{b.labelTh}</span>
                      <span className="tabular-nums font-semibold">{b.count.toLocaleString("th-TH")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* 11. Watchlist */}
      <div className="cpi-screen-only print:hidden">
        <Section title="รายการเฝ้าระวังผู้บริหาร" description="หมวดหมู่เชิงนำเสนอ — ไม่ใช่รายการติดตามที่บันทึกถาวร">
          <ul className={cn("grid sm:grid-cols-2", GRID_GAP)}>
            {watchlistSorted.map((w) => (
              <li key={w.key}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    w.count === 0
                      ? "border-border/60 bg-transparent text-muted hover:bg-neutral-bg/30"
                      : "border-border bg-surface hover:bg-neutral-bg/50"
                  )}
                  onClick={() => applyFilter({ ...EMPTY_PROMOTION_FILTER, ...w.filter })}
                >
                  <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{w.labelTh}</span>
                      <span className="tabular-nums text-base font-semibold">{w.count.toLocaleString("th-TH")}</span>
                    </span>
                    {w.count > 0 ? (
                      <span className="mt-0.5 block text-xs text-muted">{w.topNames.slice(0, 3).join(" · ") || "—"}</span>
                    ) : (
                      <span className="mt-0.5 block text-xs">ไม่มีรายการ</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* 12. Insights */}
      {meaningfulInsights.length > 0 ? (
        <div className="cpi-screen-only print:hidden">
          <Section title="ข้อสังเกตผู้บริหาร">
            <ul className={cn("grid sm:grid-cols-2 xl:grid-cols-4", GRID_GAP)}>
              {meaningfulInsights.map((insight) => (
                <li key={insight.id}>
                  <button
                    type="button"
                    disabled={!insight.filter}
                    className="h-full w-full rounded-xl border border-border px-3 py-2.5 text-left hover:bg-neutral-bg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:hover:bg-transparent"
                    onClick={() => {
                      if (insight.filter) applyFilter({ ...EMPTY_PROMOTION_FILTER, ...insight.filter });
                    }}
                  >
                    <p className="text-sm font-semibold leading-snug">{insight.titleTh}</p>
                    <p className="mt-1 text-xs text-muted leading-snug">{insight.detailTh}</p>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      ) : null}

      {/* 13. Data Quality */}
      <div className="cpi-screen-only print:hidden">
        <Section title="คุณภาพข้อมูลหลัก" description="จัดลำดับตามผลกระทบต่อการประเมินก่อน แล้วจึงหลักฐานที่ขาด">
          <ul className="space-y-1.5">
            {dataQualitySorted.map((dq) => {
              const pct =
                model.totalOfficers > 0 ? Math.round((dq.count / model.totalOfficers) * 100) : null;
              return (
                <li key={dq.key}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      dq.severity === "serious"
                        ? "border-serious/40 hover:bg-serious/5"
                        : dq.severity === "warning"
                          ? "border-warning/30 hover:bg-warning/5"
                          : "border-border hover:bg-neutral-bg/50"
                    )}
                    onClick={() => applyFilter({ ...EMPTY_PROMOTION_FILTER, ...dq.filter })}
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">{dq.labelTh}</span>
                      <span className="mt-0.5 block text-xs text-muted">{dq.explanationTh}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block tabular-nums text-base font-semibold">{dq.count.toLocaleString("th-TH")}</span>
                      {pct != null ? <span className="text-[11px] text-muted">{pct}% ของทั้งหมด</span> : null}
                      <span className="block text-[11px] font-medium text-accent">ดูรายการ</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      {/* 14. Detail workspace */}
      <section ref={tableRef} id="cpi-table" className="space-y-4 border-t border-border pt-6" aria-labelledby="cpi-table-heading">
        <div>
          <h2 id="cpi-table-heading" className="text-lg font-semibold text-foreground">
            รายละเอียดกำลังพล
          </h2>
          <p className="mt-0.5 text-xs text-muted">{t("cpi.tableTitle")} — ตัวกรอง การส่งออก และการพิมพ์</p>
        </div>

        <div className="cpi-screen-only flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3 print:hidden">
          <label className="text-xs text-muted">
            ค้นหา
            <input
              className="mt-1 block min-w-[12rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={filter.search}
              onChange={(e) => applyFilter({ search: e.target.value }, false)}
            />
          </label>
          <label className="text-xs text-muted">
            ความสำคัญ
            <select
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={filter.priority ?? ""}
              onChange={(e) => applyFilter({ priority: (e.target.value || null) as ExecutivePriorityBand | null }, false)}
            >
              <option value="">ทั้งหมด</option>
              {(["Critical", "High", "Medium", "Low"] as const).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL_TH[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            ภาค
            <select
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={filter.regionKey ?? ""}
              onChange={(e) => applyFilter({ regionKey: e.target.value || null, divisionKey: null, companyKey: null }, false)}
            >
              <option value="">ทั้งหมด</option>
              {model.filterOptions.regions.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" size="sm" data-cpi-clear-filters onClick={clearFilters}>
            <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
            {t("cpi.clearFilters")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm print:border-neutral-300">
          {orgBreadcrumb.length > 0 ? (
            <span className="text-muted">
              {orgBreadcrumb.map((part, i) => (
                <span key={part}>
                  {i > 0 ? <span className="mx-1 text-muted">›</span> : null}
                  <span className="font-medium text-foreground">{part}</span>
                </span>
              ))}
            </span>
          ) : null}
          <div className="cpi-screen-only flex flex-wrap items-center gap-2 print:hidden">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="rounded-full border border-border bg-neutral-bg px-2.5 py-0.5 text-xs hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => applyFilter(chip.clear, false)}
              >
                {chip.label} ×
              </button>
            ))}
          </div>
          <span className="ml-auto tabular-nums text-muted">
            {filtered.length.toLocaleString("th-TH")} {t("cpi.records")}
            {countActiveFilters(filter) > 0 ? ` · ตัวกรอง ${countActiveFilters(filter)}` : ""}
          </span>
        </div>

        <dl className="cpi-screen-only grid grid-cols-2 gap-3 print:hidden sm:grid-cols-5">
          {[
            ["ความพร้อมเฉลี่ย", quick.averageReadiness != null ? `${Math.round(quick.averageReadiness)}%` : "—"],
            ["มัธยฐานปีที่เหลือ", quick.medianRemainingYears != null ? String(quick.medianRemainingYears) : "—"],
            ["หน่วยงานพร้อมสูงสุด", quick.highestReadyOrgLabel ?? "—"],
            ["ข้อจำกัดหลัก", quick.largestBlockerLabel ?? "—"],
            ["สัดส่วนพร้อมเลื่อน", quick.promotionReadyPercent != null ? `${Math.round(quick.promotionReadyPercent)}%` : "—"],
          ].map(([label, value]) => (
            <div key={label as string} className="min-h-[3.25rem] rounded-lg border border-border px-3 py-2">
              <dt className="text-[11px] leading-snug text-muted">{label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold" title={value as string}>
                {value as string}
              </dd>
            </div>
          ))}
        </dl>

        <div className="cpi-screen-only flex flex-wrap items-center gap-2 print:hidden">
          <Button type="button" size="sm" variant="outline" onClick={() => exportRows(filtered)}>
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            {t("cpi.exportExcel")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => runPrint("filtered")}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            {t("cpi.print")}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selectedRows.length === 0} onClick={() => exportRows(selectedRows)}>
            {t("cpi.exportSelected")}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={selectedRows.length === 0} onClick={() => runPrint("selected")}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            {t("cpi.printSelected")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedRows.length === 0}
            onClick={() => copyText(selectedRows.map((r) => `${r.rankLabel} ${r.fullName}`).join("\n"), "คัดลอกชื่อแล้ว")}
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
            {t("cpi.copyNames")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedRows.length === 0}
            onClick={() => copyText(selectedRows.map((r) => r.officerId).join("\n"), "คัดลอกรหัสแล้ว")}
          >
            {t("cpi.copyIds")}
          </Button>
          {selected.size > 0 ? (
            <span className="text-xs text-muted">
              {t("cpi.selected")}: {selected.size}
            </span>
          ) : null}
          {copyMsg ? (
            <span className="text-xs text-good" role="status">
              {copyMsg}
            </span>
          ) : null}
        </div>

        {sorted.length === 0 ? (
          <EmptyBlock title={t("cpi.noMatch")} detail="ลองล้างตัวกรองหรือเลือกตัวชี้วัดอื่น" onReset={clearFilters} />
        ) : (
          <div className="cpi-table-scroll overflow-x-auto rounded-xl border border-border">
            <table className="min-w-[1400px] text-left text-sm">
              <thead className="sticky top-0 z-30 bg-surface text-xs text-muted shadow-sm">
                <tr>
                  <th className="cpi-screen-only bg-surface px-2 py-3 print:hidden">
                    <input
                      type="checkbox"
                      aria-label="เลือกทั้งหมดที่แสดง"
                      checked={sorted.length > 0 && sorted.every((r) => selected.has(r.officerId))}
                      onChange={(e) => {
                        if (e.target.checked) setSelected(new Set(sorted.map((r) => r.officerId)));
                        else setSelected(new Set());
                      }}
                    />
                  </th>
                  <th
                    className="cpi-sticky-shadow sticky left-0 z-40 bg-surface px-2 py-3 shadow-[2px_0_0_0_var(--border)]"
                    style={{ minWidth: PHOTO_COL }}
                  >
                    รูป
                  </th>
                  <th
                    className="cpi-sticky-shadow sticky z-40 bg-surface px-2 py-3 shadow-[2px_0_0_0_var(--border)]"
                    style={{ left: PHOTO_COL }}
                  >
                    <button
                      type="button"
                      className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => toggleSort("name")}
                    >
                      ยศ / ชื่อ
                    </button>
                  </th>
                  <th className="bg-surface px-2 py-3">ตำแหน่ง</th>
                  <th className="bg-surface px-2 py-3">เป้าหมาย</th>
                  <th className="bg-surface px-2 py-3">หน่วยงาน</th>
                  <th className="bg-surface px-2 py-3">เริ่ม</th>
                  <th className="bg-surface px-2 py-3">
                    <button
                      type="button"
                      className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => toggleSort("readinessPercent")}
                    >
                      ความพร้อม
                    </button>
                  </th>
                  <th className="bg-surface px-2 py-3">เหลือ</th>
                  <th className="bg-surface px-2 py-3">
                    <button
                      type="button"
                      className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => toggleSort("firstEligibleYearBe")}
                    >
                      ครบครั้งแรก
                    </button>
                  </th>
                  <th className="bg-surface px-2 py-3">รอบ</th>
                  <th className="bg-surface px-2 py-3">สถานะ</th>
                  <th className="bg-surface px-2 py-3">
                    <button
                      type="button"
                      className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => toggleSort("priorityOrder")}
                    >
                      ความสำคัญ
                    </button>
                  </th>
                  <th className="bg-surface px-2 py-3">เกษียณ</th>
                  <th className="min-w-[10rem] bg-surface px-2 py-3">ดำเนินการ</th>
                  <th className="cpi-screen-only bg-surface px-2 py-3 print:hidden">โปรไฟล์</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const hideInPrint = printScope === "selected" && !selected.has(row.officerId);
                  return (
                    <tr
                      key={row.officerId}
                      className={cn("group border-t border-border hover:bg-neutral-bg/40", hideInPrint && "print:hidden")}
                    >
                      <td className="cpi-screen-only px-2 py-2.5 print:hidden">
                        <input
                          type="checkbox"
                          aria-label={`เลือก ${row.fullName}`}
                          checked={selected.has(row.officerId)}
                          onChange={(e) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(row.officerId);
                              else next.delete(row.officerId);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td
                        className="cpi-sticky-shadow sticky left-0 z-10 bg-surface px-2 py-2.5 shadow-[2px_0_0_0_var(--border)] group-hover:bg-neutral-bg/40"
                        style={{ minWidth: PHOTO_COL }}
                      >
                        <OfficerPhoto thumbnailUrl={row.portraitUrl} name={row.fullName} size={40} />
                      </td>
                      <td
                        className="cpi-sticky-shadow sticky z-10 bg-surface px-2 py-2.5 shadow-[2px_0_0_0_var(--border)] group-hover:bg-neutral-bg/40"
                        style={{ left: PHOTO_COL }}
                      >
                        <span className="block text-xs text-muted">{row.rankLabel}</span>
                        <span className="block font-semibold leading-snug">{row.fullName}</span>
                      </td>
                      <td className="max-w-[12rem] px-2 py-2.5 leading-snug">{row.currentPositionLabel}</td>
                      <td className="max-w-[10rem] px-2 py-2.5 leading-snug">{row.targetPositionLabel ?? "—"}</td>
                      <td className="px-2 py-2.5 text-muted">{row.companyLabel}</td>
                      <td className="px-2 py-2.5 tabular-nums">{row.positionLevelStartYearBe ?? "—"}</td>
                      <td className="px-2 py-2.5 tabular-nums">{row.readinessPercent != null ? `${row.readinessPercent}%` : "—"}</td>
                      <td className="px-2 py-2.5">{row.remainingTenureLabel}</td>
                      <td className="px-2 py-2.5 tabular-nums">{row.firstEligibleYearBe ?? "—"}</td>
                      <td className="px-2 py-2.5">{row.cycleLabel ?? "—"}</td>
                      <td className="px-2 py-2.5">{row.statusLabelTh}</td>
                      <td className="px-2 py-2.5">
                        <Badge tone={priorityTone(row.priorityBand)}>{PRIORITY_LABEL_TH[row.priorityBand]}</Badge>
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">{row.retirementYearBe ?? "—"}</td>
                      <td className="max-w-[12rem] px-2 py-2.5 text-muted leading-snug">{row.recommendedActionTh}</td>
                      <td className="cpi-screen-only px-2 py-2.5 print:hidden">
                        <Link
                          href={row.profileHref}
                          className="rounded-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          เปิด
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
