/**
 * Centralized Commander Search label dictionary (Phase 41 Part 7 — i18n
 * FOUNDATION only).
 *
 * This phase does NOT switch the UI language at runtime — Thai stays the
 * default and the TH|EN toggle is a visual placeholder. The point of this
 * module is the SEAM: every Commander Search label lives here as a bilingual
 * {th,en} pair (reusing lib/i18n/bilingual_label's `bilingual()` helper) rather
 * than being hard-written inside components, so a later phase can implement
 * runtime switching by changing ONE rendering rule instead of touching every
 * component. `th.ts` / `en.ts` are the single-language projections of this
 * dictionary a future language provider would select between.
 *
 * Pure data — no I/O, no React.
 */

import { bilingual, type BilingualText } from "@/lib/i18n/bilingual_label";

/** Every Commander Search UI label, keyed by a stable id. Add new labels here, never inline in a component. */
export const COMMANDER_LABELS = {
  // Page / sections
  title: bilingual("ศูนย์ค้นหากำลังพลสำหรับผู้บังคับบัญชา", "Commander Search Center"),
  personnelQuery: bilingual("ค้นหากำลังพล", "Personnel Query"),
  promotionEligibilitySearch: bilingual("ค้นหาผู้มีสิทธิ์เลื่อนตำแหน่ง", "Promotion Eligibility Search"),
  presets: bilingual("ชุดค้นหาสำเร็จรูป", "Presets"),
  readyForPromotion: bilingual("ครบขึ้นระดับตำแหน่ง", "Ready for promotion"),

  // Filter fields
  rank: bilingual("ยศ", "Rank"),
  currentPosition: bilingual("ตำแหน่งปัจจุบัน", "Current Position"),
  positionLevel: bilingual("ระดับตำแหน่ง", "Position Level"),
  region: bilingual("ภาค", "Region"),
  battalion: bilingual("กองกำกับการ", "Battalion"),
  company: bilingual("กองร้อย", "Company"),
  yearsInRank: bilingual("อายุการดำรงยศ", "Years in Rank"),
  yearsInPosition: bilingual("อายุการดำรงตำแหน่ง", "Years in Position"),
  completedPromotionCycles: bilingual("ครบวาระ", "Completed Cycles"),
  appointmentCycle: bilingual("รอบแต่งตั้ง", "Appointment Cycle"),
  eligibleCycle: bilingual("ครบตั้งแต่", "Eligible Since"),
  overdueCycles: bilingual("เกินกำหนด", "Eligible Overdue"),
  age: bilingual("อายุ", "Age"),
  governmentServiceYears: bilingual("อายุราชการ", "Government Service Years"),
  intelligenceFlag: bilingual("สัญญาณข่าวกรอง", "Intelligence Flag"),
  priority: bilingual("ระดับความสำคัญ", "Priority"),
  minProfileCompleteness: bilingual("ความสมบูรณ์ของข้อมูลขั้นต่ำ", "Minimum Profile Completeness"),

  // Promotion eligibility
  currentRank: bilingual("ยศปัจจุบัน", "Current Rank"),
  targetRank: bilingual("ยศเป้าหมาย", "Target Rank"),
  currentPositionLevel: bilingual("ระดับตำแหน่งปัจจุบัน", "Current Position Level"),
  targetPositionLevel: bilingual("ระดับตำแหน่งเป้าหมาย", "Target Position Level"),
  eligibilityStatus: bilingual("สถานะสิทธิ์เลื่อนตำแหน่ง", "Eligibility Status"),
  eligibleNow: bilingual("ครบแล้ว", "Eligible now"),
  eligibleSoon: bilingual("ใกล้ครบ", "Eligible soon"),
  overdue: bilingual("เกินกำหนด", "Overdue"),
  notEligible: bilingual("ยังไม่ครบ", "Not eligible"),

  // Duration filter
  completed: bilingual("ครบ", "Completed"),
  operatorExactly: bilingual("พอดี", "Exactly"),
  operatorAtLeast: bilingual("อย่างน้อย", "At least"),
  operatorMoreThan: bilingual("มากกว่า", "More than"),
  operatorLessThan: bilingual("น้อยกว่า", "Less than"),

  // Actions
  apply: bilingual("ค้นหา", "Apply"),
  resetAll: bilingual("รีเซ็ตทั้งหมด", "Reset All"),
  clearFilters: bilingual("ล้างตัวกรอง", "Clear Filters"),

  // Misc
  allRanks: bilingual("ทุกยศ", "All ranks"),
  allPositionLevels: bilingual("ทุกระดับตำแหน่ง", "All position levels"),
  anyFlag: bilingual("ทุกสัญญาณ", "Any flag"),
  anyPriority: bilingual("ทุกระดับความสำคัญ", "Any priority"),
  anyStatus: bilingual("ทุกสถานะ", "Any status"),
} as const satisfies Record<string, BilingualText>;

export type CommanderLabelKey = keyof typeof COMMANDER_LABELS;

// Phase 43: the canonical Language type now lives in the central dictionary
// (language-agnostic, app-wide). Re-exported here so existing importers of
// `Language`/`DEFAULT_LANGUAGE` from this module keep working unchanged.
export { DEFAULT_LANGUAGE, type Language } from "@/lib/i18n/dictionary";
import { DEFAULT_LANGUAGE as CANONICAL_DEFAULT_LANGUAGE, type Language as CanonicalLanguage } from "@/lib/i18n/dictionary";

/** Resolves a Commander label to a single language. */
export function label(key: CommanderLabelKey, language: CanonicalLanguage = CANONICAL_DEFAULT_LANGUAGE): string {
  return COMMANDER_LABELS[key][language];
}
