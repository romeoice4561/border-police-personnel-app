/**
 * Network graph client-side label lookups (Phase DI-5, Sections 11, 30).
 *
 * Pure lookup maps from the typed contract to i18n keys — mirrors
 * drug_search_match_explanation.ts's convention exactly: the UI never
 * invents wording, it only maps a typed value to a TranslationKey. Every
 * relationship label uses neutral language ("พบเกี่ยวข้องกับ", "พบในคดี",
 * "พบใช้งาน/บันทึกร่วมกัน") — never "เป็นเจ้าของ" or "เครือข่ายผู้ร่วมขบวนการ".
 */

import type { DrugGraphNodeType, DrugGraphRelationshipType, DrugGraphEdgeExplanation } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const DRUG_GRAPH_NODE_TYPE_LABEL_KEY: Record<DrugGraphNodeType, TranslationKey> = {
  PERSON: "di.network.groupPerson",
  PHONE: "di.network.groupPhone",
  SIM: "di.network.groupSim",
  DEVICE: "di.network.groupDevice",
  VEHICLE: "di.network.groupVehicle",
  CASE: "di.network.groupCase",
  LOCATION: "di.network.groupLocation",
};

export const DRUG_GRAPH_RELATIONSHIP_LABEL_KEY: Record<DrugGraphRelationshipType, TranslationKey> = {
  PERSON_CASE: "di.network.relPersonCase",
  PERSON_PHONE: "di.network.relPersonPhone",
  PERSON_SIM: "di.network.relPersonSim",
  PERSON_DEVICE: "di.network.relPersonDevice",
  PERSON_VEHICLE: "di.network.relPersonVehicle",
  CASE_PHONE: "di.network.relCasePhone",
  CASE_SIM: "di.network.relCaseSim",
  CASE_DEVICE: "di.network.relCaseDevice",
  CASE_VEHICLE: "di.network.relCaseVehicle",
  CASE_LOCATION: "di.network.relCaseLocation",
  SHARED_CASE: "di.network.relSharedCase",
  SHARED_PHONE: "di.network.relSharedPhone",
  SHARED_SIM: "di.network.relSharedSim",
  SHARED_DEVICE: "di.network.relSharedDevice",
  SHARED_VEHICLE: "di.network.relSharedVehicle",
};

/**
 * Phase DI-5.1, Section 4: a short canvas-safe label per relationship type
 * — the full label (DRUG_GRAPH_RELATIONSHIP_LABEL_KEY) can run long once
 * translated ("พบใช้งาน/บันทึกยานพาหนะเดียวกัน"), which destroys canvas
 * readability on a dense graph. The edge on the canvas uses this short
 * form; the FULL explanation remains available in the edge detail drawer
 * (drug_network_edge_detail.tsx uses explainDrugGraphEdgeClient, not this
 * map) — this never changes graph semantics, only what's painted on the
 * SVG label.
 */
export const DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY: Record<DrugGraphRelationshipType, TranslationKey> = {
  PERSON_CASE: "di.network.relShortCase",
  PERSON_PHONE: "di.network.relShortPhone",
  PERSON_SIM: "di.network.relShortSim",
  PERSON_DEVICE: "di.network.relShortDevice",
  PERSON_VEHICLE: "di.network.relShortVehicle",
  CASE_PHONE: "di.network.relShortPhone",
  CASE_SIM: "di.network.relShortSim",
  CASE_DEVICE: "di.network.relShortDevice",
  CASE_VEHICLE: "di.network.relShortVehicle",
  CASE_LOCATION: "di.network.relShortLocation",
  SHARED_CASE: "di.network.relShortSharedCase",
  SHARED_PHONE: "di.network.relShortSharedPhone",
  SHARED_SIM: "di.network.relShortSharedSim",
  SHARED_DEVICE: "di.network.relShortSharedDevice",
  SHARED_VEHICLE: "di.network.relShortSharedVehicle",
};

/** Section 4: the filter-panel grouping — DIRECT relationships that have a real junction-table row, vs INFERRED (Person↔Person, derived, never location-based per the explicit prohibition). */
export const DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES: DrugGraphRelationshipType[] = [
  "PERSON_CASE",
  "PERSON_PHONE",
  "PERSON_SIM",
  "PERSON_DEVICE",
  "PERSON_VEHICLE",
  "CASE_PHONE",
  "CASE_SIM",
  "CASE_DEVICE",
  "CASE_VEHICLE",
  "CASE_LOCATION",
];

export const DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES: DrugGraphRelationshipType[] = ["SHARED_CASE", "SHARED_PHONE", "SHARED_SIM", "SHARED_DEVICE", "SHARED_VEHICLE"];

/** Composes the final explanation sentence from the edge's machine-readable explanation facts — never hand-written per call site. */
export function explainDrugGraphEdgeClient(explanation: DrugGraphEdgeExplanation, roleLabel: (role: string) => string, language: "th" | "en"): string {
  switch (explanation.kind) {
    case "DIRECT_ROLE":
      return language === "th" ? `พบในคดีนี้ในฐานะ${roleLabel(explanation.role)}` : `Recorded in this case as ${roleLabel(explanation.role)}`;
    case "DIRECT_LINK":
      return language === "th" ? "พบเกี่ยวข้องกับข้อมูลนี้โดยตรง" : "Directly recorded as related to this data";
    case "SHARED_CASES":
      return language === "th" ? `พบในคดีเดียวกัน ${explanation.count.toLocaleString("th-TH")} คดี` : `Found in ${explanation.count} shared case(s)`;
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
