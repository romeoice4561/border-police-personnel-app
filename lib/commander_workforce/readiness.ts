/**
 * Transparent workforce readiness — equal weights among available dimensions.
 * Not an AI score. Not used for appointment decisions.
 */

import type { WorkforceDocumentSection } from "@/lib/commander_workforce/types";
import type { WorkforceDataQualitySection } from "@/lib/commander_workforce/types";
import type { WorkforcePromotionSection } from "@/lib/commander_workforce/types";
import type { WorkforceRetirementSection } from "@/lib/commander_workforce/types";
import type { WorkforceTrainingSection } from "@/lib/commander_workforce/types";
import type { WorkforceReadinessDimension, WorkforceReadinessSection } from "@/lib/commander_workforce/types";
import { READINESS_EQUAL_WEIGHT } from "@/lib/commander_workforce/contracts";

export function buildReadinessSection(args: {
  promotion: WorkforcePromotionSection;
  retirement: WorkforceRetirementSection;
  training: WorkforceTrainingSection;
  documents: WorkforceDocumentSection;
  dataQuality: WorkforceDataQualitySection;
  totalOfficers: number;
}): WorkforceReadinessSection {
  const total = args.totalOfficers;

  const dimensions: WorkforceReadinessDimension[] = [];

  // Promotion readiness: eligible / evaluated (excluding Unknown from denominator when all unknown)
  {
    const denom = args.promotion.totalEvaluated - args.promotion.unknownTotal;
    const num = args.promotion.eligibleTotal;
    const available = denom > 0;
    dimensions.push({
      key: "promotion",
      labelTh: "ความพร้อมด้านเลื่อนตำแหน่ง",
      status: available ? "available" : "unavailable",
      numerator: available ? num : null,
      denominator: available ? denom : null,
      percentage: available ? roundPct(num, denom) : null,
      explanationTh: available
        ? `EligibleThisYear + AlreadyEligible = ${num} จาก ${denom} ที่ประเมินได้ (ไม่นับ Unknown)`
        : "ไม่มีกำลังพลที่ประเมินสถานะเลื่อนตำแหน่งได้",
      sourceSection: "promotion",
      availability: available
        ? { status: "available" }
        : { status: "unavailable", reason: "INSUFFICIENT_DATA" },
      weight: available ? READINESS_EQUAL_WEIGHT : null,
    });
  }

  // Retirement continuity: share NOT in immediate ≤1y window among known dates
  {
    const unknown = args.retirement.buckets.find((b) => b.key === "unknown")?.count ?? 0;
    const within1 = args.retirement.buckets.find((b) => b.key === "within_1_year")?.count ?? 0;
    const thisFy = args.retirement.buckets.find((b) => b.key === "this_fiscal_year")?.count ?? 0;
    const retired = args.retirement.buckets.find((b) => b.key === "already_retired")?.count ?? 0;
    const denom = total - unknown;
    const atRisk = within1 + thisFy + retired;
    const num = Math.max(0, denom - atRisk);
    const available = denom > 0;
    dimensions.push({
      key: "retirement",
      labelTh: "ความต่อเนื่องด้านเกษียณ",
      status: available ? "available" : "unavailable",
      numerator: available ? num : null,
      denominator: available ? denom : null,
      percentage: available ? roundPct(num, denom) : null,
      explanationTh: available
        ? `กำลังพลที่ไม่อยู่ในหน้าต่างเกษียณปีนี้/≤1 ปี/เกษียณแล้ว = ${num}/${denom}`
        : "ไม่มีปีเกษียณที่ทราบ",
      sourceSection: "retirement",
      availability: available
        ? { status: "available" }
        : { status: "unavailable", reason: "INSUFFICIENT_DATA" },
      weight: available ? READINESS_EQUAL_WEIGHT : null,
    });
  }

  // Training: Complete / (total - NoPolicy - NoData) when policy-bearing statuses exist
  {
    const excluded = args.training.noPolicy + args.training.noData;
    const denom = total - excluded;
    const num = args.training.complete;
    const available = denom > 0 && args.training.noPolicy < total;
    dimensions.push({
      key: "training",
      labelTh: "ความครบถ้วนด้านหลักสูตร",
      status: available ? "available" : "unavailable",
      numerator: available ? num : null,
      denominator: available ? denom : null,
      percentage: available ? roundPct(num, denom) : null,
      explanationTh: available
        ? `Complete = ${num} จาก ${denom} (ไม่นับ NoPolicy/NoData ในตัวส่วน)`
        : "นโยบายหลักสูตรยังไม่พร้อมหรือไม่มีข้อมูลประเมิน",
      sourceSection: "training",
      availability: available
        ? { status: "available" }
        : { status: "unavailable", reason: "NOT_APPLICABLE" },
      weight: available ? READINESS_EQUAL_WEIGHT : null,
    });
  }

  // Documents: complete / total
  {
    const denom = total;
    const num = args.documents.complete;
    const available = denom > 0;
    dimensions.push({
      key: "documents",
      labelTh: "ความครบถ้วนด้านเอกสาร",
      status: available ? "available" : "unavailable",
      numerator: available ? num : null,
      denominator: available ? denom : null,
      percentage: available ? roundPct(num, denom) : null,
      explanationTh: available
        ? `เอกสารครบ = ${num}/${denom}`
        : "ไม่มีกำลังพลในขอบเขต",
      sourceSection: "documents",
      availability: available
        ? { status: "available" }
        : { status: "unavailable", reason: "INSUFFICIENT_DATA" },
      weight: available ? READINESS_EQUAL_WEIGHT : null,
    });
  }

  // Data quality: (total - affected) / total
  {
    const denom = total;
    const num = Math.max(0, total - args.dataQuality.affectedOfficerCount);
    const available = denom > 0;
    dimensions.push({
      key: "dataQuality",
      labelTh: "คุณภาพข้อมูล",
      status: available ? "available" : "unavailable",
      numerator: available ? num : null,
      denominator: available ? denom : null,
      percentage: available ? roundPct(num, denom) : null,
      explanationTh: available
        ? `ไม่มีปัญหาคุณภาพข้อมูล = ${num}/${denom}`
        : "ไม่มีกำลังพลในขอบเขต",
      sourceSection: "dataQuality",
      availability: available
        ? { status: "available" }
        : { status: "unavailable", reason: "INSUFFICIENT_DATA" },
      weight: available ? READINESS_EQUAL_WEIGHT : null,
    });
  }

  const availableDims = dimensions.filter((d) => d.status === "available" && d.percentage != null);
  const weightSum = availableDims.reduce((s, d) => s + (d.weight ?? 0), 0);
  let overall: number | null = null;
  if (weightSum > 0) {
    const weighted = availableDims.reduce((s, d) => s + (d.percentage ?? 0) * (d.weight ?? 0), 0);
    overall = Math.round((weighted / weightSum) * 10) / 10;
  }

  const confidencePercentage =
    dimensions.length > 0
      ? Math.round((availableDims.length / dimensions.length) * 1000) / 10
      : null;

  const formulaTh =
    "ค่าเฉลี่ยถ่วงน้ำหนักเท่ากันของมิติที่ available เท่านั้น — ไม่นับมิติ unavailable เป็นศูนย์";

  const breakdownTh = dimensions.map((d) => {
    if (d.status !== "available" || d.percentage == null) {
      return `${d.labelTh}: ไม่พร้อมใช้งาน (${d.availability.status === "unavailable" ? d.availability.reason : "n/a"})`;
    }
    return `${d.labelTh}: ${d.numerator}/${d.denominator} = ${d.percentage}% (น้ำหนัก ${d.weight})`;
  });
  if (overall != null) {
    breakdownTh.push(`รวม: ${overall}% จาก ${availableDims.length} มิติ`);
  } else {
    breakdownTh.push("รวม: ไม่สามารถคำนวณได้ — ไม่มีมิติที่พร้อมใช้งาน");
  }

  return {
    overallPercentage: overall,
    overallAvailability:
      overall != null
        ? { status: "available" }
        : { status: "unavailable", reason: "INSUFFICIENT_DATA" },
    confidencePercentage,
    formulaTh,
    dimensions,
    breakdownTh,
  };
}

function roundPct(n: number, d: number): number {
  return Math.round((n / d) * 1000) / 10;
}
