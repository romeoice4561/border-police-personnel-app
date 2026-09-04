/**
 * Commander period comparison + deterministic situation copy (Phase 2D).
 *
 * Comparison windows are the same length as the selected valid period, or
 * the previous fiscal year when FY mode is active. Queue metrics (alerts,
 * duplicates) are never compared here — they are current operational queues.
 *
 * Pure — no I/O, no React, no AI.
 */

import { formatShortThaiDateTh } from "@/lib/intelligence/shared/thai_date";
import { fiscalYearEnd, fiscalYearStart } from "@/lib/personnel_calendar/fiscal_year";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import type { CommanderSeizureItem } from "@/lib/drug_intelligence/drug_commander_dashboard_types";

export type CommanderComparisonKind = "previous-fy" | "previous-window";
export type CommanderChangeDirection = "up" | "down" | "same";
export type CommanderSituationHref =
  | "cases"
  | "map"
  | "alerts"
  | "persons"
  | "duplicates";

export interface CommanderComparisonPeriod {
  kind: CommanderComparisonKind;
  from: Date;
  to: Date;
  fiscalYear?: number;
  fiscalYearBe?: number;
  labelTh: string;
  labelEn: string;
}

export interface CommanderMetricDelta {
  current: number;
  previous: number;
  absoluteChange: number;
  /** Null when previous is 0 — never Infinity. */
  percentChange: number | null;
  direction: CommanderChangeDirection;
}

export interface CommanderDeltaCopy {
  directionLabel: string;
  changeText: string;
  percentText: string;
}

export interface CommanderSituationObservation {
  id: string;
  textTh: string;
  textEn: string;
  href: CommanderSituationHref;
  hrefProvince?: string;
}

export function resolveCommanderComparisonPeriod(
  filter: CommanderDashboardFilter
): CommanderComparisonPeriod {
  if (filter.fiscalYear !== undefined && filter.fiscalYearBe !== undefined) {
    const previousFy = filter.fiscalYear - 1;
    const previousBe = filter.fiscalYearBe - 1;
    return {
      kind: "previous-fy",
      from: fiscalYearStart(previousFy),
      to: fiscalYearEnd(previousFy),
      fiscalYear: previousFy,
      fiscalYearBe: previousBe,
      labelTh: `ปีงบประมาณ ${previousBe}`,
      labelEn: `Fiscal year ${previousBe}`,
    };
  }

  const durationMs = filter.arrestDateTo.getTime() - filter.arrestDateFrom.getTime();
  const to = new Date(filter.arrestDateFrom.getTime() - 1);
  const from = new Date(to.getTime() - durationMs);
  return {
    kind: "previous-window",
    from,
    to,
    labelTh: `${formatShortThaiDateTh(from)} – ${formatShortThaiDateTh(to)}`,
    labelEn: `${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}`,
  };
}

export function filterForCommanderComparisonPeriod(
  filter: CommanderDashboardFilter,
  period: CommanderComparisonPeriod
): CommanderDashboardFilter {
  return {
    ...filter,
    arrestDateFrom: period.from,
    arrestDateTo: period.to,
    fiscalYear: period.fiscalYear,
    fiscalYearBe: period.fiscalYearBe,
    displayFiscalYearTh: period.kind === "previous-fy" ? period.labelTh : undefined,
  };
}

export function compareCommanderMetric(current: number, previous: number): CommanderMetricDelta {
  const absoluteChange = current - previous;
  const direction: CommanderChangeDirection =
    absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "same";
  return {
    current,
    previous,
    absoluteChange,
    percentChange: previous === 0 ? null : (absoluteChange / previous) * 100,
    direction,
  };
}

export type CommanderCopyLanguage = "th" | "en";

export function commanderSeizureDisplayUnit(
  measurementKind: string,
  displayUnit: string | null | undefined,
  lang: CommanderCopyLanguage = "th"
): string {
  if (measurementKind === "MASS") {
    return lang === "en" ? "kg" : "กก.";
  }
  return displayUnit || (lang === "en" ? "tablets" : "เม็ด");
}

export function formatCommanderPercent(
  percentChange: number | null,
  lang: CommanderCopyLanguage = "th"
): string {
  if (percentChange === null) {
    return lang === "en" ? "No previous-period data" : "ช่วงก่อนยังไม่มีข้อมูล";
  }
  const rounded = Math.round(percentChange * 10) / 10;
  const abs = Math.abs(rounded).toLocaleString("th-TH", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  });
  if (rounded > 0) return `+${abs}%`;
  if (rounded < 0) return `−${abs}%`;
  return "0%";
}

export function formatCommanderDeltaCopy(
  delta: CommanderMetricDelta,
  unit: string,
  lang: CommanderCopyLanguage = "th"
): CommanderDeltaCopy {
  const abs = Math.abs(delta.absoluteChange).toLocaleString("th-TH");
  const unitLabel = lang === "en" ? unit.toLowerCase() : unit;
  if (delta.direction === "same") {
    return {
      directionLabel: lang === "en" ? "unchanged" : "เท่าเดิม",
      changeText: lang === "en" ? "unchanged" : "เท่าเดิม",
      percentText: formatCommanderPercent(delta.percentChange, lang),
    };
  }
  if (delta.direction === "up") {
    return {
      directionLabel: lang === "en" ? "up" : "เพิ่มขึ้น",
      changeText:
        lang === "en"
          ? `up ${abs} ${unitLabel} from the previous period`
          : `เพิ่มขึ้น ${abs} ${unitLabel}จากช่วงก่อน`,
      percentText: formatCommanderPercent(delta.percentChange, lang),
    };
  }
  return {
    directionLabel: lang === "en" ? "down" : "ลดลง",
    changeText:
      lang === "en"
        ? `down ${abs} ${unitLabel} from the previous period`
        : `ลดลง ${abs} ${unitLabel}จากช่วงก่อน`,
    percentText: formatCommanderPercent(delta.percentChange, lang),
  };
}

