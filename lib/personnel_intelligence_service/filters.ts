/**
 * Canonical filter normalization for Personnel Intelligence Service (Phase 49.5).
 *
 * Reuses equality semantics from Commander Search / Executive Reports
 * (region/battalion/company/rank/priority/training/document/retirement).
 * Pure — never mutates the source array.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { ReportFilterState } from "@/lib/commander_reports/types";
import { PersonnelIntelligenceError } from "@/lib/personnel_intelligence_service/errors";
import type {
  BirthdayWindowDays,
  IntelligenceScope,
  IntelligenceSortField,
  PersonnelIntelligenceFilters,
  PersonnelIntelligenceQuery,
} from "@/lib/personnel_intelligence_service/types";
import {
  INTELLIGENCE_DEFAULT_PAGE_SIZE,
  INTELLIGENCE_MAX_PAGE_SIZE,
} from "@/lib/personnel_intelligence_service/types";

const PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const READINESS = new Set(["READY", "NEEDS_REVIEW", "INCOMPLETE", "BLOCKED", "UNKNOWN"]);
const DOC_STATUS = new Set(["missing", "expired", "warning", "complete"]);
const RETIREMENT = new Set(["within-1-year", "within-3-years", "within-5-years"]);
const TRAINING = new Set([
  "Complete",
  "MissingRequired",
  "ExpiringSoon",
  "Expired",
  "Unverified",
  "NoPolicy",
  "NoData",
  "Unknown",
]);
const PROMOTION = new Set([
  "EligibleThisYear",
  "AlreadyEligible",
  "Waiting",
  "MissingTraining",
  "MissingDocuments",
  "RetirementRestricted",
  "NotEligible",
  "Unknown",
]);
const SORT_FIELDS = new Set([
  "name",
  "rank",
  "organization",
  "priority",
  "promotionStatus",
  "retirementYear",
  "readiness",
  "birthday",
]);

function optionalPositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new PersonnelIntelligenceError("INVALID_QUERY", `Invalid ${field}`);
  }
  return n;
}

function daysUntilNextBirthday(dob: Date, asOf: Date): number {
  const asOfUtc = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  let next = new Date(Date.UTC(asOfUtc.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
  if (next.getTime() < asOfUtc.getTime()) {
    next = new Date(Date.UTC(asOfUtc.getUTCFullYear() + 1, dob.getUTCMonth(), dob.getUTCDate()));
  }
  return Math.round((next.getTime() - asOfUtc.getTime()) / 86_400_000);
}

function matchesDocumentStatus(
  officer: CommanderQueryOfficer,
  status: NonNullable<PersonnelIntelligenceFilters["documentStatus"]>
): boolean {
  const di = officer.documentIntelligence;
  if (status === "missing") return di.missingRequiredCount > 0;
  if (status === "expired") return di.expiredCount > 0;
  if (status === "warning") return officer.documentExpiryInfo.some((i) => i.status === "expiring_soon");
  return di.missingRequiredCount === 0 && di.expiredCount === 0;
}

function matchesRetirementWithin(
  officer: CommanderQueryOfficer,
  within: NonNullable<PersonnelIntelligenceFilters["retirementWithin"]>,
  asOf: Date
): boolean {
  if (officer.retirementYear == null) return false;
  const horizon = within === "within-1-year" ? 1 : within === "within-3-years" ? 3 : 5;
  return officer.retirementYear - asOf.getUTCFullYear() <= horizon;
}

function isReadyForPromotion(officer: CommanderQueryOfficer): boolean {
  return (
    officer.nextLevelEligibility?.eligibleNow === true ||
    officer.promotionIntelligence.promotionStatus === "EligibleThisYear" ||
    officer.promotionIntelligence.promotionStatus === "AlreadyEligible"
  );
}

/** Parses and validates a raw query into a normalized query object. */
export function normalizeIntelligenceQuery(raw: Record<string, unknown> = {}): Required<
  Pick<PersonnelIntelligenceQuery, "page" | "pageSize" | "order" | "sort">
