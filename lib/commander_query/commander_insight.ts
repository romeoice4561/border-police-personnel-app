/**
 * Commander Insight (Phase 43 Workstream A, Task A6).
 *
 * A deterministic (non-LLM), pure function that turns the CURRENTLY-
 * FILTERED result set into a single Thai summary sentence for the
 * commander — e.g. "พบกำลังพล 42 นาย ในจำนวนนี้ครบคุณสมบัติปีนี้ 5 นาย
 * และมีคุณสมบัติครบแล้วรอการแต่งตั้ง 3 นาย". Every number is a plain count
 * over `officer.promotionIntelligence.promotionStatus` (PromotionSummary —
 * Phase 41's single source of truth) — no eligibility is recalculated, no
 * external model is called, and the same input always produces the same
 * sentence.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";

function countStatus(officers: readonly CommanderQueryOfficer[], status: PromotionEligibilityStatus): number {
  return officers.filter((officer) => officer.promotionIntelligence.promotionStatus === status).length;
}

/**
 * Builds the Commander Insight sentence for the given (already-filtered)
 * officer set. Returns a fixed "no results" sentence for an empty set —
 * never a fabricated or LLM-generated statement.
 */
export function buildCommanderInsightTh(officers: readonly CommanderQueryOfficer[]): string {
  const total = officers.length;
  if (total === 0) return "ไม่พบกำลังพลตรงกับเงื่อนไขที่กำหนด";

  const eligibleThisYear = countStatus(officers, "EligibleThisYear");
  const alreadyEligible = countStatus(officers, "AlreadyEligible");
  const missingTraining = countStatus(officers, "MissingTraining");
  const missingDocuments = countStatus(officers, "MissingDocuments");
  const retirementRestricted = countStatus(officers, "RetirementRestricted");

  const clauses: string[] = [`พบกำลังพล ${total.toLocaleString("th-TH")} นาย`];

  if (eligibleThisYear > 0) clauses.push(`ครบคุณสมบัติปีนี้ ${eligibleThisYear.toLocaleString("th-TH")} นาย`);
  if (alreadyEligible > 0) clauses.push(`มีคุณสมบัติครบแล้วรอการแต่งตั้ง ${alreadyEligible.toLocaleString("th-TH")} นาย`);
  if (missingTraining > 0) clauses.push(`ขาดหลักสูตร ${missingTraining.toLocaleString("th-TH")} นาย`);
  if (missingDocuments > 0) clauses.push(`ขาดเอกสาร ${missingDocuments.toLocaleString("th-TH")} นาย`);
  if (retirementRestricted > 0) clauses.push(`ใกล้เกษียณอายุราชการ ${retirementRestricted.toLocaleString("th-TH")} นาย`);

  if (clauses.length === 1) return `${clauses[0]} ยังไม่มีรายที่ครบคุณสมบัติหรือรอการแต่งตั้งในเงื่อนไขปัจจุบัน`;

  return `${clauses[0]} ในจำนวนนี้${clauses.slice(1).join(" และ")}`;
}