export function seizureComparisonKey(item: Pick<CommanderSeizureItem, "drugCategory" | "measurementKind">): string {
  return `${item.drugCategory}::${item.measurementKind}`;
}

export function seizureComparableValue(item: CommanderSeizureItem): number {
  if (item.measurementKind === "COUNT") return item.totalQuantity ?? 0;
  return item.totalWeightKg ?? 0;
}

export function compareCommanderSeizures(
  current: CommanderSeizureItem[],
  previous: CommanderSeizureItem[]
): Array<{ item: CommanderSeizureItem; delta: CommanderMetricDelta }> {
  const previousByKey = new Map(previous.map((item) => [seizureComparisonKey(item), item]));
  return current.map((item) => {
    const prior = previousByKey.get(seizureComparisonKey(item));
    const previousValue = prior ? seizureComparableValue(prior) : 0;
    return { item, delta: compareCommanderMetric(seizureComparableValue(item), previousValue) };
  });
}

export interface CommanderSituationInput {
  caseCount: number;
  caseDelta: CommanderMetricDelta;
  topProvince?: { province: string; caseCount: number };
  topCountSeizure?: { labelTh: string; totalQuantity: number; displayUnit: string | null };
  newAlertsCount: number;
  casesWithoutArrestedRoleCount: number;
}

export function buildCommanderSituationObservations(
  input: CommanderSituationInput
): CommanderSituationObservation[] {
  const observations: CommanderSituationObservation[] = [];
  const caseAbs = Math.abs(input.caseDelta.absoluteChange).toLocaleString("th-TH");
  const caseCurrent = input.caseCount.toLocaleString("th-TH");

  if (input.caseDelta.direction === "up") {
    observations.push({
      id: "cases-up",
      textTh: `ช่วงที่เลือกมีคดี ${caseCurrent} คดี เพิ่มขึ้นจากช่วงก่อน ${caseAbs} คดี`,
      textEn: `This period has ${caseCurrent} cases, up ${caseAbs} from the previous period`,
      href: "cases",
    });
  } else if (input.caseDelta.direction === "down") {
    observations.push({
      id: "cases-down",
      textTh: `ช่วงที่เลือกมีคดี ${caseCurrent} คดี ลดลงจากช่วงก่อน ${caseAbs} คดี`,
      textEn: `This period has ${caseCurrent} cases, down ${caseAbs} from the previous period`,
      href: "cases",
    });
  } else {
    observations.push({
      id: "cases-same",
      textTh: `ช่วงที่เลือกมีคดี ${caseCurrent} คดี เท่าเดิมจากช่วงก่อน`,
      textEn: `This period has ${caseCurrent} cases, unchanged from the previous period`,
      href: "cases",
    });
  }

  if (input.topProvince && input.topProvince.caseCount > 0) {
    const count = input.topProvince.caseCount.toLocaleString("th-TH");
    observations.push({
      id: "top-province",
      textTh: `${input.topProvince.province}มีจำนวนคดีสูงสุดในช่วงที่เลือก ${count} คดี`,
      textEn: `${input.topProvince.province} has the highest case count in this period (${count})`,
      href: "map",
      hrefProvince: input.topProvince.province,
    });
  }

  if (input.topCountSeizure && input.topCountSeizure.totalQuantity > 0) {
    const unit = input.topCountSeizure.displayUnit ?? "หน่วย";
    const qty = input.topCountSeizure.totalQuantity.toLocaleString("th-TH");
    observations.push({
      id: "top-count-seizure",
      textTh: `${input.topCountSeizure.labelTh}เป็นของกลางที่พบมากที่สุด (${qty} ${unit})`,
      textEn: `${input.topCountSeizure.labelTh} is the most recorded seizure (${qty} ${unit})`,
      href: "map",
    });
  }

  if (input.newAlertsCount > 0) {
    const count = input.newAlertsCount.toLocaleString("th-TH");
    observations.push({
      id: "new-alerts",
      textTh: `มีสัญญาณข่าวกรองใหม่ ${count} รายการรอตรวจสอบ`,
      textEn: `${count} new intelligence signals are waiting for review`,
      href: "alerts",
    });
  }

  if (input.casesWithoutArrestedRoleCount > 0 && observations.length < 5) {
    const count = input.casesWithoutArrestedRoleCount.toLocaleString("th-TH");
    observations.push({
      id: "missing-arrested",
      textTh: `มี ${count} คดีในช่วงที่เลือกที่ยังไม่มีผู้ถูกจับ/ผู้ต้องหาในระบบ`,
      textEn: `${count} cases in this period have no arrested/accused person recorded`,
      href: "cases",
    });
  }

  return observations.slice(0, 5);
}

export function commanderSharePercent(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

export function commanderReadinessPercent(part: number, total: number): number | null {
  return commanderSharePercent(part, total);
}
