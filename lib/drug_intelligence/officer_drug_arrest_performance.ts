/**
 * Officer Drug-Arrest Performance view model (Phase DI-7.7, Section 2/4).
 *
 * Pure composition layer — mirrors lib/officer_intelligence/view_model.ts's
 * convention exactly: takes already-loaded rows (no I/O here) and produces
 * one flat, display-ready structured object. Nothing here recalculates
 * seizure math independently — every per-item figure comes from
 * resolveDrugSeizedItemAnalyticsView (Phase DI-3.1), and COUNT/MASS rows are
 * NEVER summed together (Section 5's explicit constraint).
 *
 * This is the single source both the Officer Profile card AND a future
 * Commander Dashboard drill-down read from (Section 4: "enough information
 * for Officer Profile + future Commander Dashboard drill-down").
 *
 * Pure — no I/O, no React.
 */

import {
  resolveDrugSeizedItemAnalyticsView,
  formatSeizedItemDisplayTh,
  type DrugSeizedItemAnalyticsFacts,
} from "@/lib/drug_intelligence/drug_seized_item_analytics";
import { DRUG_CASE_OFFICER_ROLE_LABELS, isValidDrugCaseOfficerRole, type DrugCaseOfficerRole } from "@/lib/drug_intelligence/drug_case_officer_options";
import { DRUG_CASE_STATUS_META, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";

/** One case an officer participated in — every field the officer's row set carries, PLUS the resolved case facts needed to render a table row without a second lookup. */
export interface OfficerDrugArrestCaseSummary {
  caseId: string;
  caseNumber: string;
  title: string;
  /** Raw status enum — never rendered directly; pair with statusLabelTh. */
  status: string;
  statusLabelTh: string;
  arrestDate: Date | null;
  province: string | null;
  district: string | null;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  /** This officer's role(s) IN THIS CASE — an officer can appear more than once per case with different roles (Section 3: "may have different roles"). */
  roles: DrugCaseOfficerRole[];
  roleLabelsTh: string[];
  defendantCount: number;
  /** Grouped, unit-safe seizure summary for this one case (Section 5). */
  seizedItems: OfficerDrugArrestSeizureGroup[];
}

/** One (drugCategory, measurementKind) group — COUNT and MASS are never combined into a single number (Section 5's explicit constraint). COUNT rows with different stored display units (เม็ด vs ขวด) stay in separate groups so units are never mixed. */
export interface OfficerDrugArrestSeizureGroup {
  drugCategory: string;
  categoryLabelTh: string;
  measurementKind: "COUNT" | "MASS";
  /** Sum of normalizedCount across matching rows — populated only when measurementKind = COUNT. */
  totalCount: number | null;
  /** Sum of normalizedWeightGrams across matching rows — populated only when measurementKind = MASS. Grams remain the persisted unit (matches DrugSeizedItem.weightGrams's own convention). */
  totalWeightGrams: number | null;
  totalWeightKilograms: number | null;
  /** Stored COUNT display unit (เม็ด, ขวด, มล., …) — null for MASS groups. */
  displayUnit: string | null;
  /** "ยาบ้า 370,000 เม็ด" / "ไอซ์ 5.4 กก." — pre-formatted via formatSeizedItemDisplayTh, Thai, unit-correct. */
  displayTh: string;
}

export interface OfficerDrugArrestPerformanceSummary {
  officerId: string;
  totalCases: number;
  leadCases: number;
  arrestingOfficerCases: number;
  latestArrestDate: Date | null;
  /** Chronological, most recent first (Section 2: "chronological case list"). */
  cases: OfficerDrugArrestCaseSummary[];
  /** Section 5: seizure totals aggregated across EVERY case this officer participated in — grouped the same unit-safe way as the per-case groups. Explicitly labeled "ของกลางในคดีที่มีส่วนร่วม" at render time, never implying sole personal attribution. */
  aggregateSeizedItems: OfficerDrugArrestSeizureGroup[];
}

interface RawOfficerCaseRole {
  caseId: string;
  role: string;
}

interface RawCaseFacts {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: Date | null;
  province: string | null;
  district: string | null;
  reportingUnitText: string | null;
  leadUnitText: string | null;
  defendantCount: number;
  seizedItems: DrugSeizedItemAnalyticsFacts[];
}

function statusLabel(status: string): string {
  return isValidDrugCaseStatus(status) ? DRUG_CASE_STATUS_META[status].labelTh : status;
}

function roleLabel(role: string): { role: DrugCaseOfficerRole; label: string } | null {
  if (!isValidDrugCaseOfficerRole(role)) return null;
  return { role, label: DRUG_CASE_OFFICER_ROLE_LABELS[role].labelTh };
}

/**
 * Groups seized-item facts by (drugCategory, measurementKind) and sums the
 * matching numeric field per group — COUNT rows sum normalizedCount, MASS
 * rows sum normalizedWeightGrams, and the two measurement kinds for the
 * SAME category are kept as two separate groups rather than one merged
 * total (a category can legitimately appear as both, e.g. ยาบ้า counted in
 * some cases and — theoretically — weighed in others; never silently
 * combined).
 */
export function groupSeizedItemFacts(items: DrugSeizedItemAnalyticsFacts[]): OfficerDrugArrestSeizureGroup[] {
  const groups = new Map<string, OfficerDrugArrestSeizureGroup>();
  for (const item of items) {
    const view = resolveDrugSeizedItemAnalyticsView(item);
    const displayUnit = view.measurementKind === "COUNT" ? (view.displayUnit?.trim() || null) : null;
    // COUNT groups by stored unit so 5,000 เม็ด and 10 ขวด never become one number.
    const key = `${view.drugCategory}::${view.measurementKind}::${displayUnit ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      if (view.measurementKind === "COUNT" && view.normalizedCount !== null) {
        existing.totalCount = (existing.totalCount ?? 0) + view.normalizedCount;
      }
      if (view.measurementKind === "MASS" && view.normalizedWeightGrams !== null) {
        existing.totalWeightGrams = (existing.totalWeightGrams ?? 0) + view.normalizedWeightGrams;
        existing.totalWeightKilograms = (existing.totalWeightGrams ?? 0) / 1000;
      }
    } else {
      groups.set(key, {
        drugCategory: view.drugCategory,
        categoryLabelTh: view.categoryLabelTh,
        measurementKind: view.measurementKind,
        totalCount: view.measurementKind === "COUNT" ? view.normalizedCount : null,
        totalWeightGrams: view.measurementKind === "MASS" ? view.normalizedWeightGrams : null,
        totalWeightKilograms: view.measurementKind === "MASS" && view.normalizedWeightGrams !== null ? view.normalizedWeightGrams / 1000 : null,
        displayUnit,
        displayTh: "",
      });
    }
  }
  const result = [...groups.values()];
  for (const g of result) {
    g.displayTh = formatSeizedItemDisplayTh({
      categoryLabelTh: g.categoryLabelTh,
      measurementKind: g.measurementKind,
      normalizedCount: g.totalCount,
      normalizedWeightKilograms: g.totalWeightKilograms,
      displayUnit: g.displayUnit,
    });
  }
  return result;
}

/**
 * Composes the full performance summary from already-loaded rows. Every
 * count/date derivation reads directly off DrugCaseOfficer rows (Section 3:
 * "Use DrugCaseOfficer as the source of truth") — never infers anything
 * from DrugCasePerson or DrugPersonNetworkRole.
 */
export function composeOfficerDrugArrestPerformance(
  officerId: string,
  officerCaseRoles: RawOfficerCaseRole[],
  caseFactsById: Map<string, RawCaseFacts>
): OfficerDrugArrestPerformanceSummary {
  // Group role rows by case — an officer can have multiple DrugCaseOfficer
  // rows for the SAME case with different roles (Section 3).
  const rolesByCaseId = new Map<string, string[]>();
  for (const r of officerCaseRoles) {
    const list = rolesByCaseId.get(r.caseId) ?? [];
    list.push(r.role);
    rolesByCaseId.set(r.caseId, list);
  }

  let leadCases = 0;
  let arrestingOfficerCases = 0;
  let latestArrestDate: Date | null = null;
  const allSeizedItems: DrugSeizedItemAnalyticsFacts[] = [];

  const cases: OfficerDrugArrestCaseSummary[] = [];
  for (const [caseId, rawRoles] of rolesByCaseId) {
    const facts = caseFactsById.get(caseId);
    if (!facts) continue; // case row not found (e.g. deleted) — skip rather than crash

    const resolvedRoles = rawRoles.map(roleLabel).filter((r): r is NonNullable<typeof r> => r !== null);
    if (resolvedRoles.some((r) => r.role === "ARREST_TEAM_LEAD")) leadCases += 1;
    if (resolvedRoles.some((r) => r.role === "ARRESTING_OFFICER")) arrestingOfficerCases += 1;

    if (facts.arrestDate && (!latestArrestDate || facts.arrestDate > latestArrestDate)) {
      latestArrestDate = facts.arrestDate;
    }

    allSeizedItems.push(...facts.seizedItems);

    cases.push({
      caseId,
      caseNumber: facts.caseNumber,
      title: facts.title,
      status: facts.status,
      statusLabelTh: statusLabel(facts.status),
      arrestDate: facts.arrestDate,
      province: facts.province,
      district: facts.district,
      reportingUnitText: facts.reportingUnitText,
      leadUnitText: facts.leadUnitText,
      roles: resolvedRoles.map((r) => r.role),
      roleLabelsTh: resolvedRoles.map((r) => r.label),
      defendantCount: facts.defendantCount,
      seizedItems: groupSeizedItemFacts(facts.seizedItems),
    });
  }

  // Chronological, most recent first — cases with no arrestDate sort last
  // (never guessed into a position, matching this codebase's established
  // "unparseable/missing date sorts last, never fabricated" convention).
  cases.sort((a, b) => {
    if (a.arrestDate && b.arrestDate) return b.arrestDate.getTime() - a.arrestDate.getTime();
    if (a.arrestDate) return -1;
    if (b.arrestDate) return 1;
    return 0;
  });

  return {
    officerId,
    totalCases: cases.length,
    leadCases,
    arrestingOfficerCases,
    latestArrestDate,
    cases,
    aggregateSeizedItems: groupSeizedItemFacts(allSeizedItems),
  };
}
