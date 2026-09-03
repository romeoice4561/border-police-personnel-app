/**
 * DrugCommanderDashboardService (Phase 2B).
 *
 * Provides all data for the Commander Intelligence Dashboard. Each method
 * is bounded by the fiscal-year date range in the filter — no unbounded
 * scans. Aggregation is performed in TypeScript over the already-bounded
 * result set (DatabaseClient's ModelDelegate does not expose groupBy;
 * the FY window is ~12 months so in-memory grouping is safe).
 *
 * Two-pass pattern for cross-model data:
 *   1. Fetch matching DrugCase ids via count() / findMany() with caseWhere
 *   2. Fetch related rows (DrugCasePerson, DrugSeizedItem) by caseId
 *
 * The signals endpoint (getSignals) is global — alerts are not date-bounded
 * by arrestDate since alerts are generated at case-creation time and their
 * occurrenceCount accumulates independently of the FY filter.
 *
 * Pure I/O — no React, no HTTP.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { buildCommanderCaseWhere, type CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import { DRUG_CATEGORY_LABELS, type DrugCategory } from "@/lib/drug_intelligence/drug_seized_item_options";
import type {
  CommanderOverviewData,
  CommanderSeizuresData,
  CommanderSeizureItem,
  CommanderTrendData,
  CommanderAreasData,
  CommanderUnitsData,
  CommanderUnitRow,
  CommanderSignalsData,
  CommanderFilterMeta,
} from "@/lib/drug_intelligence/drug_commander_dashboard_types";

const ARRESTED_ROLES = ["ARRESTED_PERSON", "ACCUSED"] as const;
const REPEAT_SIGNAL_TYPES = ["REPEAT_PERSON", "REPEAT_PHONE", "REPEAT_SIM", "REPEAT_DEVICE", "REPEAT_VEHICLE"] as const;
const AREA_HARD_CAP = 10;
const UNIT_HARD_CAP = 20;
const SIGNAL_HARD_CAP = 10;

/** Converts a Prisma Decimal (or plain number / null) to a JS number. */
function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "object" && val !== null && "toNumber" in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return Number(val);
}

function serializeFilterMeta(filter: CommanderDashboardFilter): CommanderFilterMeta {
  return {
    arrestDateFrom: filter.arrestDateFrom.toISOString(),
    arrestDateTo: filter.arrestDateTo.toISOString(),
    fiscalYear: filter.fiscalYear,
    fiscalYearBe: filter.fiscalYearBe,
    displayFiscalYearTh: filter.displayFiscalYearTh,
    reportingHeadquartersId: filter.reportingHeadquartersId,
    reportingRegionId: filter.reportingRegionId,
    reportingBattalionId: filter.reportingBattalionId,
    reportingCompanyId: filter.reportingCompanyId,
    province: filter.province,
    status: filter.status,
  };
}

export class DrugCommanderDashboardService {
  constructor(private readonly db: DatabaseClient) {}

  // ── Overview ────────────────────────────────────────────────────────────

