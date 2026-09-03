/**
 * Commander Dashboard scope presentation (Phase 2C).
 *
 * URL/API dates stay Gregorian ISO (YYYY-MM-DD). Thai/Buddhist strings are
 * display-only. Custom period is authoritative only when BOTH from and to
 * are valid ISO dates and from <= to.
 *
 * Partial (from XOR to): incomplete — do not treat the dashboard as
 * custom-filtered. Invalid (from > to): blocked — do not request analytics.
 * Pure — no I/O, no React.
 */

import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import { parseCommanderIsoDate } from "@/lib/drug_intelligence/drug_commander_filter";
import type { OrgTree } from "@/lib/organization/org_tree";

export const COMMANDER_INVALID_RANGE_MESSAGE_TH = "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด";
export const COMMANDER_INCOMPLETE_RANGE_MESSAGE_TH = "กรุณาเลือกทั้งวันที่เริ่มต้นและวันที่สิ้นสุด";

export type CommanderPeriodKind = "fy" | "custom" | "incomplete" | "invalid";

export interface CommanderUrlState {
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

export function commanderPeriodKind(state: Pick<CommanderUrlState, "from" | "to">): CommanderPeriodKind {
  const from = state.from?.trim() || "";
  const to = state.to?.trim() || "";
  if (!from && !to) return "fy";
  if (!from || !to) return "incomplete";
  const fromDate = parseCommanderIsoDate(from, false);
  const toDate = parseCommanderIsoDate(to, false);
  if (!fromDate || !toDate) return "incomplete";
  if (from > to) return "invalid";
  return "custom";
}

export function commanderPeriodQueryEnabled(state: Pick<CommanderUrlState, "from" | "to">): boolean {
  const kind = commanderPeriodKind(state);
  return kind === "fy" || kind === "custom";
}

/** ISO dates the Commander APIs should receive. Incomplete/invalid custom dates are omitted. */
export function commanderPeriodApiDates(state: Pick<CommanderUrlState, "fy" | "from" | "to">): {
  fy?: number;
  from?: string;
  to?: string;
} {
  const kind = commanderPeriodKind(state);
  if (kind === "custom") {
    return { from: state.from, to: state.to };
  }
  if (state.fy) {
    const n = Number(state.fy);
    if (Number.isFinite(n)) return { fy: n };
  }
  return {};
}

export function formatCommanderIsoThai(iso: string | undefined): string {
  if (!iso) return "";
  const date = parseCommanderIsoDate(iso, false);
  if (!date) return "";
  return formatShortThaiDateTh(date);
}

export function formatCommanderPeriodLabel(state: Pick<CommanderUrlState, "fy" | "from" | "to">, fyFallbackLabel: string): string {
  const kind = commanderPeriodKind(state);
  if (kind === "invalid") return COMMANDER_INVALID_RANGE_MESSAGE_TH;
  if (kind === "incomplete") return COMMANDER_INCOMPLETE_RANGE_MESSAGE_TH;
  if (kind === "custom" && state.from && state.to) {
    const fromLabel = formatCommanderIsoThai(state.from);
    const toLabel = formatCommanderIsoThai(state.to);
    if (state.from.slice(0, 7) === state.to.slice(0, 7)) {
      const fromDay = Number(state.from.slice(8, 10));
      const toDay = Number(state.to.slice(8, 10));
      const monthYear = toLabel.replace(/^\d+\s/, "");
      if (fromDay && toDay && monthYear) return `${fromDay}–${toDay} ${monthYear}`;
    }
    return `${fromLabel} – ${toLabel}`;
  }
  if (state.fy) return `ปีงบประมาณ ${state.fy}`;
  return fyFallbackLabel;
}

export function commanderHasActiveFilters(state: CommanderUrlState): boolean {
  return Boolean(
    state.from ||
      state.to ||
      (state.fy && state.fy.length > 0) ||
      state.hqId ||
      state.regionId ||
      state.battalionId ||
      state.companyId ||
      state.province ||
      state.status
  );
}

export function commanderReturnQuery(state: CommanderUrlState): string {
  const parts: string[] = [];
  const kind = commanderPeriodKind(state);
  if (kind === "custom" || kind === "incomplete" || kind === "invalid") {
    if (state.from) parts.push(`from=${state.from}`);
    if (state.to) parts.push(`to=${state.to}`);
  } else if (state.fy) {
    parts.push(`fy=${state.fy}`);
  }
  if (state.hqId) parts.push(`hqId=${state.hqId}`);
  if (state.regionId) parts.push(`regionId=${state.regionId}`);
  if (state.battalionId) parts.push(`battalionId=${state.battalionId}`);
  if (state.companyId) parts.push(`companyId=${state.companyId}`);
  if (state.province) parts.push(`province=${state.province}`);
  if (state.status) parts.push(`status=${state.status}`);
  return parts.join("&");
}

export function commanderReturnPathFromState(state: CommanderUrlState): string {
  const q = commanderReturnQuery(state);
  return q ? `/drug-intelligence/command?${q}` : "/drug-intelligence/command";
}

/** Drops org ids that cannot exist under the currently selected parent. */
export function sanitizeCommanderOrgState(state: CommanderUrlState, tree: OrgTree): CommanderUrlState {
  const next: CommanderUrlState = { ...state };
  const hqId = next.hqId ? Number(next.hqId) : null;
  const regionId = next.regionId ? Number(next.regionId) : null;
  const battalionId = next.battalionId ? Number(next.battalionId) : null;
  const companyId = next.companyId ? Number(next.companyId) : null;

  if (hqId !== null && !tree.headquarters.some((h) => h.id === hqId)) {
    delete next.hqId;
  }
  const effectiveHq = next.hqId ? Number(next.hqId) : null;

  if (regionId !== null) {
    const region = tree.regions.find((r) => r.id === regionId);
    if (!region || (effectiveHq !== null && region.headquartersId !== effectiveHq)) {
      delete next.regionId;
      delete next.battalionId;
      delete next.companyId;
      return next;
    }
  }
  const effectiveRegion = next.regionId ? Number(next.regionId) : null;

  if (battalionId !== null) {
    const battalion = tree.battalions.find((b) => b.id === battalionId);
    if (!battalion || (effectiveRegion !== null && battalion.regionId !== effectiveRegion)) {
      delete next.battalionId;
      delete next.companyId;
      return next;
    }
  }
  const effectiveBattalion = next.battalionId ? Number(next.battalionId) : null;

  if (companyId !== null) {
    const company = tree.companies.find((c) => c.id === companyId);
    if (!company || (effectiveBattalion !== null && company.battalionId !== effectiveBattalion)) {
      delete next.companyId;
    }
  }
  return next;
}

export function commanderOrgStateEquals(a: CommanderUrlState, b: CommanderUrlState): boolean {
  return commanderReturnQuery(a) === commanderReturnQuery(b);
}
