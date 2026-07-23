/**
 * Shared input field allowlists and parse helpers for intelligence tools (Phase 49.6).
 */
import { EXECUTIVE_REPORT_TYPES } from "@/lib/commander_reports/types";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";
import type { ToolInputFieldSchema } from "@/lib/personnel_intelligence_service/tools/types";
import {
  INTELLIGENCE_MAX_PAGE_SIZE,
  type IntelligenceSortField,
} from "@/lib/personnel_intelligence_service/types";

export const SORT_FIELDS = [
  "name",
  "rank",
  "organization",
  "priority",
  "promotionStatus",
  "retirementYear",
  "readiness",
  "birthday",
] as const satisfies readonly IntelligenceSortField[];

export const PRIORITY_VALUES = ["low", "medium", "high", "critical"] as const;
export const READINESS_VALUES = ["READY", "NEEDS_REVIEW", "INCOMPLETE", "BLOCKED", "UNKNOWN"] as const;
export const DOC_STATUS_VALUES = ["missing", "expired", "warning", "complete"] as const;
export const RETIREMENT_WITHIN_VALUES = ["within-1-year", "within-3-years", "within-5-years"] as const;
export const TRAINING_STATUS_VALUES = [
  "Complete",
  "MissingRequired",
  "ExpiringSoon",
  "Expired",
  "NoData",
] as const;
export const BIRTHDAY_WINDOWS = [30, 60, 90] as const;

export const SCOPE_FIELDS: readonly ToolInputFieldSchema[] = [
  { name: "regionId", type: "number", description: "Organization region id" },
  { name: "battalionId", type: "number", description: "Battalion id" },
  { name: "companyId", type: "number", description: "Company id" },
];

export const COMMON_FILTER_FIELDS: readonly ToolInputFieldSchema[] = [
  ...SCOPE_FIELDS,
  { name: "rank", type: "string", description: "Exact rank label" },
  { name: "positionLevel", type: "string", description: "Position level label" },
  { name: "priority", type: "enum", enumValues: PRIORITY_VALUES, description: "Officer priority" },
  { name: "readiness", type: "enum", enumValues: READINESS_VALUES, description: "Document readiness" },
  {
    name: "documentStatus",
    type: "enum",
    enumValues: DOC_STATUS_VALUES,
    description: "Document status filter",
  },
  {
    name: "retirementWithin",
    type: "enum",
    enumValues: RETIREMENT_WITHIN_VALUES,
    description: "Retirement window",
  },
  {
    name: "trainingStatus",
    type: "enum",
    enumValues: TRAINING_STATUS_VALUES,
    description: "Training status",
  },
  { name: "asOf", type: "string", description: "ISO as-of timestamp" },
];

export const SEARCH_FIELDS: readonly ToolInputFieldSchema[] = [
  ...COMMON_FILTER_FIELDS,
  { name: "page", type: "number", description: "1-based page" },
  { name: "pageSize", type: "number", description: `Max ${INTELLIGENCE_MAX_PAGE_SIZE}` },
  { name: "sort", type: "enum", enumValues: SORT_FIELDS, description: "Allowed sort field" },
  { name: "order", type: "enum", enumValues: ["asc", "desc"], description: "Sort order" },
  { name: "searchText", type: "string", description: "Name/unit contains text (not logged)" },
  { name: "readyForPromotion", type: "boolean", description: "Ready-for-promotion convenience filter" },
  { name: "promotionOverdue", type: "boolean", description: "Promotion overdue convenience filter" },
  { name: "birthdayWindow", type: "number", description: "Birthday window days: 30|60|90" },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNoUnknownKeys(raw: Record<string, unknown>, allowed: ReadonlySet<string>): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) {
      throw new IntelligenceToolError("INVALID_TOOL_INPUT", `Unknown input field: ${key}`);
    }
  }
}

