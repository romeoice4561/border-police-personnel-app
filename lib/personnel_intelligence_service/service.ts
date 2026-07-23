/**
 * PersonnelIntelligenceService — application-facing facade (Phase 49.5).
 *
 * Composes existing Commander dataset / CIC / report builders only.
 * Pure relative to engines — no Prisma, no engine recalculation.
 */
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { buildCommanderBrief } from "@/lib/commander_reports/build_brief";
import { buildExecutiveReport } from "@/lib/commander_reports/build_report";
import type { PersonnelIntelligenceServiceContext } from "@/lib/personnel_intelligence_service/context";
import { PersonnelIntelligenceError } from "@/lib/personnel_intelligence_service/errors";
import {
  applyIntelligenceFilters,
  daysUntilNextBirthday,
  isReadyForPromotion,
  normalizeIntelligenceQuery,
  toReportFilterState,
} from "@/lib/personnel_intelligence_service/filters";
import {
  assertCapability,
  assertCanViewOfficer,
  assertScopeAllowed,
} from "@/lib/personnel_intelligence_service/permissions";
import { paginateOfficers, sortOfficers } from "@/lib/personnel_intelligence_service/queries";
import {
  assertNoSensitiveKeys,
  serializeFilterOptions,
  serializeOfficerDetail,
  serializeOfficerSummary,
} from "@/lib/personnel_intelligence_service/serializers";
import type {
  CommanderSummaryDto,
  DocumentSummaryDto,
  ExecutiveBriefDto,
  GetReportProjectionInput,
  OfficerIntelligenceDetailDto,
  OfficerSearchResultDto,
  PersonnelIntelligenceQuery,
  PromotionSummaryDto,
  ReportProjectionDto,
  RetirementSummaryDto,
  TrainingSummaryDto,
} from "@/lib/personnel_intelligence_service/types";

export interface PersonnelIntelligenceService {
  getCommanderSummary(input?: PersonnelIntelligenceQuery): CommanderSummaryDto;
  searchOfficers(input?: PersonnelIntelligenceQuery): OfficerSearchResultDto;
  getOfficerIntelligence(officerId: string): OfficerIntelligenceDetailDto;
  getPromotionSummary(input?: PersonnelIntelligenceQuery): PromotionSummaryDto;
  getRetirementSummary(input?: PersonnelIntelligenceQuery): RetirementSummaryDto;
  getDocumentSummary(input?: PersonnelIntelligenceQuery): DocumentSummaryDto;
  getTrainingSummary(input?: PersonnelIntelligenceQuery): TrainingSummaryDto;
  getExecutiveBrief(input?: PersonnelIntelligenceQuery): ExecutiveBriefDto;
  getReportProjection(input: GetReportProjectionInput): ReportProjectionDto;
  /** Test/observability: the request-scoped context id. */
  getContextId(): string;
}

function parseAsOf(asOf: string | undefined, fallback: Date): Date {
  if (!asOf) return fallback;
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) {
    throw new PersonnelIntelligenceError("INVALID_QUERY", "Invalid asOf");
  }
  return d;
}

/** Accepts either a structured query or flat query-string style record. */
function coerceQuery(
  input: PersonnelIntelligenceQuery | Record<string, unknown> = {}
): ReturnType<typeof normalizeIntelligenceQuery> {
  if (input && typeof input === "object" && ("filters" in input || "scope" in input)) {
    const q = input as PersonnelIntelligenceQuery;
    return normalizeIntelligenceQuery({
      ...(q.scope ?? {}),
      ...(q.filters ?? {}),
      page: q.page,
      pageSize: q.pageSize,
      sort: q.sort,
      order: q.order,
      asOf: q.asOf,
    });
  }
  return normalizeIntelligenceQuery(input as Record<string, unknown>);
}

function filteredOfficers(
  ctx: PersonnelIntelligenceServiceContext,
  query: ReturnType<typeof normalizeIntelligenceQuery>
) {
  assertScopeAllowed(ctx.authorizedScope, query.scope ?? {});
  const asOf = parseAsOf(query.asOf, ctx.asOf);
  return {
    asOf,
    officers: applyIntelligenceFilters(ctx.dataset.officers, query.scope, query.filters, asOf),
  };
}