> &
  PersonnelIntelligenceQuery {
  const scope: IntelligenceScope = {
    regionId: optionalPositiveInt(raw.regionId, "regionId"),
    battalionId: optionalPositiveInt(raw.battalionId, "battalionId"),
    companyId: optionalPositiveInt(raw.companyId, "companyId"),
  };

  const filters: PersonnelIntelligenceFilters = {};
  if (typeof raw.rank === "string" && raw.rank.trim()) filters.rank = raw.rank.trim();
  if (typeof raw.positionLevel === "string" && raw.positionLevel.trim()) {
    filters.positionLevel = raw.positionLevel.trim();
  }
  if (typeof raw.promotionStatus === "string") {
    if (!PROMOTION.has(raw.promotionStatus)) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid promotionStatus");
    }
    filters.promotionStatus = raw.promotionStatus as PersonnelIntelligenceFilters["promotionStatus"];
  }
  if (typeof raw.retirementStatus === "string" || typeof raw.retirementWithin === "string") {
    const value = String(raw.retirementWithin ?? raw.retirementStatus);
    if (!RETIREMENT.has(value)) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid retirementWithin");
    }
    filters.retirementWithin = value as PersonnelIntelligenceFilters["retirementWithin"];
  }
  if (typeof raw.documentStatus === "string") {
    if (!DOC_STATUS.has(raw.documentStatus)) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid documentStatus");
    }
    filters.documentStatus = raw.documentStatus as PersonnelIntelligenceFilters["documentStatus"];
  }
  if (typeof raw.trainingStatus === "string") {
    if (!TRAINING.has(raw.trainingStatus)) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid trainingStatus");
    }
    filters.trainingStatus = raw.trainingStatus as PersonnelIntelligenceFilters["trainingStatus"];
  }
  if (typeof raw.readiness === "string") {
    if (!READINESS.has(raw.readiness)) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid readiness");
    }
    filters.readiness = raw.readiness as PersonnelIntelligenceFilters["readiness"];
  }
  if (typeof raw.priority === "string") {
    if (!PRIORITIES.has(raw.priority)) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid priority");
    }
    filters.priority = raw.priority as PersonnelIntelligenceFilters["priority"];
  }
  if (raw.birthdayWindow !== undefined && raw.birthdayWindow !== "") {
    const n = Number(raw.birthdayWindow);
    if (![30, 60, 90].includes(n)) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid birthdayWindow");
    }
    filters.birthdayWindow = n as BirthdayWindowDays;
  }
  if (typeof raw.searchText === "string" && raw.searchText.trim()) {
    filters.searchText = raw.searchText.trim().slice(0, 120);
  }
  if (raw.readyForPromotion === true || raw.readyForPromotion === "true" || raw.readyForPromotion === "1") {
    filters.readyForPromotion = true;
  }
  if (raw.promotionOverdue === true || raw.promotionOverdue === "true" || raw.promotionOverdue === "1") {
    filters.promotionOverdue = true;
  }

  let page = 1;
  if (raw.page !== undefined && raw.page !== "") {
    page = Number(raw.page);
    if (!Number.isInteger(page) || page < 1) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid page");
    }
  }

  let pageSize = INTELLIGENCE_DEFAULT_PAGE_SIZE;
  if (raw.pageSize !== undefined && raw.pageSize !== "") {
    pageSize = Number(raw.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid pageSize");
    }
    if (pageSize > INTELLIGENCE_MAX_PAGE_SIZE) {
      throw new PersonnelIntelligenceError(
        "INVALID_QUERY",
        `pageSize exceeds maximum of ${INTELLIGENCE_MAX_PAGE_SIZE}`
      );
    }
  }

  let sort: IntelligenceSortField = "priority";
  if (typeof raw.sort === "string" && raw.sort.trim()) {
    if (!SORT_FIELDS.has(raw.sort)) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid sort field");
    }
    sort = raw.sort as IntelligenceSortField;
  }

  let order: "asc" | "desc" = "desc";
  if (typeof raw.order === "string" && raw.order.trim()) {
    if (raw.order !== "asc" && raw.order !== "desc") {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid sort order");
    }
    order = raw.order;
  }

  let asOf: string | undefined;
  if (typeof raw.asOf === "string" && raw.asOf.trim()) {
    const parsed = new Date(raw.asOf);
    if (Number.isNaN(parsed.getTime())) {
      throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid asOf");
    }
    asOf = parsed.toISOString();
  }

  return { scope, filters, page, pageSize, sort, order, asOf };
}

/** Maps service filters → Phase 49C ReportFilterState (shared semantics). */
export function toReportFilterState(
  scope: IntelligenceScope | undefined,
  filters: PersonnelIntelligenceFilters | undefined
): ReportFilterState {
  return {
    regionId: scope?.regionId,
    battalionId: scope?.battalionId,
    companyId: scope?.companyId,
    rank: filters?.rank,
    positionLevel: filters?.positionLevel,
    priority: filters?.priority,
    readiness: filters?.readiness,
    documentStatus: filters?.documentStatus,
    trainingStatus: filters?.trainingStatus,
    retirementWithin: filters?.retirementWithin,
  };
}

/** Applies scope + filters; returns a new array. */
export function applyIntelligenceFilters(
  officers: readonly CommanderQueryOfficer[],
  scope: IntelligenceScope | undefined,
  filters: PersonnelIntelligenceFilters | undefined,
  asOf: Date
): CommanderQueryOfficer[] {
  const f = filters ?? {};
  const search = f.searchText?.toLowerCase();

  return officers.filter((row) => {
    if (scope?.regionId != null && row.regionId !== scope.regionId) return false;
    if (scope?.battalionId != null && row.battalionId !== scope.battalionId) return false;
    if (scope?.companyId != null && row.companyId !== scope.companyId) return false;
    if (f.rank && row.rank !== f.rank) return false;
    if (f.positionLevel && row.positionLevel !== f.positionLevel) return false;
    if (f.priority && row.priority !== f.priority) return false;
    if (f.readiness && row.documentIntelligence.readinessLevel !== f.readiness) return false;
    if (f.trainingStatus && row.trainingIntelligence.trainingStatus !== f.trainingStatus) return false;
    if (f.promotionStatus && row.promotionIntelligence.promotionStatus !== f.promotionStatus) return false;
    if (f.documentStatus && !matchesDocumentStatus(row, f.documentStatus)) return false;
    if (f.retirementWithin && !matchesRetirementWithin(row, f.retirementWithin, asOf)) return false;
    if (f.readyForPromotion && !isReadyForPromotion(row)) return false;
    if (
      f.promotionOverdue &&
      !(row.promotionIntelligence.overdueYears != null && row.promotionIntelligence.overdueYears > 0)
    ) {
      return false;
    }
    if (f.birthdayWindow != null) {
      if (!row.dateOfBirth) return false;
      if (daysUntilNextBirthday(row.dateOfBirth, asOf) > f.birthdayWindow) return false;
    }
    if (search) {
      const hay = `${row.displayName} ${row.rank} ${row.currentUnit ?? ""} ${row.currentPosition ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export { daysUntilNextBirthday, isReadyForPromotion };