function optionalPositiveInt(raw: unknown, field: string): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", `Invalid ${field}`);
  }
  return n;
}

function optionalIso(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string") {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", "asOf must be an ISO string");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Invalid asOf");
  }
  return parsed.toISOString();
}

function optionalEnum(raw: unknown, allowed: readonly string[], field: string): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || !allowed.includes(raw)) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", `Invalid ${field}`);
  }
  return raw;
}

function optionalBool(raw: unknown, field: string): boolean | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (raw === true || raw === "true" || raw === "1") return true;
  if (raw === false || raw === "false" || raw === "0") return false;
  throw new IntelligenceToolError("INVALID_TOOL_INPUT", `Invalid ${field}`);
}

/** Flat tool query input (matches API/query-string style; service coerceQuery accepts this). */
export type FlatIntelligenceToolQueryInput = {
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  rank?: string;
  positionLevel?: string;
  priority?: string;
  readiness?: string;
  documentStatus?: string;
  retirementWithin?: string;
  trainingStatus?: string;
  birthdayWindow?: 30 | 60 | 90;
  searchText?: string;
  readyForPromotion?: boolean;
  promotionOverdue?: boolean;
  page?: number;
  pageSize?: number;
  sort?: IntelligenceSortField;
  order?: "asc" | "desc";
  asOf?: string;
};

/**
 * Parses flat tool input. Rejects unknown root keys. Does not mutate the input object.
 * Returns a flat record suitable for PersonnelIntelligenceService coerceQuery.
 */
export function parsePersonnelQueryInput(
  raw: unknown,
  allowedFields: readonly ToolInputFieldSchema[]
): FlatIntelligenceToolQueryInput {
  if (raw === undefined || raw === null) {
    return {};
  }
  if (!isPlainObject(raw)) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Input must be an object");
  }
  const allowed = new Set(allowedFields.map((f) => f.name));
  assertNoUnknownKeys(raw, allowed);

  const out: FlatIntelligenceToolQueryInput = {};

  const regionId = optionalPositiveInt(raw.regionId, "regionId");
  const battalionId = optionalPositiveInt(raw.battalionId, "battalionId");
  const companyId = optionalPositiveInt(raw.companyId, "companyId");
  if (regionId != null) out.regionId = regionId;
  if (battalionId != null) out.battalionId = battalionId;
  if (companyId != null) out.companyId = companyId;

  if (typeof raw.rank === "string" && raw.rank.trim()) out.rank = raw.rank.trim();
  if (typeof raw.positionLevel === "string" && raw.positionLevel.trim()) {
    out.positionLevel = raw.positionLevel.trim();
  }
  const priority = optionalEnum(raw.priority, PRIORITY_VALUES, "priority");
  if (priority) out.priority = priority;
  const readiness = optionalEnum(raw.readiness, READINESS_VALUES, "readiness");
  if (readiness) out.readiness = readiness;
  const documentStatus = optionalEnum(raw.documentStatus, DOC_STATUS_VALUES, "documentStatus");
  if (documentStatus) out.documentStatus = documentStatus;
  const retirementWithin = optionalEnum(raw.retirementWithin, RETIREMENT_WITHIN_VALUES, "retirementWithin");
  if (retirementWithin) out.retirementWithin = retirementWithin;
  const trainingStatus = optionalEnum(raw.trainingStatus, TRAINING_STATUS_VALUES, "trainingStatus");
  if (trainingStatus) out.trainingStatus = trainingStatus;
  if (raw.birthdayWindow !== undefined && raw.birthdayWindow !== "") {
    const n = Number(raw.birthdayWindow);
    if (!(BIRTHDAY_WINDOWS as readonly number[]).includes(n)) {
      throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Invalid birthdayWindow");
    }
    out.birthdayWindow = n as 30 | 60 | 90;
  }
  if (typeof raw.searchText === "string" && raw.searchText.trim()) {
    out.searchText = raw.searchText.trim().slice(0, 120);
  }
  const readyForPromotion = optionalBool(raw.readyForPromotion, "readyForPromotion");
  if (readyForPromotion === true) out.readyForPromotion = true;
  const promotionOverdue = optionalBool(raw.promotionOverdue, "promotionOverdue");
  if (promotionOverdue === true) out.promotionOverdue = true;

  if (raw.page !== undefined && raw.page !== "") {
    const page = Number(raw.page);
    if (!Number.isInteger(page) || page < 1) {
      throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Invalid page");
    }
    out.page = page;
  }

  if (raw.pageSize !== undefined && raw.pageSize !== "") {
    const pageSize = Number(raw.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Invalid pageSize");
    }
    if (pageSize > INTELLIGENCE_MAX_PAGE_SIZE) {
      throw new IntelligenceToolError(
        "INVALID_TOOL_INPUT",
        `pageSize exceeds maximum of ${INTELLIGENCE_MAX_PAGE_SIZE}`
      );
    }
    out.pageSize = pageSize;
  }

  if (typeof raw.sort === "string" && raw.sort.trim()) {
    if (!(SORT_FIELDS as readonly string[]).includes(raw.sort)) {
      throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Invalid sort field");
    }
    out.sort = raw.sort as IntelligenceSortField;
  }

  if (typeof raw.order === "string" && raw.order.trim()) {
    if (raw.order !== "asc" && raw.order !== "desc") {
      throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Invalid sort order");
    }
    out.order = raw.order;
  }

  const asOf = optionalIso(raw.asOf);
  if (asOf) out.asOf = asOf;

  return out;
}

