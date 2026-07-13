import type { OfficerFlag, OfficerFlagCode, OfficerPriority, PromotionStatus, RetirementStatus } from "@/lib/intelligence";

export type NumericOperator = "exactly" | "at_least" | "more_than" | "less_than";

export type CommanderChartKind = "rank" | "positionLevel" | "company";

export interface CommanderQueryOfficer {
  officerId: string;
  rank: string;
  firstName: string;
  lastName: string;
  displayName: string;
  currentPosition: string | null;
  positionLevel: string | null;
  currentUnit: string | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  companyLabel: string;
  yearsInRank: number | null;
  yearsInPosition: number | null;
  governmentServiceYears: number | null;
  ageYears: number | null;
  retirementYear: number | null;
  promotionStatus: PromotionStatus;
  retirementStatus: RetirementStatus;
  priority: OfficerPriority;
  profileCompletenessPercent: number | null;
  flags: OfficerFlag[];
  flagCodes: OfficerFlagCode[];
  hasGp7: boolean;
  hasOfficialPortrait: boolean;
  hasTraining: boolean;
  hasDocuments: boolean;
  thumbnailUrl: string | null;
  driveFileId: string | null;
  webViewUrl: string | null;
}

export interface CommanderQueryOptions {
  ranks: string[];
  positionLevels: string[];
  regions: Array<{ id: number; label: string }>;
  battalions: Array<{ id: number; regionId: number | null; label: string }>;
  companies: Array<{ id: number; battalionId: number | null; label: string }>;
  priorities: OfficerPriority[];
}

export interface CommanderQueryDataset {
  officers: CommanderQueryOfficer[];
  options: CommanderQueryOptions;
}
