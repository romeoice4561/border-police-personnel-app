import type { CommanderQueryOfficer, NumericOperator } from "@/lib/commander_query/types";
import type { OfficerFlagCode, OfficerPriority, PromotionStatus } from "@/lib/intelligence";

export type CommanderSortField =
  | "rank"
  | "displayName"
  | "currentPosition"
  | "positionLevel"
  | "yearsInRank"
  | "yearsInPosition"
  | "governmentServiceYears"
  | "ageYears"
  | "promotionStatus"
  | "retirementStatus"
  | "priority";

export interface NumericFilter {
  operator: NumericOperator;
  value: number;
}

export interface CommanderQueryFilters {
  rank?: string;
  currentPosition?: string;
  positionLevel?: string;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  yearsInRank?: NumericFilter;
  yearsInPosition?: NumericFilter;
  age?: NumericFilter;
  governmentServiceYears?: NumericFilter;
  promotionStatus?: PromotionStatus;
  flagCode?: OfficerFlagCode;
  priority?: OfficerPriority;
  minProfileCompleteness?: number;
}

export interface DrilldownFilter {
  field: keyof Pick<CommanderQueryOfficer, "rank" | "positionLevel" | "companyLabel" | "retirementYear">;
  value: string | number | null;
  label: string;
}