export interface OfficerIntelligenceToolInput {
  officerId: string;
  asOf?: string;
}

export function parseOfficerIntelligenceInput(raw: unknown): OfficerIntelligenceToolInput {
  if (!isPlainObject(raw)) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Input must be an object");
  }
  assertNoUnknownKeys(raw, new Set(["officerId", "asOf"]));
  if (typeof raw.officerId !== "string" || !raw.officerId.trim()) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", "officerId is required");
  }
  return { officerId: raw.officerId.trim(), asOf: optionalIso(raw.asOf) };
}

export interface ReportProjectionToolInput {
  type: string;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  asOf?: string;
  preparedByTh?: string;
  fiscalYearBe?: number;
}

export function parseReportProjectionInput(raw: unknown): ReportProjectionToolInput {
  if (!isPlainObject(raw)) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Input must be an object");
  }
  assertNoUnknownKeys(
    raw,
    new Set(["type", "reportType", "regionId", "battalionId", "companyId", "asOf", "preparedByTh", "fiscalYearBe"])
  );
  const typeRaw = raw.type ?? raw.reportType;
  if (typeof typeRaw !== "string" || !typeRaw.trim()) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", "report type is required");
  }
  if (!(EXECUTIVE_REPORT_TYPES as readonly string[]).includes(typeRaw)) {
    throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Unknown report type");
  }
  let fiscalYearBe: number | undefined;
  if (raw.fiscalYearBe !== undefined && raw.fiscalYearBe !== "") {
    fiscalYearBe = Number(raw.fiscalYearBe);
    if (!Number.isInteger(fiscalYearBe) || fiscalYearBe < 2400 || fiscalYearBe > 2700) {
      throw new IntelligenceToolError("INVALID_TOOL_INPUT", "Invalid fiscalYearBe");
    }
  }
  return {
    type: typeRaw,
    regionId: optionalPositiveInt(raw.regionId, "regionId"),
    battalionId: optionalPositiveInt(raw.battalionId, "battalionId"),
    companyId: optionalPositiveInt(raw.companyId, "companyId"),
    asOf: optionalIso(raw.asOf),
    preparedByTh: typeof raw.preparedByTh === "string" ? raw.preparedByTh.slice(0, 120) : undefined,
    fiscalYearBe,
  };
}
