/**
 * Phase 52.2.1 — Centralized Thai display labels for Commander Workforce UI.
 * Presentation only. Does not change ViewModel values or filter keys.
 */

import {
  WORKFORCE_PROMOTION_STATUSES,
  WORKFORCE_RETIREMENT_LABEL_TH,
  WORKFORCE_RETIREMENT_WINDOWS,
  type WorkforcePromotionStatus,
} from "@/lib/commander_workforce/contracts";
import type { WorkforceFilterOption } from "@/lib/commander_workforce/types";

/** Executive-facing promotion labels (Phase 52.2.2 — mutually exclusive meanings). */
export const UI_PROMOTION_LABEL_TH: Record<WorkforcePromotionStatus, string> = {
  EligibleThisYear: "พร้อมเลื่อนปีนี้",
  AlreadyEligible: "ครบคุณสมบัติก่อนปีนี้",
  Waiting: "อยู่ระหว่างรอ",
  MissingTraining: "ขาดหลักสูตร",
  MissingDocuments: "ขาดเอกสาร",
  RetirementRestricted: "จำกัดจากการเกษียณ",
  NotEligible: "ยังไม่ถึงเกณฑ์",
  Unknown: "ไม่ทราบข้อมูล",
};

export const UI_QUALIFIED_NOW_LABEL_TH = "ผู้มีคุณสมบัติครบทั้งหมด";


export const UI_TRAINING_LABEL_TH: Record<string, string> = {
  Complete: "หลักสูตรครบ",
  MissingRequired: "ขาดหลักสูตรบังคับ",
  ExpiringSoon: "ใกล้ครบกำหนด",
  Expired: "หมดอายุ",
  Unverified: "ยังไม่ยืนยัน",
  NoPolicy: "ยังไม่มีนโยบายหลักสูตร",
  NoData: "ข้อมูลไม่เพียงพอ",
  Unknown: "ไม่ทราบข้อมูล",
};

export const UI_DOCUMENT_LABEL_TH: Record<string, string> = {
  complete: "เอกสารครบ",
  incomplete: "เอกสารไม่ครบ",
  expiring: "ใกล้หมดอายุ",
  expired: "หมดอายุ",
  missing_required: "ขาดเอกสารสำคัญ",
  unknown: "ไม่ทราบข้อมูล",
};

export const UI_DATA_QUALITY_FILTER_LABEL_TH: Record<string, string> = {
  profile_incomplete: "ข้อมูลประจำตัวไม่ครบ",
  missing_portrait: "ไม่มีรูปเครื่องแบบ",
  documents_missing: "ขาดข้อมูลเอกสาร",
  needs_training: "ขาดข้อมูลหลักสูตร",
  promotion_unknown: "หลักฐานเลื่อนตำแหน่งไม่ชัด",
  clean: "ข้อมูลครบถ้วน",
};

export const UI_RETIREMENT_LABEL_TH: Record<string, string> = {
  ...WORKFORCE_RETIREMENT_LABEL_TH,
  unknown: "ไม่ทราบข้อมูล",
};

const PROMOTION_SET = new Set<string>(WORKFORCE_PROMOTION_STATUSES);
const RETIREMENT_SET = new Set<string>(WORKFORCE_RETIREMENT_WINDOWS);

/** Map a raw status / window / filter value to Thai for display. */
export function labelStatusTh(kind: "promotion" | "retirement" | "training" | "document" | "dataQuality", value: string): string {
  if (kind === "promotion") return UI_PROMOTION_LABEL_TH[value as WorkforcePromotionStatus] ?? "ไม่ทราบข้อมูล";
  if (kind === "retirement") return UI_RETIREMENT_LABEL_TH[value] ?? value;
  if (kind === "training") return UI_TRAINING_LABEL_TH[value] ?? value;
  if (kind === "document") return UI_DOCUMENT_LABEL_TH[value] ?? value;
  return UI_DATA_QUALITY_FILTER_LABEL_TH[value] ?? value;
}

/** Ensure company labels read as ร้อย ตชด.xxx */
export function formatCompanyLabelTh(labelOrCode: string): string {
  const t = labelOrCode.trim();
  if (!t) return t;
  if (/^ร้อย\s/.test(t)) return t;
  if (/^ตชด\./.test(t) || /^\d+$/.test(t)) return `ร้อย ตชด.${t.replace(/^ตชด\./, "")}`;
  if (/ตชด\.\d+/.test(t) && !t.includes("ร้อย")) {
    const m = t.match(/ตชด\.\d+/);
    if (m) return `ร้อย ${m[0]}`;
  }
  return t;
}

