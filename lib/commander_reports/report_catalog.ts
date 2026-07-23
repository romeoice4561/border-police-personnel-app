/**
 * Executive report catalog — Thai-first titles/descriptions (Phase 49C).
 * Pure data; no I/O.
 */
import {
  EXECUTIVE_REPORT_TYPES,
  type ExecutiveReportType,
} from "@/lib/commander_reports/types";

export interface ReportCatalogEntry {
  type: ExecutiveReportType;
  titleTh: string;
  titleEn: string;
  subtitleTh: string;
  subtitleEn: string;
}

export const REPORT_CATALOG: readonly ReportCatalogEntry[] = [
  {
    type: "personnelSummary",
    titleTh: "สรุปกำลังพลผู้บริหาร",
    titleEn: "Personnel Executive Summary",
    subtitleTh: "ภาพรวมกำลังพลตามขอบเขตที่เลือก",
    subtitleEn: "Personnel overview for the selected scope",
  },
  {
    type: "promotionReadiness",
    titleTh: "รายงานความพร้อมเลื่อนตำแหน่ง",
    titleEn: "Promotion Readiness Report",
    subtitleTh: "กำลังพลที่ครบคุณสมบัติหรือค้างการเลื่อนตำแหน่ง",
    subtitleEn: "Officers eligible or overdue for promotion",
  },
  {
    type: "retirementForecast",
    titleTh: "พยากรณ์การเกษียณอายุราชการ",
    titleEn: "Retirement Forecast",
    subtitleTh: "กำลังพลที่ใกล้เกษียณตามขอบเขตปี",
    subtitleEn: "Officers approaching retirement",
  },
  {
    type: "documentCompleteness",
    titleTh: "รายงานความครบถ้วนของเอกสาร",
    titleEn: "Document Completeness Report",
    subtitleTh: "กำลังพลที่เอกสารยังไม่ครบ",
    subtitleEn: "Officers with incomplete required documents",
  },
  {
    type: "documentExpiry",
    titleTh: "รายงานเอกสารหมดอายุ",
    titleEn: "Document Expiry Report",
    subtitleTh: "เอกสารหมดอายุหรือใกล้หมดอายุ",
    subtitleEn: "Expired or expiring documents",
  },
  {
    type: "trainingReadiness",
    titleTh: "รายงานความพร้อมการฝึกอบรม",
    titleEn: "Training Readiness Report",
    subtitleTh: "สถานะหลักสูตรตามนโยบายที่มีอยู่",
    subtitleEn: "Training status from existing policy outputs",
  },
  {
    type: "highPriority",
    titleTh: "กำลังพลระดับความสำคัญสูง",
    titleEn: "High Priority Officers",
    subtitleTh: "priority = high หรือ critical จากระบบข่าวกรอง",
    subtitleEn: "Officers tagged high or critical priority",
  },
  {
    type: "criticalAction",
    titleTh: "รายงานการดำเนินการเร่งด่วน",
    titleEn: "Critical Action Report",
    subtitleTh: "รายการที่ต้องดำเนินการโดยผู้บังคับบัญชา",
    subtitleEn: "Actions requiring commander attention",
  },
  {
    type: "birthday",
    titleTh: "รายงานวันเกิดกำลังพล",
    titleEn: "Birthday Report",
    subtitleTh: "วันเกิดที่ใกล้ถึงภายใน 90 วัน",
    subtitleEn: "Upcoming birthdays within 90 days",
  },
  {
    type: "monthlyBrief",
    titleTh: "สรุปผู้บังคับบัญชารายเดือน",
    titleEn: "Monthly Commander Brief",
    subtitleTh: "เอกสารสรุปหนึ่งหน้าสำหรับผู้บังคับบัญชา",
    subtitleEn: "One-page commander briefing",
  },
] as const;

/** True when `value` is one of the ten registered report type ids. */
export function isExecutiveReportType(value: string): value is ExecutiveReportType {
  return (EXECUTIVE_REPORT_TYPES as readonly string[]).includes(value);
}

/**
 * Unknown / empty report ids safely fall back to Personnel Executive Summary
 * so a bad query/state never crashes the Report Center.
 */
export function resolveReportType(value: string | null | undefined): ExecutiveReportType {
  if (typeof value === "string" && isExecutiveReportType(value)) return value;
  return "personnelSummary";
}

export function getReportCatalogEntry(type: string): ReportCatalogEntry {
  const resolved = resolveReportType(type);
  const entry = REPORT_CATALOG.find((item) => item.type === resolved);
  // resolveReportType always returns a registered id — catalog entry is guaranteed.
  return entry ?? REPORT_CATALOG[0]!;
}
