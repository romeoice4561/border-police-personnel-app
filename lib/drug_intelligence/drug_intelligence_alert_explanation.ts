/**
 * Intelligence alert title/explanation composition (Phase DI-6, Section 25's
 * neutral-wording rule).
 *
 * The service layer never hand-writes alert copy per call site — every
 * title/explanation routes through this module, mirroring
 * drug_network_graph_explanation.ts's "compose from typed facts, never
 * invent wording inline" convention exactly. Every sentence uses one of the
 * neutral phrases the mission requires ("พบข้อมูลเดิม", "พบในคดีอื่น",
 * "พบเกี่ยวข้องกับบุคคลอื่น", "พบการใช้งาน/บันทึกร่วมกัน", "ควรตรวจสอบความ
 * เชื่อมโยงเพิ่มเติม") — never "เป็นเครือข่ายเดียวกัน", "เป็นเจ้าของ", or
 * "เป็นผู้ร่วมขบวนการ". No probability percentages are ever composed here.
 *
 * Pure data — no I/O, no React.
 */

import type { DrugAlertType, DrugAlertEntityType } from "@/lib/drug_intelligence/drug_intelligence_alert_types";

const ENTITY_LABEL_TH: Record<DrugAlertEntityType, string> = {
  PERSON: "บุคคล",
  PHONE: "เบอร์โทรศัพท์",
  SIM: "SIM",
  DEVICE: "IMEI/อุปกรณ์",
  VEHICLE: "ยานพาหนะ",
};

/**
 * Deliberately carries NO entity value (masked or otherwise) — `title`/
 * `explanation` are PERSISTED once at generation time, but masking is a
 * per-viewer, per-request decision (`can("drug.edit")`); baking a masked-or-
 * not string into a stored row would show every future viewer whatever
 * masking happened to apply to whoever triggered generation. The actual
 * phone/IMEI/registration/name value is looked up fresh (and masked fresh)
 * by the UI/API layer at render time via the existing entity-detail
 * services, never read off this composed string.
 */
export interface DrugAlertExplanationInput {
  alertType: DrugAlertType;
  entityType: DrugAlertEntityType;
  priorCaseCount: number;
  relatedPersonCount: number;
}

/** Composes the alert `title` — short, scannable, for the Alert Center list/KPI cards and inline Create Case cards. */
export function composeDrugAlertTitle(input: DrugAlertExplanationInput): string {
  switch (input.alertType) {
    case "REPEAT_PERSON":
      return "บุคคลนี้เคยถูกบันทึกหลายคดี";
    case "REPEAT_PHONE":
      return "พบข้อมูลเดิม — หมายเลขโทรศัพท์";
    case "REPEAT_SIM":
      return "พบข้อมูลเดิม — SIM";
    case "REPEAT_DEVICE":
      return "พบข้อมูลเดิม — IMEI/อุปกรณ์";
    case "REPEAT_VEHICLE":
      return "พบข้อมูลเดิม — ยานพาหนะ";
    case "REPEAT_CASE_ENTITY":
      return "พบข้อมูลนี้ในคดีเดิม";
    case "NEW_NETWORK_CONNECTION":
      return "ข้อมูลใหม่ทำให้เกิดความเชื่อมโยงกับข้อมูลเดิม";
    case "HIGH_CONFIDENCE_DUPLICATE":
      return "พบรายการที่อาจซ้ำกับบุคคลอื่น";
  }
}

/** Composes the fuller `explanation` sentence — the neutral intelligence-assistance wording shown in detail views. */
export function composeDrugAlertExplanation(input: DrugAlertExplanationInput): string {
  const entityLabel = ENTITY_LABEL_TH[input.entityType];

  switch (input.alertType) {
    case "REPEAT_PERSON":
      return `พบว่า${entityLabel}นี้ถูกบันทึกไว้ใน ${input.priorCaseCount.toLocaleString("th-TH")} คดี — ควรตรวจสอบความเชื่อมโยงเพิ่มเติม`;
    case "REPEAT_PHONE":
    case "REPEAT_SIM":
    case "REPEAT_DEVICE":
    case "REPEAT_VEHICLE": {
      const caseText = `พบข้อมูลนี้ในคดีเดิมแล้ว ${input.priorCaseCount.toLocaleString("th-TH")} คดี`;
      const personText = input.relatedPersonCount > 0 ? ` เกี่ยวข้องกับบุคคลที่บันทึกไว้ ${input.relatedPersonCount.toLocaleString("th-TH")} ราย` : "";
      return `${caseText}${personText} — ควรตรวจสอบความเชื่อมโยงเพิ่มเติม`;
    }
    case "REPEAT_CASE_ENTITY":
      return `พบ${entityLabel}นี้ในคดีอื่นที่บันทึกไว้ก่อนหน้า`;
    case "NEW_NETWORK_CONNECTION":
      return `ข้อมูลที่เพิ่งบันทึกพบการใช้งาน/บันทึกร่วมกันกับข้อมูลที่มีอยู่แล้ว — ควรตรวจสอบความเชื่อมโยงเพิ่มเติม`;
    case "HIGH_CONFIDENCE_DUPLICATE":
      return `พบข้อมูลที่อาจซ้ำกับบุคคลอื่นที่บันทึกไว้ก่อนหน้า — ควรตรวจสอบในคิวตรวจสอบข้อมูลซ้ำ`;
  }
}