export function formatDivisionLabelTh(labelOrCode: string): string {
  const t = labelOrCode.trim();
  if (!t) return t;
  if (/^กก/.test(t) || t.includes("กองกำกับการ")) return t;
  if (/^\d+$/.test(t)) return `กก.ตชด.${t}`;
  return t;
}

export function formatRegionLabelTh(labelOrCode: string): string {
  const t = labelOrCode.trim();
  if (!t) return t;
  if (t.includes("ภาค") || t.includes("ตชด.")) return t;
  if (/^\d+$/.test(t)) return `ตชด.ภาค ${t}`;
  return t;
}

export function formatPositionLevelLabelTh(value: string): string {
  if (value === "Unknown" || value === "unknown") return "ไม่ทราบระดับตำแหน่ง";
  return value;
}

/** Relabel filter options for display; values (keys) unchanged for URL/filter logic. */
export function presentFilterOptions(
  kind: "region" | "division" | "company" | "rank" | "positionLevel" | "promotion" | "retirement" | "training" | "document" | "dataQuality",
  options: readonly WorkforceFilterOption[]
): WorkforceFilterOption[] {
  return options.map((opt) => {
    let labelTh = opt.labelTh;
    switch (kind) {
      case "company":
        labelTh = formatCompanyLabelTh(opt.labelTh || opt.value);
        break;
      case "division":
        labelTh = formatDivisionLabelTh(opt.labelTh || opt.value);
        break;
      case "region":
        labelTh = formatRegionLabelTh(opt.labelTh || opt.value);
        break;
      case "positionLevel":
        labelTh = formatPositionLevelLabelTh(opt.value);
        break;
      case "promotion":
        labelTh = labelStatusTh("promotion", opt.value);
        break;
      case "retirement":
        labelTh = labelStatusTh("retirement", opt.value);
        break;
      case "training":
        labelTh = labelStatusTh("training", opt.value);
        break;
      case "document":
        labelTh = labelStatusTh("document", opt.value);
        break;
      case "dataQuality":
        labelTh = labelStatusTh("dataQuality", opt.value);
        break;
      default:
        break;
    }
    return { ...opt, labelTh };
  });
}

/** Strip/replace raw English enums in ViewModel copy before showing to executives. */
export function sanitizeExecutiveCopy(text: string | null | undefined): string {
  if (!text) return "";
  let out = text;
  for (const status of WORKFORCE_PROMOTION_STATUSES) {
    out = out.split(status).join(UI_PROMOTION_LABEL_TH[status]);
  }
  for (const key of WORKFORCE_RETIREMENT_WINDOWS) {
    out = out.split(key).join(UI_RETIREMENT_LABEL_TH[key] ?? key);
  }
  for (const [en, th] of Object.entries(UI_TRAINING_LABEL_TH)) {
    out = out.split(en).join(th);
  }
  out = out.replace(/PromotionSummary\./g, "");
  out = out.replace(/TrainingSummary\./g, "");
  out = out.replace(/\bUnknown\b/g, "ไม่ทราบข้อมูล");
  out = out.replace(/สถานะ\s+/g, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

export function promotionLabelTh(status: string): string {
  if (PROMOTION_SET.has(status)) return UI_PROMOTION_LABEL_TH[status as WorkforcePromotionStatus];
  return sanitizeExecutiveCopy(status) || "ไม่ทราบข้อมูล";
}

export function retirementLabelTh(key: string): string {
  if (RETIREMENT_SET.has(key)) return UI_RETIREMENT_LABEL_TH[key] ?? key;
  return key;
}

/** Map training metric key like training:Complete → Thai. */
export function trainingMetricLabelTh(key: string, fallback: string): string {
  const status = key.replace(/^training:/, "");
  if (UI_TRAINING_LABEL_TH[status]) return UI_TRAINING_LABEL_TH[status];
  const cleaned = sanitizeExecutiveCopy(fallback);
  return cleaned || fallback || status;
}

export function documentMetricLabelTh(key: string, fallback: string): string {
  const status = key.replace(/^documents:/, "");
  if (UI_DOCUMENT_LABEL_TH[status]) return UI_DOCUMENT_LABEL_TH[status];
  const cleaned = sanitizeExecutiveCopy(fallback);
  return cleaned || fallback || status;
}