export function createPersonnelIntelligenceService(
  ctx: PersonnelIntelligenceServiceContext
): PersonnelIntelligenceService {
  return {
    getContextId: () => ctx.contextId,

    getCommanderSummary(input = {}) {
      assertCapability(ctx.actor, "intelligence.summary.view");
      const query = coerceQuery(input);
      const { asOf, officers } = filteredOfficers(ctx, query);
      const fy = computeFiscalYearSummary(asOf);
      const center = ctx.center;
      const kpiMap = Object.fromEntries(center.kpis.map((k) => [k.id, k.value]));

      // When filters/scope are empty, prefer CIC KPI totals (same dataset composition).
      const unfiltered =
        !query.scope?.regionId &&
        !query.scope?.battalionId &&
        !query.scope?.companyId &&
        Object.keys(query.filters ?? {}).length === 0;

      const promotionReady = unfiltered
        ? (kpiMap.readyForPromotion ?? officers.filter(isReadyForPromotion).length)
        : officers.filter(isReadyForPromotion).length;
      const promotionOverdue = officers.filter(
        (o) => o.promotionIntelligence.overdueYears != null && o.promotionIntelligence.overdueYears > 0
      ).length;
      const year = asOf.getUTCFullYear();
      const retiringWithin12Months = officers.filter(
        (o) => o.retirementYear != null && o.retirementYear - year <= 1
      ).length;
      const documentsMissing = officers.filter((o) => o.documentIntelligence.missingRequiredCount > 0).length;
      const documentsExpired = officers.filter((o) => o.documentIntelligence.expiredCount > 0).length;
      const trainingMissing = officers.filter((o) => o.trainingIntelligence.trainingStatus === "MissingRequired").length;
      const profileIncomplete = officers.filter((o) => (o.profileCompletenessPercent ?? 100) < 100).length;
      const criticalOfficers = officers.filter((o) => o.priority === "critical").length;
      const highPriorityOfficers = officers.filter((o) => o.priority === "high" || o.priority === "critical").length;
      const aiReady = officers.filter((o) => o.documentIntelligence.readinessLevel === "READY").length;
      const upcomingBirthdays30 = officers.filter(
        (o) => o.dateOfBirth != null && daysUntilNextBirthday(o.dateOfBirth, asOf) <= 30
      ).length;

      const dto: CommanderSummaryDto = {
        asOfIso: asOf.toISOString(),
        fiscalYearBe: fy.fiscalYearBe,
        displayFiscalYearTh: fy.displayFiscalYearTh,
        personnelTotal: officers.length,
        promotionReady,
        promotionOverdue,
        retiringWithin12Months,
        documentsMissing,
        documentsExpired,
        trainingMissing,
        profileIncomplete,
        criticalOfficers,
        highPriorityOfficers,
        aiReady,
        upcomingBirthdays30,
        kpis: [
          { id: "personnel", labelTh: "กำลังพลทั้งหมด", value: officers.length },
          { id: "readyForPromotion", labelTh: "พร้อมเลื่อนตำแหน่ง", value: promotionReady },
          { id: "promotionOverdue", labelTh: "ค้างการเลื่อนตำแหน่ง", value: promotionOverdue },
          { id: "retiringWithin12Months", labelTh: "ใกล้เกษียณภายใน 12 เดือน", value: retiringWithin12Months },
          { id: "documentsMissing", labelTh: "เอกสารที่ขาด", value: documentsMissing },
          { id: "expiredDocuments", labelTh: "เอกสารหมดอายุ", value: documentsExpired },
          { id: "trainingMissing", labelTh: "ขาดการฝึกอบรม", value: trainingMissing },
          { id: "criticalOfficers", labelTh: "กำลังพลระดับวิกฤต", value: criticalOfficers },
          { id: "aiReady", labelTh: "พร้อมด้วยข่าวกรอง AI", value: aiReady },
        ],
        filterOptions: serializeFilterOptions(ctx.dataset.options),
      };
      assertNoSensitiveKeys(dto);
      return dto;
    },

    searchOfficers(input = {}) {
      assertCapability(ctx.actor, "intelligence.officers.search");
      const query = coerceQuery(input);
      const { officers } = filteredOfficers(ctx, query);
      const sorted = sortOfficers(officers, query.sort, query.order);
      const { pageItems, pagination } = paginateOfficers(sorted, query.page, query.pageSize);
      const dto: OfficerSearchResultDto = {
        filters: { ...(query.scope ?? {}), ...(query.filters ?? {}) },
        pagination,
        officers: pageItems.map(serializeOfficerSummary),
        aggregate: {
          total: officers.length,
          criticalOfficers: officers.filter((o) => o.priority === "critical").length,
          readyForPromotion: officers.filter(isReadyForPromotion).length,
          documentsExpired: officers.filter((o) => o.documentIntelligence.expiredCount > 0).length,
        },
      };
      assertNoSensitiveKeys(dto);
      return dto;
    },

    getOfficerIntelligence(officerId: string) {
      assertCapability(ctx.actor, "intelligence.officer.view");
      const id = officerId.trim();
      if (!id) throw new PersonnelIntelligenceError("INVALID_QUERY", "officerId is required");
      assertCanViewOfficer(ctx.actor, id);
      const officer = ctx.dataset.officers.find((o) => o.officerId === id);
      if (!officer) throw new PersonnelIntelligenceError("OFFICER_NOT_FOUND", `Officer '${id}' not found`);
      const dto = serializeOfficerDetail(officer);
      assertNoSensitiveKeys(dto);
      return dto;
    },

    getPromotionSummary(input = {}) {
      assertCapability(ctx.actor, "intelligence.summary.view");
      const query = coerceQuery(input);
      const { asOf, officers } = filteredOfficers(ctx, query);
      const byStatusMap = new Map<string, number>();
      for (const o of officers) {
        const key = o.promotionIntelligence.promotionStatus;
        byStatusMap.set(key, (byStatusMap.get(key) ?? 0) + 1);
      }
      const dto: PromotionSummaryDto = {
        asOfIso: asOf.toISOString(),
        readyCount: officers.filter(isReadyForPromotion).length,
        overdueCount: officers.filter(
          (o) => o.promotionIntelligence.overdueYears != null && o.promotionIntelligence.overdueYears > 0
        ).length,
        byStatus: [...byStatusMap.entries()].map(([id, value]) => ({ id, labelTh: id, value })),
      };
      assertNoSensitiveKeys(dto);
      return dto;
    },

    getRetirementSummary(input = {}) {
      assertCapability(ctx.actor, "intelligence.summary.view");
      const query = coerceQuery(input);
      const { asOf, officers } = filteredOfficers(ctx, query);
      const year = asOf.getUTCFullYear();
      const dto: RetirementSummaryDto = {
        asOfIso: asOf.toISOString(),
        within12Months: officers.filter((o) => o.retirementYear != null && o.retirementYear - year <= 1).length,
        within3Years: officers.filter((o) => o.retirementYear != null && o.retirementYear - year <= 3).length,
        within5Years: officers.filter((o) => o.retirementYear != null && o.retirementYear - year <= 5).length,
      };
      assertNoSensitiveKeys(dto);
      return dto;
    },

    getDocumentSummary(input = {}) {
      assertCapability(ctx.actor, "intelligence.summary.view");
      const query = coerceQuery(input);
      const { asOf, officers } = filteredOfficers(ctx, query);
      const dto: DocumentSummaryDto = {
        asOfIso: asOf.toISOString(),
        missingRequiredOfficers: officers.filter((o) => o.documentIntelligence.missingRequiredCount > 0).length,
        expiredOfficers: officers.filter((o) => o.documentIntelligence.expiredCount > 0).length,
        readyOfficers: officers.filter((o) => o.documentIntelligence.readinessLevel === "READY").length,
      };
      assertNoSensitiveKeys(dto);
      return dto;
    },

    getTrainingSummary(input = {}) {
      assertCapability(ctx.actor, "intelligence.summary.view");
      const query = coerceQuery(input);
      const { asOf, officers } = filteredOfficers(ctx, query);
      const dto: TrainingSummaryDto = {
        asOfIso: asOf.toISOString(),
        missingRequired: officers.filter((o) => o.trainingIntelligence.trainingStatus === "MissingRequired").length,
        expired: officers.filter((o) => o.trainingIntelligence.trainingStatus === "Expired").length,
        expiringSoon: officers.filter((o) => o.trainingIntelligence.trainingStatus === "ExpiringSoon").length,
      };
      assertNoSensitiveKeys(dto);
      return dto;
    },

    getExecutiveBrief(input = {}) {
      assertCapability(ctx.actor, "intelligence.summary.view");
      const query = coerceQuery(input);
      const { asOf, officers } = filteredOfficers(ctx, query);
      const brief = buildCommanderBrief(officers, asOf);
      const dto: ExecutiveBriefDto = {
        asOfIso: asOf.toISOString(),
        ...brief,
      };
      assertNoSensitiveKeys(dto);
      return dto;
    },

    getReportProjection(input) {
      assertCapability(ctx.actor, "intelligence.reports.view");
      const asOf = parseAsOf(input.asOf, ctx.asOf);
      assertScopeAllowed(ctx.authorizedScope, input.scope ?? {});
      const reportFilters = {
        ...toReportFilterState(input.scope, undefined),
        ...(input.reportFilters ?? {}),
      };
      const report = buildExecutiveReport({
        type: input.type,
        officers: ctx.dataset.officers,
        options: ctx.dataset.options,
        filters: reportFilters,
        asOf,
        preparedByTh: input.preparedByTh ?? ctx.actor.displayName,
      });
      const dto: ReportProjectionDto = {
        type: report.type,
        titleTh: report.cover.titleTh,
        resultCount: report.resultCount,
        filterSummaryTh: report.filterSummaryTh,
        kpiLabelsTh: report.kpis.map((k) => `${k.labelTh}: ${k.value}`),
        recommendationTextsTh: report.recommendations.map((r) => r.textTh),
        generatedDateTh: report.cover.generatedDateTh,
        reportVersion: report.cover.reportVersion,
      };
      assertNoSensitiveKeys(dto);
      return dto;
    },
  };
}
