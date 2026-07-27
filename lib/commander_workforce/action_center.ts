/**
 * Executive Action Center — deterministic operational items from existing statuses.
 * No AI. No subjective personnel ranking.
 */

import { buildWorkforceDrilldown } from "@/lib/commander_workforce/drilldown";
import type {
  WorkforceActionCenterSection,
  WorkforceActionItem,
  WorkforceDataQualitySection,
  WorkforceDocumentSection,
  WorkforcePromotionSection,
  WorkforceRetirementSection,
  WorkforceSeverity,
  WorkforceTrainingSection,
} from "@/lib/commander_workforce/types";

function severityFromCount(count: number, urgentAt: number, criticalAt: number): WorkforceSeverity {
  if (count <= 0) return "info";
  if (count >= criticalAt) return "critical";
  if (count >= urgentAt) return "urgent";
  return "attention";
}

export function buildActionCenterSection(args: {
  promotion: WorkforcePromotionSection;
  retirement: WorkforceRetirementSection;
  training: WorkforceTrainingSection;
  documents: WorkforceDocumentSection;
  dataQuality: WorkforceDataQualitySection;
  totalOfficers: number;
}): WorkforceActionCenterSection {
  const candidates: Array<Omit<WorkforceActionItem, "severity"> & { severity: WorkforceSeverity }> = [];

  const eligible =
    (args.promotion.byStatus.find((s) => s.status === "EligibleThisYear")?.count ?? 0) +
    (args.promotion.byStatus.find((s) => s.status === "AlreadyEligible")?.count ?? 0);
  candidates.push({
    key: "promotion_ready",
    titleTh: "ผู้มีคุณสมบัติครบทั้งหมด",
    summaryTh: `มี ${eligible} นายที่พร้อมเลื่อนปีนี้หรือครบคุณสมบัติก่อนปีนี้`,
    category: "promotion",
    severity: severityFromCount(eligible, 5, 20),
    count: eligible,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "EligibleThisYear|AlreadyEligible",
    explanationTh: "ผลรวมสถานะพร้อมเลื่อนปีนี้ + ครบคุณสมบัติก่อนปีนี้ (ไม่ทับซ้อน)",
    drilldown: buildWorkforceDrilldown({
      id: "action:promotion_ready",
      target: "commander-promotion",
      label: "ผู้มีคุณสมบัติครบทั้งหมด",
      filters: { bucket: "qualifiedNow" },
    }),
  });

  const missingTraining = args.promotion.byStatus.find((s) => s.status === "MissingTraining")?.count ?? 0;
  candidates.push({
    key: "promotion_blocked_training",
    titleTh: "ติดขัดเลื่อนตำแหน่ง — ขาดหลักสูตร",
    summaryTh: `${missingTraining} นายสถานะ MissingTraining`,
    category: "promotion",
    severity: severityFromCount(missingTraining, 3, 10),
    count: missingTraining,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "MissingTraining",
    explanationTh: "PromotionSummary.MissingTraining",
    drilldown: buildWorkforceDrilldown({
      id: "action:promo_training",
      label: "MissingTraining",
      filters: { promotionEligibilityStatus: "MissingTraining" },
    }),
  });

  const missingDocsPromo =
    args.promotion.byStatus.find((s) => s.status === "MissingDocuments")?.count ?? 0;
  candidates.push({
    key: "promotion_blocked_documents",
    titleTh: "ติดขัดเลื่อนตำแหน่ง — ขาดเอกสาร",
    summaryTh: `${missingDocsPromo} นายสถานะ MissingDocuments`,
    category: "promotion",
    severity: severityFromCount(missingDocsPromo, 3, 10),
    count: missingDocsPromo,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "MissingDocuments",
    explanationTh: "PromotionSummary.MissingDocuments",
    drilldown: buildWorkforceDrilldown({
      id: "action:promo_docs",
      label: "MissingDocuments",
      filters: { promotionEligibilityStatus: "MissingDocuments" },
    }),
  });

  const retireNear =
    (args.retirement.buckets.find((b) => b.key === "this_fiscal_year")?.count ?? 0) +
    (args.retirement.buckets.find((b) => b.key === "within_1_year")?.count ?? 0);
  candidates.push({
    key: "retirement_window",
    titleTh: "ใกล้เกษียณ (ปีนี้ / ≤1 ปี)",
    summaryTh: `${retireNear} นายอยู่ในหน้าต่างเกษียณใกล้`,
    category: "retirement",
    severity: severityFromCount(retireNear, 5, 15),
    count: retireNear,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "retirementYear + retirementStatus",
    explanationTh: "รวมจากปีเกษียณที่มีอยู่ — ไม่คำนวณสูตรเกษียณใหม่",
    drilldown: buildWorkforceDrilldown({
      id: "action:retirement",
      label: "ใกล้เกษียณ",
      filters: { retirement: "within-1-year" },
    }),
  });

  candidates.push({
    key: "training_missing",
    titleTh: "ขาดหลักสูตรจำเป็น",
    summaryTh: `${args.training.missingRequired} นายสถานะ MissingRequired`,
    category: "training",
    severity: severityFromCount(args.training.missingRequired, 5, 15),
    count: args.training.missingRequired,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "MissingRequired",
    explanationTh: "TrainingSummary.trainingStatus",
    drilldown: buildWorkforceDrilldown({
      id: "action:training",
      label: "ขาดหลักสูตร",
      filters: { trainingStatus: "MissingRequired" },
    }),
  });

  candidates.push({
    key: "document_expired",
    titleTh: "เอกสารหมดอายุ",
    summaryTh: `${args.documents.expired} นายมีเอกสารหมดอายุ`,
    category: "documents",
    severity: severityFromCount(args.documents.expired, 3, 10),
    count: args.documents.expired,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "documentIntelligence.expiredCount",
    explanationTh: "นับจาก documentIntelligence.expiredCount > 0",
    drilldown: buildWorkforceDrilldown({
      id: "action:doc_expired",
      label: "เอกสารหมดอายุ",
      filters: { expiryStatus: "expired" },
    }),
  });

  candidates.push({
    key: "document_expiring",
    titleTh: "เอกสารใกล้หมดอายุ",
    summaryTh: `${args.documents.expiring} นายมีเอกสารใกล้หมดอายุ`,
    category: "documents",
    severity: severityFromCount(args.documents.expiring, 5, 15),
    count: args.documents.expiring,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "documentIntelligence.expiringSoonCount",
    explanationTh: "นับจาก documentIntelligence.expiringSoonCount > 0",
    drilldown: buildWorkforceDrilldown({
      id: "action:doc_expiring",
      label: "เอกสารใกล้หมดอายุ",
      filters: { expiryStatus: "warning" },
    }),
  });

  const criticalDq =
    args.dataQuality.categories.find((c) => c.key === "critical_priority")?.count ?? 0;
  candidates.push({
    key: "critical_data_quality",
    titleTh: "ช่องว่างข้อมูลระดับวิกฤต",
    summaryTh: `${criticalDq} นายมี priority=critical`,
    category: "data_quality",
    severity: severityFromCount(criticalDq, 1, 5),
    count: criticalDq,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "priority=critical",
    explanationTh: "OfficerPriority จาก intelligence card ที่มีอยู่",
    drilldown: buildWorkforceDrilldown({
      id: "action:dq_critical",
      label: "critical",
      filters: { priority: "critical" },
    }),
  });

  const unknownPromo = args.promotion.unknownTotal;
  candidates.push({
    key: "unknown_promotion_evidence",
    titleTh: "ประเมินเลื่อนตำแหน่งไม่ได้",
    summaryTh: `${unknownPromo} นายสถานะ Unknown`,
    category: "data_quality",
    severity: severityFromCount(unknownPromo, 5, 20),
    count: unknownPromo,
    affectedScopeTh: "ขอบเขตตัวกรองปัจจุบัน",
    sourceStatus: "Unknown",
    explanationTh: "PromotionSummary.promotionStatus = Unknown",
    drilldown: buildWorkforceDrilldown({
      id: "action:promo_unknown",
      label: "Unknown",
      filters: { promotionEligibilityStatus: "Unknown" },
    }),
  });

  // Deterministic order by severity then key — never by subjective merit.
  const severityRank: Record<WorkforceSeverity, number> = {
    critical: 0,
    urgent: 1,
    attention: 2,
    info: 3,
  };

  const omittedZeroCountKeys = candidates.filter((c) => c.count <= 0).map((c) => c.key);
  const items = candidates
    .filter((c) => c.count > 0)
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.key.localeCompare(b.key));

  return { items, omittedZeroCountKeys: omittedZeroCountKeys.sort() };
}
