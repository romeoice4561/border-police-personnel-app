/**
 * Executive report composer (Phase 49C).
 *
 * Filters + projects the already-loaded CommanderQueryOfficer set into a
 * presentation-ready view model. Never calls intelligence engines.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { buildOfficerProfileUrl } from "@/lib/integration/navigation/drilldown_contract";
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { toBuddhistEraYear } from "@/lib/intelligence/shared/thai_date";
import { applyReportFilters, describeReportFiltersTh } from "@/lib/commander_reports/apply_filters";
import { buildCommanderBrief } from "@/lib/commander_reports/build_brief";
import { getReportCatalogEntry, resolveReportType } from "@/lib/commander_reports/report_catalog";
import {
  CONFIDENTIAL_FOOTER_TH,
  REPORT_VERSION,
  type BuildExecutiveReportInput,
  type ExecutiveReportType,
  type ExecutiveReportViewModel,
  type ReportFilterState,
  type ReportKpiSnapshot,
  type ReportRecommendation,
  type ReportTableColumn,
  type ReportTableRow,
} from "@/lib/commander_reports/types";

const PRIORITY_TH: Record<string, string> = {
  critical: "เร่งด่วน",
  high: "สูง",
  medium: "ปานกลาง",
  low: "ต่ำ",
};

function daysUntilNextBirthday(dob: Date, asOf: Date): number | null {
  const asOfUtc = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  let next = new Date(Date.UTC(asOfUtc.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
  if (next.getTime() < asOfUtc.getTime()) {
    next = new Date(Date.UTC(asOfUtc.getUTCFullYear() + 1, dob.getUTCMonth(), dob.getUTCDate()));
  }
  return Math.round((next.getTime() - asOfUtc.getTime()) / 86_400_000);
}

function formatBirthdayTh(dob: Date): string {
  const day = dob.getUTCDate();
  const month = dob.getUTCMonth() + 1;
  const yearBe = toBuddhistEraYear(dob.getUTCFullYear());
  return `${day}/${month}/${yearBe}`;
}

function projectOfficers(
  type: ExecutiveReportType,
  officers: readonly CommanderQueryOfficer[],
  asOf: Date,
  filters: ReportFilterState
): CommanderQueryOfficer[] {
  switch (type) {
    case "personnelSummary":
    case "monthlyBrief":
      return [...officers];
    case "promotionReadiness":
      return officers.filter(
        (o) =>
          o.nextLevelEligibility?.eligibleNow === true ||
          o.promotionIntelligence.promotionStatus === "EligibleThisYear" ||
          o.promotionIntelligence.promotionStatus === "AlreadyEligible" ||
          (o.promotionIntelligence.overdueYears != null && o.promotionIntelligence.overdueYears > 0)
      );
    case "retirementForecast": {
      const year = asOf.getUTCFullYear();
      return officers.filter((o) => {
        if (o.retirementYear == null) return false;
        if (filters.fiscalYear != null) return o.retirementYear === filters.fiscalYear;
        return o.retirementYear - year <= 5;
      });
    }
    case "documentCompleteness":
      return officers.filter((o) => o.documentIntelligence.missingRequiredCount > 0);
    case "documentExpiry":
      return officers.filter(
        (o) =>
          o.documentIntelligence.expiredCount > 0 ||
          o.documentExpiryInfo.some((i) => i.status === "expiring_soon" || i.status === "expired")
      );
    case "trainingReadiness":
      return officers.filter((o) => {
        const s = o.trainingIntelligence.trainingStatus;
        return s === "MissingRequired" || s === "Expired" || s === "ExpiringSoon" || s === "Unverified";
      });
    case "highPriority":
      return officers.filter((o) => o.priority === "high" || o.priority === "critical");
    case "criticalAction":
      return officers.filter(
        (o) =>
          o.priority === "critical" ||
          o.documentIntelligence.expiredCount > 0 ||
          o.documentIntelligence.missingRequiredCount > 0 ||
          o.trainingIntelligence.trainingStatus === "MissingRequired" ||
          o.flagCodes.includes("PROFILE_INCOMPLETE")
      );
    case "birthday":
      return officers
        .filter((o) => o.dateOfBirth != null)
        .filter((o) => {
          const days = daysUntilNextBirthday(o.dateOfBirth!, asOf);
          return days != null && days <= 90;
        })
        .sort((a, b) => (daysUntilNextBirthday(a.dateOfBirth!, asOf) ?? 999) - (daysUntilNextBirthday(b.dateOfBirth!, asOf) ?? 999));
    default:
      return [...officers];
  }
}

function buildColumns(type: ExecutiveReportType): ReportTableColumn[] {
  const base: ReportTableColumn[] = [
    { id: "officer", labelTh: "ยศ ชื่อ–สกุล" },
    { id: "unit", labelTh: "หน่วย" },
    { id: "position", labelTh: "ตำแหน่ง" },
  ];
  switch (type) {
    case "promotionReadiness":
      return [...base, { id: "promotion", labelTh: "สถานะเลื่อนตำแหน่ง" }, { id: "priority", labelTh: "ความสำคัญ" }];
    case "retirementForecast":
      return [...base, { id: "retirement", labelTh: "ปีเกษียณ" }, { id: "age", labelTh: "อายุ" }];
    case "documentCompleteness":
      return [...base, { id: "readiness", labelTh: "ความพร้อมเอกสาร" }, { id: "missing", labelTh: "เอกสารที่ขาด" }, { id: "action", labelTh: "การดำเนินการ" }];
    case "documentExpiry":
      return [...base, { id: "expired", labelTh: "หมดอายุ" }, { id: "readiness", labelTh: "ความพร้อม" }, { id: "action", labelTh: "การดำเนินการ" }];
    case "trainingReadiness":
      return [...base, { id: "training", labelTh: "สถานะการฝึกอบรม" }, { id: "priority", labelTh: "ความสำคัญ" }];
    case "highPriority":
    case "criticalAction":
      return [...base, { id: "priority", labelTh: "ความสำคัญ" }, { id: "action", labelTh: "การดำเนินการ" }, { id: "readiness", labelTh: "เอกสาร" }];
    case "birthday":
      return [...base, { id: "birthday", labelTh: "วันเกิด" }, { id: "daysUntil", labelTh: "อีก (วัน)" }];
    default:
      return [
        ...base,
        { id: "promotion", labelTh: "เลื่อนตำแหน่ง" },
        { id: "retirement", labelTh: "เกษียณ" },
        { id: "readiness", labelTh: "เอกสาร" },
        { id: "training", labelTh: "ฝึกอบรม" },
        { id: "priority", labelTh: "ความสำคัญ" },
      ];
  }
}

function buildRow(type: ExecutiveReportType, officer: CommanderQueryOfficer, asOf: Date): ReportTableRow {
  const cells: Record<string, string> = {
    officer: `${officer.rank ? `${officer.rank} ` : ""}${officer.displayName}`,
    unit: officer.currentUnit ?? "—",
    position: officer.currentPosition ?? "—",
    promotion: officer.promotionIntelligence.displayStatusTh ?? officer.promotionStatus,
    retirement: officer.retirementYearBe != null ? `พ.ศ. ${officer.retirementYearBe}` : "—",
    age: officer.displayAgeYearsMonthsTh ?? (officer.ageYears != null ? `${officer.ageYears} ปี` : "—"),
    readiness: officer.documentIntelligence.readinessLevel,
    missing: officer.documentIntelligence.missingRequiredCount > 0 ? String(officer.documentIntelligence.missingRequiredCount) : "—",
    expired: officer.documentIntelligence.expiredCount > 0 ? String(officer.documentIntelligence.expiredCount) : "—",
    training: officer.trainingIntelligence.displayStatusTh ?? officer.trainingIntelligence.trainingStatus,
    priority: PRIORITY_TH[officer.priority] ?? officer.priority,
    action: officer.documentIntelligence.primaryActionLabelTh || "—",
    birthday: officer.dateOfBirth ? formatBirthdayTh(officer.dateOfBirth) : "—",
    daysUntil: officer.dateOfBirth != null ? String(daysUntilNextBirthday(officer.dateOfBirth, asOf) ?? "—") : "—",
  };
  return { officerId: officer.officerId, cells, href: buildOfficerProfileUrl(officer.officerId) };
}

function buildKpis(type: ExecutiveReportType, scoped: readonly CommanderQueryOfficer[], filtered: readonly CommanderQueryOfficer[], asOf: Date): ReportKpiSnapshot[] {
  const brief = buildCommanderBrief(filtered, asOf);
  if (type === "monthlyBrief" || type === "personnelSummary") {
    return [
      { id: "total", labelTh: "กำลังพลทั้งหมด", value: brief.totalPersonnel },
      { id: "promo", labelTh: "ครบคุณสมบัติเลื่อนตำแหน่ง", value: brief.readyForPromotion },
      { id: "retire", labelTh: "เกษียณภายใน 12 เดือน", value: brief.retiringWithin12Months },
      { id: "expired", labelTh: "เอกสารหมดอายุ", value: brief.expiredDocuments },
      { id: "training", labelTh: "ขาดการฝึกอบรม", value: brief.missingTraining },
      { id: "critical", labelTh: "Critical Officers", value: brief.criticalOfficers },
      { id: "ai", labelTh: "พร้อม AI", value: brief.aiReady },
    ];
  }
  return [
    { id: "scoped", labelTh: "รายการในรายงาน", value: scoped.length },
    { id: "scopeTotal", labelTh: "กำลังพลในขอบเขตตัวกรอง", value: filtered.length },
    { id: "critical", labelTh: "Critical ในขอบเขต", value: filtered.filter((o) => o.priority === "critical").length },
  ];
}

function buildRecommendations(type: ExecutiveReportType, scoped: readonly CommanderQueryOfficer[], filtered: readonly CommanderQueryOfficer[], asOf: Date): ReportRecommendation[] {
  const brief = buildCommanderBrief(filtered, asOf);
  const out: ReportRecommendation[] = [];

  if (scoped.length === 0) {
    out.push({ textTh: "ไม่มีรายการตามเงื่อนไขรายงานในขอบเขตที่เลือก — ไม่ต้องดำเนินการเพิ่มเติม", severity: "info" });
    return out;
  }

  if (type === "promotionReadiness" && brief.readyForPromotion > 0) {
    out.push({
      textTh: `ควรพิจารณาเลื่อนตำแหน่งผู้ครบคุณสมบัติ ${brief.readyForPromotion.toLocaleString("th-TH")} นาย ตามลำดับความสำคัญ`,
      severity: brief.readyForPromotion >= 10 ? "warning" : "info",
    });
  }
  if (type === "retirementForecast" && brief.retiringWithin12Months > 0) {
    out.push({
      textTh: `เตรียมแผนทดแทนตำแหน่งผู้เกษียณภายใน 12 เดือน ${brief.retiringWithin12Months.toLocaleString("th-TH")} นาย`,
      severity: "warning",
    });
  }
  if ((type === "documentCompleteness" || type === "documentExpiry") && (brief.expiredDocuments > 0 || scoped.length > 0)) {
    out.push({
      textTh: `เร่งรัดจัดทำ/ต่ออายุเอกสารให้ครบสำหรับ ${scoped.length.toLocaleString("th-TH")} นายในรายงานนี้`,
      severity: brief.expiredDocuments > 0 ? "critical" : "warning",
    });
  }
  if (type === "trainingReadiness" && brief.missingTraining > 0) {
    out.push({
      textTh: `จัดแผนฝึกอบรมผู้ขาดหลักสูตร ${brief.missingTraining.toLocaleString("th-TH")} นาย`,
      severity: "warning",
    });
  }
  if ((type === "highPriority" || type === "criticalAction") && brief.criticalOfficers > 0) {
    out.push({
      textTh: `ตรวจสอบกำลังพลระดับวิกฤต ${brief.criticalOfficers.toLocaleString("th-TH")} นายเป็นลำดับแรก`,
      severity: "critical",
    });
  }
  if (type === "birthday") {
    out.push({
      textTh: `มีวันเกิดใกล้ถึงภายใน 90 วันจำนวน ${scoped.length.toLocaleString("th-TH")} นาย — ใช้สำหรับพิธีการ/การดูแลกำลังพล`,
      severity: "info",
    });
  }
  if (type === "monthlyBrief" || type === "personnelSummary") {
    for (const item of brief.actionItemsTh.slice(0, 3)) {
      out.push({
        textTh: item,
        severity: item.includes("วิกฤต") || item.includes("หมดอายุ") ? "critical" : "warning",
      });
    }
  }
  if (out.length === 0) {
    out.push({ textTh: "ติดตามสถานะตามรายงานและทบทวนในรอบถัดไป", severity: "info" });
  }
  return out;
}

function formatGeneratedDateTh(asOf: Date): string {
  const day = asOf.getUTCDate();
  const month = asOf.getUTCMonth() + 1;
  const yearBe = toBuddhistEraYear(asOf.getUTCFullYear());
  return `${day}/${month}/${yearBe}`;
}

/** Composes one executive report from the already-loaded dataset subset. */
export function buildExecutiveReport(input: BuildExecutiveReportInput): ExecutiveReportViewModel {
  const type = resolveReportType(input.type);
  const { options, filters, asOf, preparedByTh } = input;
  const filtered = applyReportFilters(input.officers, filters, asOf);
  const projected = projectOfficers(type, filtered, asOf, filters);
  const catalog = getReportCatalogEntry(type);
  const fy = computeFiscalYearSummary(asOf);
  const filterSummaryTh = describeReportFiltersTh(filters, options);
  const brief = buildCommanderBrief(filtered, asOf);
  const columns = buildColumns(type);
  const rows = projected.map((o) => buildRow(type, o, asOf));

  return {
    type,
    cover: {
      titleTh: catalog.titleTh,
      subtitleTh: catalog.subtitleTh,
      organizationScopeTh: filterSummaryTh,
      fiscalYearTh: fy.displayFiscalYearTh,
      generatedDateTh: formatGeneratedDateTh(asOf),
      preparedByTh: preparedByTh.trim() || "ผู้บังคับบัญชา",
      reportVersion: REPORT_VERSION,
      confidentialTh: CONFIDENTIAL_FOOTER_TH,
    },
    kpis: buildKpis(type, projected, filtered, asOf),
    recommendations: buildRecommendations(type, projected, filtered, asOf),
    columns,
    rows,
    officers: projected,
    brief,
    resultCount: projected.length,
    filterSummaryTh,
  };
}