  async getOverview(filter: CommanderDashboardFilter): Promise<CommanderOverviewData> {
    const caseWhere = buildCommanderCaseWhere(filter);

    // Case count — direct count() with bounded WHERE
    const caseCount = await this.db.drugCase.count({ where: caseWhere });

    // Arrested persons — get case IDs, then find persons with arrested roles
    const cases = await this.db.drugCase.findMany({
      where: caseWhere,
      select: { id: true },
    });
    const caseIds = (cases as Array<{ id: string }>).map((c) => c.id);

    let arrestedPersonCount = 0;
    if (caseIds.length > 0) {
      const personRows = await this.db.drugCasePerson.findMany({
        where: {
          caseId: { in: caseIds },
          role: { in: ARRESTED_ROLES as unknown as string[] },
        },
        select: { personId: true },
      });
      arrestedPersonCount = new Set((personRows as Array<{ personId: string }>).map((r) => r.personId)).size;
    }

    // New alerts — global (not date-bounded)
    const newAlertsCount = await this.db.drugIntelligenceAlert.count({
      where: { status: "NEW" },
    });

    // Pending duplicates — global
    const pendingDuplicatesCount = await this.db.drugIntelligenceAlert.count({
      where: { alertType: "HIGH_CONFIDENCE_DUPLICATE", status: "NEW" },
    });

    return {
      caseCount,
      arrestedPersonCount,
      newAlertsCount,
      pendingDuplicatesCount,
      filter: serializeFilterMeta(filter),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Seizures ─────────────────────────────────────────────────────────────

  async getSeizures(filter: CommanderDashboardFilter): Promise<CommanderSeizuresData> {
    const caseWhere = buildCommanderCaseWhere(filter);

    // Two-pass: get matching case IDs, then get seized items for those cases
    const cases = await this.db.drugCase.findMany({ where: caseWhere, select: { id: true } });
    const caseIds = (cases as Array<{ id: string }>).map((c) => c.id);

    if (caseIds.length === 0) {
      return { items: [], filter: serializeFilterMeta(filter), generatedAt: new Date().toISOString() };
    }

    const seizedItems = await this.db.drugSeizedItem.findMany({
      where: { caseId: { in: caseIds } },
    });

    // Group by (drugCategory, measurementKind) — NEVER mix COUNT + MASS
    type GroupKey = string;
    const groups = new Map<GroupKey, {
      drugCategory: string;
      measurementKind: string;
      totalQuantity: number;
      totalWeightGrams: number;
      sampleUnit: string | null;
    }>();

    for (const item of seizedItems as Array<Record<string, unknown>>) {
      const cat = String(item.drugCategory ?? "OTHER");
      const kind = String(item.measurementKind ?? "COUNT");
      const key: GroupKey = `${cat}::${kind}`;

      const existing = groups.get(key);
      if (existing) {
        if (kind === "COUNT") {
          existing.totalQuantity += toNum(item.quantity);
        } else {
          existing.totalWeightGrams += toNum(item.weightGrams);
        }
      } else {
        groups.set(key, {
          drugCategory: cat,
          measurementKind: kind,
          totalQuantity: kind === "COUNT" ? toNum(item.quantity) : 0,
          totalWeightGrams: kind === "MASS" ? toNum(item.weightGrams) : 0,
          sampleUnit: kind === "COUNT" ? (typeof item.unit === "string" ? item.unit : null) : null,
        });
      }
    }

    const items: CommanderSeizureItem[] = [];
    for (const [, g] of groups) {
      const labelTh = DRUG_CATEGORY_LABELS[g.drugCategory as DrugCategory]?.labelTh ?? g.drugCategory;
      if (g.measurementKind === "COUNT") {
        items.push({
          drugCategory: g.drugCategory,
          labelTh,
          measurementKind: "COUNT",
          totalQuantity: g.totalQuantity,
          totalWeightGrams: null,
          totalWeightKg: null,
          displayUnit: g.sampleUnit,
        });
      } else {
        items.push({
          drugCategory: g.drugCategory,
          labelTh,
          measurementKind: "MASS",
          totalQuantity: null,
          totalWeightGrams: g.totalWeightGrams,
          totalWeightKg: g.totalWeightGrams / 1000,
          displayUnit: null,
        });
      }
    }

    // Sort by drug category (standard order), then by measurementKind
    const categoryOrder = ["METHAMPHETAMINE_TABLET", "CRYSTAL_METHAMPHETAMINE", "HEROIN", "KETAMINE", "MDMA", "COCAINE", "OPIUM", "CANNABIS", "OTHER"];
    items.sort((a, b) => {
      const ai = categoryOrder.indexOf(a.drugCategory);
      const bi = categoryOrder.indexOf(b.drugCategory);
      if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.measurementKind.localeCompare(b.measurementKind);
    });

    return { items, filter: serializeFilterMeta(filter), generatedAt: new Date().toISOString() };
  }

  // ── Trend ──────────────────────────────────────────────────────────────

  async getTrend(filter: CommanderDashboardFilter): Promise<CommanderTrendData> {
    const caseWhere = buildCommanderCaseWhere(filter);

    const cases = await this.db.drugCase.findMany({
      where: caseWhere,
      select: { arrestDate: true },
    });

    const bucketMap = new Map<string, { month: number; year: number; caseCount: number }>();

    for (const c of cases as Array<{ arrestDate: Date | null }>) {
      if (!c.arrestDate) continue;
      const d = c.arrestDate instanceof Date ? c.arrestDate : new Date(c.arrestDate);
      if (Number.isNaN(d.getTime())) continue;
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const existing = bucketMap.get(monthKey);
      if (existing) {
        existing.caseCount += 1;
      } else {
        bucketMap.set(monthKey, { month, year, caseCount: 1 });
      }
    }

    const filled: CommanderTrendData["buckets"] = [];
    const cursor = new Date(Date.UTC(filter.arrestDateFrom.getUTCFullYear(), filter.arrestDateFrom.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(filter.arrestDateTo.getUTCFullYear(), filter.arrestDateTo.getUTCMonth(), 1));
    while (cursor <= endMonth) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const existing = bucketMap.get(monthKey);
      filled.push({ monthKey, month, year, caseCount: existing?.caseCount ?? 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return {
      buckets: filled,
      totalCases: (cases as unknown[]).length,
      filter: serializeFilterMeta(filter),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Areas ──────────────────────────────────────────────────────────────

  async getAreas(filter: CommanderDashboardFilter): Promise<CommanderAreasData> {
    const caseWhere = buildCommanderCaseWhere(filter);

    const cases = await this.db.drugCase.findMany({
      where: caseWhere,
      select: { province: true },
    });

    // Group by province in TypeScript, excluding null
    const provinceMap = new Map<string, number>();
    for (const c of cases as Array<{ province: string | null }>) {
      if (!c.province) continue;
      provinceMap.set(c.province, (provinceMap.get(c.province) ?? 0) + 1);
    }

    // Sort by case count desc, take top 10
    const rows = [...provinceMap.entries()]
      .map(([province, caseCount]) => ({ province, caseCount }))
      .sort((a, b) => b.caseCount - a.caseCount || a.province.localeCompare(b.province, "th"))
      .slice(0, AREA_HARD_CAP);

    return { rows, filter: serializeFilterMeta(filter), generatedAt: new Date().toISOString() };
  }

  // ── Units ──────────────────────────────────────────────────────────────

  async getUnits(filter: CommanderDashboardFilter): Promise<CommanderUnitsData> {
    const caseWhere = buildCommanderCaseWhere(filter);

    // Determine grouping level based on filter specificity
    let groupField: string;
    let groupBy: string;
    if (filter.reportingBattalionId !== undefined) {
      groupField = "companyId";
      groupBy = "company";
    } else if (filter.reportingRegionId !== undefined) {
      groupField = "battalionId";
      groupBy = "battalion";
    } else if (filter.reportingHeadquartersId !== undefined) {
      groupField = "regionId";
      groupBy = "region";
    } else {
      groupField = "battalionId";
      groupBy = "battalion";
    }

    const cases = await this.db.drugCase.findMany({
      where: caseWhere,
      select: { id: true, [groupField]: true },
    });

    if (cases.length === 0) {
      return { rows: [], groupBy, filter: serializeFilterMeta(filter), generatedAt: new Date().toISOString() };
    }

    const allCaseIds = (cases as Array<{ id: string }>).map((c) => c.id);

    // Group cases by the org field
    const unitCaseMap = new Map<string, string[]>(); // unitKey → caseIds
    for (const c of cases as Array<Record<string, unknown>>) {
      const unitVal = c[groupField];
      const unitKey = unitVal !== null && unitVal !== undefined ? String(unitVal) : "__null__";
      const existing = unitCaseMap.get(unitKey);
      if (existing) {
        existing.push(String(c.id));
      } else {
        unitCaseMap.set(unitKey, [String(c.id)]);
      }
    }

    // Fetch arrested persons and seized items for all cases in one pass
    const personRows = await this.db.drugCasePerson.findMany({
      where: {
        caseId: { in: allCaseIds },
        role: { in: ARRESTED_ROLES as unknown as string[] },
      },
      select: { caseId: true, personId: true },
    });

    const seizedRows = await this.db.drugSeizedItem.findMany({
      where: { caseId: { in: allCaseIds } },
      select: { caseId: true, drugCategory: true, measurementKind: true, quantity: true, weightGrams: true },
    });

    // Build lookup maps: caseId → personIds, caseId → seizedItems
    const personsByCaseId = new Map<string, Set<string>>();
    for (const p of personRows as Array<{ caseId: string; personId: string }>) {
      const existing = personsByCaseId.get(p.caseId);
      if (existing) {
        existing.add(p.personId);
      } else {
        personsByCaseId.set(p.caseId, new Set([p.personId]));
      }
    }

    const seizedByCaseId = new Map<string, Array<{ drugCategory: string; measurementKind: string; quantity: unknown; weightGrams: unknown }>>();
    for (const s of seizedRows as Array<{ caseId: string; drugCategory: string; measurementKind: string; quantity: unknown; weightGrams: unknown }>) {
      const existing = seizedByCaseId.get(s.caseId);
      if (existing) {
        existing.push(s);
      } else {
        seizedByCaseId.set(s.caseId, [s]);
      }
    }

    // Build unit rows
    const unitRows: CommanderUnitRow[] = [];
    for (const [unitKey, unitCaseIds] of unitCaseMap) {
      const arrestedPersonIds = new Set<string>();
      let methTabletCount = 0;
      let iceCrystalGrams = 0;
      let hasMeth = false;
      let hasIce = false;

      for (const caseId of unitCaseIds) {
        const persons = personsByCaseId.get(caseId);
        if (persons) {
          for (const pid of persons) arrestedPersonIds.add(pid);
        }
        const seized = seizedByCaseId.get(caseId);
        if (seized) {
          for (const s of seized) {
            if (s.drugCategory === "METHAMPHETAMINE_TABLET" && s.measurementKind === "COUNT") {
              methTabletCount += toNum(s.quantity);
              hasMeth = true;
            }
            if (s.drugCategory === "CRYSTAL_METHAMPHETAMINE" && s.measurementKind === "MASS") {
              iceCrystalGrams += toNum(s.weightGrams);
              hasIce = true;
            }
          }
        }
      }

      const unitIdNum = unitKey === "__null__" ? null : parseInt(unitKey, 10);
      const unitLabel = unitKey === "__null__" ? "ไม่ระบุ" : `${groupBy === "battalion" ? "กก." : groupBy === "company" ? "หมว." : groupBy === "region" ? "ภาค " : ""}${unitKey}`;

      unitRows.push({
        unitId: unitIdNum,
        unitLabel,
        caseCount: unitCaseIds.length,
        arrestedPersonCount: arrestedPersonIds.size,
        methTabletCount: hasMeth ? methTabletCount : null,
        iceCrystalKg: hasIce ? iceCrystalGrams / 1000 : null,
      });
    }

    const namedRows = unitRows.filter((row) => row.unitId !== null);
    namedRows.sort((a, b) => b.caseCount - a.caseCount || a.unitLabel.localeCompare(b.unitLabel, "th"));
    return {
      rows: namedRows.slice(0, UNIT_HARD_CAP),
      groupBy,
      filter: serializeFilterMeta(filter),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Signals ────────────────────────────────────────────────────────────

  async getSignals(): Promise<CommanderSignalsData> {
    // Count per alert type (small table, fast — not date-bounded)
    const signalCounts = await Promise.all(
      REPEAT_SIGNAL_TYPES.map(async (alertType) => {
        const count = await this.db.drugIntelligenceAlert.count({
          where: { alertType, status: "NEW" },
        });
        return { alertType, count };
      })
    );

    const totalNewAlerts = signalCounts.reduce((sum, s) => sum + s.count, 0);

    // Top 5 recent NEW alerts (any type)
    const recentAlerts = await this.db.drugIntelligenceAlert.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "desc" },
      take: SIGNAL_HARD_CAP,
    });

    const topSignals = (recentAlerts as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id),
      alertType: String(a.alertType),
      severity: String(a.severity),
      entityType: String(a.entityType),
      entityId: String(a.entityId),
      title: String(a.title),
      occurrenceCount: typeof a.occurrenceCount === "number" ? a.occurrenceCount : Number(a.occurrenceCount ?? 1),
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    }));

    return { signalCounts, topSignals, totalNewAlerts, generatedAt: new Date().toISOString() };
  }
}
