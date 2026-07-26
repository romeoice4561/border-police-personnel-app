/**
 * Retirement section — aggregates existing retirementYear / retirementStatus only.
 * Aggregates existing retirementYear / retirementStatus only — no second formula.
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import {
  COMMAND_POSITION_LEVELS,
  WORKFORCE_RETIREMENT_LABEL_TH,
  WORKFORCE_RETIREMENT_WINDOWS,
} from "@/lib/commander_workforce/contracts";
import { buildWorkforceDrilldown } from "@/lib/commander_workforce/drilldown";
import type {
  WorkforceMetric,
  WorkforceRetirementBucket,
  WorkforceRetirementSection,
  WorkforceRetirementWindowKey,
} from "@/lib/commander_workforce/types";
import { currentFiscalYear } from "@/lib/personnel_calendar/fiscal_year";

/**
 * Bucket an officer using already-populated retirementYear (Gregorian FY label)
 * and retirementStatus — aggregation only, not a second retirement formula.
 */
export function retirementWindowForOfficer(
  officer: CommanderQueryOfficer,
  asOf: Date
): WorkforceRetirementWindowKey {
  if (officer.retirementStatus === "retired") return "already_retired";

  const year = officer.retirementYear;
  if (year == null || !Number.isFinite(year)) return "unknown";

  const fy = currentFiscalYear(asOf);
  const delta = year - fy;
  if (delta < 0) {
    // Past FY and not already marked retired above — aggregate into this FY bucket.
    return "this_fiscal_year";
  }
  if (delta === 0) return "this_fiscal_year";
  if (delta <= 1 || officer.retirementStatus === "retiring_within_1_year") return "within_1_year";
  if (delta <= 3) return "within_3_years";
  if (delta <= 5) return "within_5_years";
  return "beyond_5_years";
}

function retirementSearchParam(window: WorkforceRetirementWindowKey): string | null {
  switch (window) {
    case "within_1_year":
      return "within-1-year";
    case "within_3_years":
      return "within-3-years";
    case "within_5_years":
      return "within-5-years";
    default:
      return null;
  }
}

export function buildRetirementSection(
  officers: readonly CommanderQueryOfficer[],
  asOf: Date
): WorkforceRetirementSection {
  const counts = Object.fromEntries(WORKFORCE_RETIREMENT_WINDOWS.map((k) => [k, 0])) as Record<
    WorkforceRetirementWindowKey,
    number
  >;

  for (const officer of officers) {
    counts[retirementWindowForOfficer(officer, asOf)] += 1;
  }

  const buckets: WorkforceRetirementBucket[] = WORKFORCE_RETIREMENT_WINDOWS.map((key) => {
    const searchRetirement = retirementSearchParam(key);
    return {
      key,
      labelTh: WORKFORCE_RETIREMENT_LABEL_TH[key],
      count: counts[key],
      drilldown: buildWorkforceDrilldown({
        id: `retirement:${key}`,
        label: WORKFORCE_RETIREMENT_LABEL_TH[key],
        filters: searchRetirement
          ? { retirement: searchRetirement }
          : key === "already_retired"
            ? { retirementStatus: "retired" }
            : { retirementWindow: key },
      }),
    };
  });

  let commandCount = 0;
  let commandNear = 0;
  for (const officer of officers) {
    const level = officer.positionLevel;
    if (!level || !COMMAND_POSITION_LEVELS.has(level)) continue;
    commandCount += 1;
    const w = retirementWindowForOfficer(officer, asOf);
    if (w === "this_fiscal_year" || w === "within_1_year" || w === "within_3_years") {
      commandNear += 1;
    }
  }

  const commandPositionExposure: WorkforceMetric = {
    key: "command_position_retirement_exposure",
    labelTh: "ตำแหน่งผู้บังคับบัญชาที่ใกล้เกษียณ (≤3 ปี)",
    count: commandNear,
    percentage: commandCount > 0 ? roundPct(commandNear, commandCount) : null,
    availability:
      commandCount > 0
        ? { status: "available" }
        : { status: "unavailable", reason: "INSUFFICIENT_DATA" },
    drilldown: buildWorkforceDrilldown({
      id: "retirement:command_exposure",
      label: "ตำแหน่งผู้บังคับบัญชาใกล้เกษียณ",
      filters: { retirement: "within-3-years" },
    }),
    descriptionTh:
      commandCount > 0
        ? `จากตำแหน่งผู้บังคับบัญชา ${commandCount} รายการที่มีข้อมูลระดับตำแหน่ง`
        : "ไม่มีกำลังพลในระดับตำแหน่งผู้บังคับบัญชาในชุดข้อมูลนี้",
  };

  return { buckets, commandPositionExposure };
}

function roundPct(n: number, d: number): number {
  return Math.round((n / d) * 1000) / 10;
}
