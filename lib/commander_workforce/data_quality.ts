/**
 * Data-quality section — aggregates existing flags / missingEvidence / completeness.
 * Does not invent missing data.
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import { buildWorkforceDrilldown } from "@/lib/commander_workforce/drilldown";
import type {
  WorkforceDataQualityCategory,
  WorkforceDataQualitySection,
  WorkforceSeverity,
} from "@/lib/commander_workforce/types";

export type WorkforceDataQualityStatusKey =
  | "profile_incomplete"
  | "missing_portrait"
  | "documents_missing"
  | "needs_training"
  | "promotion_unknown"
  | "clean";

export function dataQualityStatusForOfficer(officer: CommanderQueryOfficer): WorkforceDataQualityStatusKey {
  if (officer.flagCodes.includes("PROFILE_INCOMPLETE")) return "profile_incomplete";
  if (officer.flagCodes.includes("MISSING_OFFICIAL_PORTRAIT")) return "missing_portrait";
  if (officer.flagCodes.includes("DOCUMENTS_MISSING")) return "documents_missing";
  if (officer.flagCodes.includes("NEEDS_TRAINING")) return "needs_training";
  const promo = officer.promotionIntelligence;
  if (promo?.promotionStatus === "Unknown" || promo?.confidence === "unknown" || promo?.confidence === "incomplete") {
    return "promotion_unknown";
  }
  return "clean";
}

function severityForCount(count: number, total: number): WorkforceSeverity {
  if (total <= 0 || count <= 0) return "info";
  const pct = count / total;
  if (pct >= 0.25 || officerPriorityCritical(count)) return "critical";
  if (pct >= 0.1) return "urgent";
  if (pct >= 0.05) return "attention";
  return "info";
}

function officerPriorityCritical(count: number): boolean {
  return count >= 20;
}

export function buildDataQualitySection(
  officers: readonly CommanderQueryOfficer[]
): WorkforceDataQualitySection {
  const total = officers.length;

  const categoriesSpec: Array<{
    key: string;
    labelTh: string;
    remediationTh: string;
    test: (o: CommanderQueryOfficer) => boolean;
    filters: Record<string, string | boolean>;
  }> = [
    {
      key: "missing_rank",
      labelTh: "ขาดยศ / ยศไม่ทราบ",
      remediationTh: "ตรวจสอบและบันทึกยศในข้อมูลหลัก",
      test: (o) => !o.rank || o.rank === "Unknown" || o.rank.trim() === "",
      filters: { search: "Unknown" },
    },
    {
      key: "missing_position",
      labelTh: "ขาดตำแหน่งปัจจุบัน",
      remediationTh: "บันทึกตำแหน่งปัจจุบัน",
      test: (o) => !o.currentPosition,
      filters: { flagCode: "PROFILE_INCOMPLETE" },
    },
    {
      key: "missing_organization",
      labelTh: "ขาดสังกัดองค์กร",
      remediationTh: "เชื่อมโยงหน่วยในระบบองค์กร",
      test: (o) => o.regionId == null && o.battalionId == null && o.companyId == null,
      filters: { flagCode: "PROFILE_INCOMPLETE" },
    },
    {
      key: "missing_service_start",
      labelTh: "ขาดหลักฐานเริ่มระดับตำแหน่ง",
      remediationTh: "เติมปีเริ่มดำรงระดับตำแหน่ง",
      test: (o) => o.positionLevelStartYearBe == null,
      filters: { promotionDataQuality: "not-assessable" },
    },
    {
      key: "missing_promotion_evidence",
      labelTh: "ขาดหลักฐานเลื่อนตำแหน่ง",
      remediationTh: "ตรวจสอบ PromotionSummary.missingEvidence",
      test: (o) => (o.promotionIntelligence?.missingEvidence?.length ?? 0) > 0,
      filters: { promotionDataQuality: "not-assessable" },
    },
    {
      key: "missing_retirement_evidence",
      labelTh: "ขาดหลักฐานเกษียณ",
      remediationTh: "บันทึกวันเกิดเพื่อประเมินเกษียณ",
      test: (o) => o.dateOfBirth == null || o.retirementStatus === "unknown",
      filters: { flagCode: "PROFILE_INCOMPLETE" },
    },
    {
      key: "missing_training_data",
      labelTh: "ขาดข้อมูลหลักสูตร",
      remediationTh: "บันทึกประวัติการฝึกอบรม",
      test: (o) =>
        o.trainingIntelligence?.trainingStatus === "NoData" ||
        o.trainingIntelligence?.trainingStatus === "Unknown",
      filters: { trainingStatus: "NoData" },
    },
    {
      key: "missing_document_data",
      labelTh: "ขาดข้อมูลเอกสาร",
      remediationTh: "อัปโหลดเอกสารจำเป็น",
      test: (o) => o.flagCodes.includes("DOCUMENTS_MISSING") || !o.hasDocuments,
      filters: { flagCode: "DOCUMENTS_MISSING" },
    },
    {
      key: "profile_incomplete_flag",
      labelTh: "โปรไฟล์ไม่ครบ (ธงระบบ)",
      remediationTh: "แก้ไข PROFILE_INCOMPLETE",
      test: (o) => o.flagCodes.includes("PROFILE_INCOMPLETE"),
      filters: { flagCode: "PROFILE_INCOMPLETE" },
    },
    {
      key: "low_confidence_promotion",
      labelTh: "ความเชื่อมั่นการเลื่อนตำแหน่งต่ำ",
      remediationTh: "เติมหลักฐานจน confidence เป็น confirmed",
      test: (o) =>
        o.promotionIntelligence?.confidence === "incomplete" ||
        o.promotionIntelligence?.confidence === "unknown",
      filters: { promotionDataQuality: "not-assessable" },
    },
    {
      key: "critical_priority",
      labelTh: "ความเร่งด่วนระดับวิกฤต",
      remediationTh: "ทบทวนรายการ priority=critical",
      test: (o) => o.priority === "critical",
      filters: { priority: "critical" },
    },
  ];

  const categories: WorkforceDataQualityCategory[] = categoriesSpec.map((spec) => {
    const count = officers.filter(spec.test).length;
    return {
      key: spec.key,
      labelTh: spec.labelTh,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : null,
      severity: severityForCount(count, total),
      remediationTh: spec.remediationTh,
      drilldown: buildWorkforceDrilldown({
        id: `dq:${spec.key}`,
        label: spec.labelTh,
        filters: spec.filters,
      }),
    };
  });

  const affected = new Set<string>();
  for (const officer of officers) {
    if (categoriesSpec.some((s) => s.test(officer))) affected.add(officer.officerId);
  }

  return {
    affectedOfficerCount: affected.size,
    percentage: total > 0 ? Math.round((affected.size / total) * 1000) / 10 : null,
    categories,
  };
}
