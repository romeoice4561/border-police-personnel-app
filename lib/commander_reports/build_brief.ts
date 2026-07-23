/**
 * One-page Commander Brief builder (Phase 49C).
 *
 * Tallies ONLY already-computed CommanderQueryOfficer fields — no engine calls.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { CommanderBriefViewModel } from "@/lib/commander_reports/types";

function retiringWithinOneYear(officers: readonly CommanderQueryOfficer[], asOf: Date): number {
  const year = asOf.getUTCFullYear();
  return officers.filter((o) => o.retirementYear != null && o.retirementYear - year <= 1).length;
}

/** Builds the shared briefing KPI + action-item block from a filtered officer set. */
export function buildCommanderBrief(
  officers: readonly CommanderQueryOfficer[],
  asOf: Date = new Date()
): CommanderBriefViewModel {
  const totalPersonnel = officers.length;
  const readyForPromotion = officers.filter(
    (o) =>
      o.nextLevelEligibility?.eligibleNow === true ||
      o.promotionIntelligence.promotionStatus === "EligibleThisYear" ||
      o.promotionIntelligence.promotionStatus === "AlreadyEligible"
  ).length;
  const retiringWithin12Months = retiringWithinOneYear(officers, asOf);
  const expiredDocuments = officers.filter((o) => o.documentIntelligence.expiredCount > 0).length;
  const missingTraining = officers.filter((o) => o.trainingIntelligence.trainingStatus === "MissingRequired").length;
  const criticalOfficers = officers.filter((o) => o.priority === "critical").length;
  const aiReady = officers.filter((o) => o.documentIntelligence.readinessLevel === "READY").length;

  const summaryLinesTh: string[] = [];
  summaryLinesTh.push(`กำลังพลทั้งหมด ${totalPersonnel.toLocaleString("th-TH")} นาย`);
  if (readyForPromotion > 0) summaryLinesTh.push(`ครบคุณสมบัติเลื่อนตำแหน่ง ${readyForPromotion.toLocaleString("th-TH")} นาย`);
  if (retiringWithin12Months > 0) summaryLinesTh.push(`เกษียณภายใน 12 เดือน ${retiringWithin12Months.toLocaleString("th-TH")} นาย`);
  if (expiredDocuments > 0) summaryLinesTh.push(`เอกสารหมดอายุ ${expiredDocuments.toLocaleString("th-TH")} นาย`);
  if (missingTraining > 0) summaryLinesTh.push(`ขาดการฝึกอบรม ${missingTraining.toLocaleString("th-TH")} นาย`);
  if (criticalOfficers > 0) summaryLinesTh.push(`Critical Officers ${criticalOfficers.toLocaleString("th-TH")} นาย`);
  summaryLinesTh.push(`พร้อม AI ${aiReady.toLocaleString("th-TH")} นาย`);

  const actionItemsTh: string[] = [];
  if (criticalOfficers > 0) actionItemsTh.push(`ตรวจสอบกำลังพลระดับวิกฤต ${criticalOfficers.toLocaleString("th-TH")} นาย`);
  if (readyForPromotion > 0) actionItemsTh.push(`พิจารณาเลื่อนตำแหน่งผู้ครบคุณสมบัติ ${readyForPromotion.toLocaleString("th-TH")} นาย`);
  if (expiredDocuments > 0) actionItemsTh.push(`เร่งต่ออายุเอกสารที่หมดอายุ ${expiredDocuments.toLocaleString("th-TH")} นาย`);
  if (missingTraining > 0) actionItemsTh.push(`จัดแผนฝึกอบรมผู้ขาดหลักสูตร ${missingTraining.toLocaleString("th-TH")} นาย`);
  if (retiringWithin12Months > 0) actionItemsTh.push(`เตรียมแผนทดแทนผู้เกษียณ ${retiringWithin12Months.toLocaleString("th-TH")} นาย`);
  if (actionItemsTh.length === 0) actionItemsTh.push("ไม่มีรายการเร่งด่วนในขอบเขตที่เลือก");

  return {
    totalPersonnel,
    readyForPromotion,
    retiringWithin12Months,
    expiredDocuments,
    missingTraining,
    criticalOfficers,
    aiReady,
    summaryLinesTh,
    actionItemsTh,
  };
}
