/**
 * Enterprise workspace typography (Phase 48A.1 Part F).
 *
 * Centralizes the class strings the workspace layer's own components use for
 * each typographic role — title, section heading, sidebar group label, KPI
 * label/value/hint — so they're each defined ONCE and referenced by name,
 * instead of being retyped as literals in every file that needs "the KPI
 * value size" or "the section heading size". This directly addresses the
 * Phase 48A architecture audit finding: "every size is a repeated literal…
 * nothing enforces WorkspaceHeader's text-2xl and PageHeader's text-2xl stay
 * in sync." Changing a role's size/weight now means editing one line here.
 *
 * Deliberately class-string constants, not new CSS custom properties or a
 * Tailwind plugin — this codebase's precedent (cva-based Badge, plain
 * template-literal Card/Button variants) is Tailwind utility composition,
 * not a parallel token system, so this follows the same idiom rather than
 * introducing a second one.
 *
 * Scope: the WORKSPACE layer only (WorkspaceHeader, WorkspaceSection,
 * KpiCard, the new sidebar). Pre-Phase-48A components (PageHeader,
 * StatisticsCards, CommanderSummaryCards, ...) are untouched and keep their
 * own literals — migrating them to this module is Phase 48B work, same as
 * migrating their layout to WorkspaceHeader/KpiGrid.
 */

export const WORKSPACE_TYPOGRAPHY = {
  /** WorkspaceHeader's page title (h1). */
  pageTitle: "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl",
  /** WorkspaceHeader's subtitle line. */
  pageSubtitle: "text-sm text-muted",
  /** WorkspaceHeader's "last updated" line. */
  pageMeta: "text-xs text-muted/80",
  /** WorkspaceSection's sub-header title (h2). */
  sectionTitle: "text-sm font-semibold uppercase tracking-wide text-foreground",
  /** WorkspaceSection's sub-header description line. */
  sectionDescription: "text-xs text-muted",
  /** Sidebar group header label. */
  sidebarGroupLabel: "text-[11px] font-semibold uppercase tracking-widest text-muted/70",
  /** KpiCard's label (above the value). */
  kpiLabel: "text-xs font-medium uppercase tracking-wide text-muted",
  /** KpiCard's hero value. */
  kpiValue: "text-2xl font-semibold tabular-nums",
  /** KpiCard's hint line (below the value). */
  kpiHint: "text-xs text-muted",
} as const;
