/**
 * Match Explanation (Phase DI-2 — Section 11).
 *
 * Turns a signal list into human-readable reason strings — never a bare
 * "same person" claim (Section 11 explicit prohibition on "เป็นบุคคลเดียวกัน
 * แน่นอน" unless a human reviewer has actually confirmed it). Pure text
 * formatting, no I/O; bilingual (Thai/English) to match this codebase's i18n
 * convention, called from API responses so the client never has to
 * re-derive wording from raw signal kinds itself.
 */

import type { DrugMatchConfidence, DrugMatchSignal, DrugMatchSignalKind } from "@/lib/drug_intelligence/drug_person_matching";

const SIGNAL_REASON_TH: Record<DrugMatchSignalKind, string> = {
  IDENTIFIER_THAI_ID: "เลขบัตรประชาชนตรงกัน",
  IDENTIFIER_PASSPORT: "เลขพาสปอร์ตตรงกัน",
  IDENTIFIER_ALIEN_ID: "เลขที่คนต่างด้าวตรงกัน",
  IDENTIFIER_OTHER: "เลขที่เอกสารประจำตัวตรงกัน",
  PHONE_NUMBER: "พบเบอร์โทรศัพท์ร่วมกัน",
  DEVICE_IMEI: "พบ IMEI อุปกรณ์ร่วมกัน",
  VEHICLE_VIN: "พบเลขตัวถังรถ (VIN) ร่วมกัน",
  NAME_EXACT: "ชื่อ-นามสกุลตรงกัน",
  ALIAS_MATCH: "พบชื่ออื่น/ฉายาตรงกัน",
  DATE_OF_BIRTH: "วันเดือนปีเกิดตรงกัน",
  SAME_CASE: "เคยปรากฏร่วมในคดีเดียวกัน",
};

const SIGNAL_REASON_EN: Record<DrugMatchSignalKind, string> = {
  IDENTIFIER_THAI_ID: "Matching Thai national ID",
  IDENTIFIER_PASSPORT: "Matching passport number",
  IDENTIFIER_ALIEN_ID: "Matching alien ID number",
  IDENTIFIER_OTHER: "Matching identifier value",
  PHONE_NUMBER: "Shared phone number",
  DEVICE_IMEI: "Shared device IMEI",
  VEHICLE_VIN: "Shared vehicle VIN",
  NAME_EXACT: "Exact name match",
  ALIAS_MATCH: "Matching alias/nickname",
  DATE_OF_BIRTH: "Matching date of birth",
  SAME_CASE: "Appeared together in the same case",
};

const CONFIDENCE_HEADLINE_TH: Record<DrugMatchConfidence, string> = {
  HIGH: "มีความเป็นไปได้สูงว่าเป็นบุคคลเดียวกัน — ควรตรวจสอบ",
  MEDIUM: "อาจเป็นบุคคลเดียวกัน — ควรตรวจสอบเพิ่มเติม",
  LOW: "พบความคล้ายคลึงบางส่วน — ควรตรวจสอบเพิ่มเติม",
};

const CONFIDENCE_HEADLINE_EN: Record<DrugMatchConfidence, string> = {
  HIGH: "Likely the same person — review recommended",
  MEDIUM: "Possibly the same person — further review needed",
  LOW: "Some similarity found — further review needed",
};

export interface DrugMatchExplanation {
  headline: string;
  reasons: string[];
}

/**
 * Section 11: never returns a certainty claim — every headline is phrased as
 * a possibility requiring review, regardless of confidence level, because
 * confidence here is a derived signal-strength category (Section 12), not a
 * human confirmation. A `CONFIRMED_DUPLICATE`/`MERGED` decision (Section 19)
 * is the only thing allowed to assert identity as settled, and that wording
 * lives in the review-decision UI copy, not here.
 */
export function explainDrugMatch(signals: DrugMatchSignal[], confidence: DrugMatchConfidence, language: "th" | "en"): DrugMatchExplanation {
  const reasonMap = language === "th" ? SIGNAL_REASON_TH : SIGNAL_REASON_EN;
  const headlineMap = language === "th" ? CONFIDENCE_HEADLINE_TH : CONFIDENCE_HEADLINE_EN;

  const seen = new Set<string>();
  const reasons: string[] = [];
  for (const signal of signals) {
    const text = reasonMap[signal.kind];
    if (!seen.has(text)) {
      seen.add(text);
      reasons.push(text);
    }
  }

  return { headline: headlineMap[confidence], reasons };
}
