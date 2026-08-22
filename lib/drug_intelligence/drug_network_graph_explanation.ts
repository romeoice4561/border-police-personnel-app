/**
 * Network graph edge explanation composition (Phase DI-5, Sections 2, 3, 11,
 * "never claim proof of association").
 *
 * Composes the final neutral Thai/English sentence for one edge from its
 * machine-readable DrugGraphEdgeExplanation — the UI/API layer never
 * hand-writes edge wording, exactly mirroring
 * drug_search_match_explanation.ts's "reuse a typed lookup, never recompute
 * client-side" convention. Every sentence uses one of the neutral phrases
 * the mission explicitly requires ("พบเกี่ยวข้องกับ", "พบร่วมในข้อมูล",
 * "พบใช้งาน/บันทึกร่วมกัน", "พบในคดีเดียวกัน") — never "เป็นเจ้าของ",
 * "เครือข่ายผู้ร่วมขบวนการ", or any wording implying proven association.
 *
 * Pure data — no I/O, no React.
 */

import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import type { DrugGraphEdge } from "@/lib/drug_intelligence/drug_network_graph_types";

export function explainDrugGraphEdge(edge: DrugGraphEdge, language: "th" | "en"): string {
  const e = edge.explanation;
  switch (e.kind) {
    case "DIRECT_ROLE": {
      const roleLabel = isValidDrugCasePersonRole(e.role) ? DRUG_CASE_PERSON_ROLE_LABELS[e.role] : null;
      const role = roleLabel ? (language === "th" ? roleLabel.labelTh : roleLabel.labelEn) : e.role;
      return language === "th" ? `พบในคดีนี้ในฐานะ${role}` : `Recorded in this case as ${role}`;
    }
    case "DIRECT_LINK":
      return language === "th" ? "พบเกี่ยวข้องกับข้อมูลนี้โดยตรง" : "Directly recorded as related to this data";
    case "SHARED_CASES":
      return language === "th" ? `พบในคดีเดียวกัน ${e.count.toLocaleString("th-TH")} คดี` : `Found in ${e.count} shared case(s)`;
    case "SHARED_PHONE":
      return language === "th" ? "พบใช้งาน/บันทึกหมายเลขโทรศัพท์เดียวกัน" : "Found recorded using the same phone number";
    case "SHARED_SIM":
      return language === "th" ? "พบใช้งาน/บันทึก SIM เดียวกัน" : "Found recorded using the same SIM";
    case "SHARED_DEVICE":
      return language === "th" ? "พบใช้งาน/บันทึกอุปกรณ์ (IMEI) เดียวกัน" : "Found recorded using the same device (IMEI)";
    case "SHARED_VEHICLE":
      return language === "th" ? "พบใช้งาน/บันทึกยานพาหนะเดียวกัน" : "Found recorded using the same vehicle";
  }
}

/** Section 11: an INFERRED edge must always visually/textually distinguish itself from a verified relationship. */
export function drugGraphEdgeKindLabel(edgeKind: DrugGraphEdge["edgeKind"], language: "th" | "en"): string {
  if (edgeKind === "INFERRED") {
    return language === "th" ? "ความเชื่อมโยงที่อนุมานจากข้อมูล" : "Connection inferred from data";
  }
  return language === "th" ? "ความเชื่อมโยงโดยตรงจากข้อมูล" : "Direct connection from recorded data";
}
