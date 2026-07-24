/**
 * Commander Promotion Intelligence CSV export (Phase 50).
 * UTF-8 BOM + metadata preamble + filtered/selected rows. No xlsx/pdf libs.
 */
import type { CommanderPromotionFilterState, PreparedPromotionRow } from "@/lib/commander_promotion/types";
import { EXECUTIVE_BUCKET_LABEL_TH, PRIORITY_LABEL_TH } from "@/lib/commander_promotion/types";
import { countActiveFilters } from "@/lib/commander_promotion/filter_rows";

const COLUMNS_TH = [
  "ยศ",
  "ชื่อ–สกุล",
  "ตำแหน่งปัจจุบัน",
  "เป้าหมาย",
  "ภาค",
  "กองกำกับการ",
  "กองร้อย",
  "เริ่มดำรงระดับ (พ.ศ.)",
  "ดำรงมาแล้ว (ปี)",
  "เกณฑ์ (ปี)",
  "เหลือ",
  "ความพร้อม (%)",
  "ครบคุณสมบัติครั้งแรก",
  "รอบ",
  "สถานะ",
  "ความสำคัญ",
  "เกษียณ (พ.ศ.)",
  "สิ่งที่ควรดำเนินการ",
  "รหัสเจ้าหน้าที่",
] as const;

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function describeFilters(filter: CommanderPromotionFilterState): string {
  if (countActiveFilters(filter) === 0) return "ทั้งหมด";
  const parts: string[] = [];
  if (filter.regionKey) parts.push(`ภาค:${filter.regionKey}`);
  if (filter.divisionKey) parts.push(`กก.:${filter.divisionKey}`);
  if (filter.companyKey) parts.push(`ร้อย:${filter.companyKey}`);
  if (filter.rank) parts.push(`ยศ:${filter.rank}`);
  if (filter.bucket) parts.push(EXECUTIVE_BUCKET_LABEL_TH[filter.bucket]);
  if (filter.priority) parts.push(`ความสำคัญ:${PRIORITY_LABEL_TH[filter.priority]}`);
  if (filter.eligibleYear != null) parts.push(`ปีที่มีสิทธิ์:${filter.eligibleYear}`);
  if (filter.eligibleYearMin != null || filter.eligibleYearMax != null) {
    parts.push(`ปีที่มีสิทธิ์ ${filter.eligibleYearMin ?? "…"}–${filter.eligibleYearMax ?? "…"}`);
  }
  if (filter.retirementWindow) parts.push(`เกษียณ:${filter.retirementWindow}`);
  if (filter.blocker) parts.push(`ข้อจำกัด:${filter.blocker}`);
  if (filter.dataQuality) parts.push(`คุณภาพข้อมูล:${filter.dataQuality}`);
  if (filter.promotionReadyOnly) parts.push("พร้อมเลื่อนระดับ");
  if (filter.search.trim()) parts.push(`ค้นหา:${filter.search.trim()}`);
  return parts.join(" · ");
}

function rowCells(row: PreparedPromotionRow): string[] {
  return [
    row.rankLabel,
    row.fullName,
    row.currentPositionLabel,
    row.targetPositionLabel ?? "",
    row.regionLabel,
    row.divisionLabel,
    row.companyLabel,
    row.positionLevelStartYearBe != null ? String(row.positionLevelStartYearBe) : "",
    row.completedTenureYears != null ? String(row.completedTenureYears) : "",
    row.requiredTenureYears != null ? String(row.requiredTenureYears) : "",
    row.remainingTenureLabel,
    row.readinessPercent != null ? String(row.readinessPercent) : "",
    row.firstEligibleYearBe != null ? String(row.firstEligibleYearBe) : "",
    row.cycleLabel ?? "",
    row.statusLabelTh,
    PRIORITY_LABEL_TH[row.priorityBand],
    row.retirementYearBe != null ? String(row.retirementYearBe) : "",
    row.recommendedActionTh,
    row.officerId,
  ];
}

export interface PromotionExportMeta {
  organizationLabel: string;
  appointmentYearBe: number;
  generatedDateTh: string;
  filter: CommanderPromotionFilterState;
  recordCount: number;
}

export function buildCommanderPromotionCsv(rows: readonly PreparedPromotionRow[], meta: PromotionExportMeta): string {
  const lines: string[] = [];
  lines.push(csvCell("Commander Promotion Intelligence Report"));
  lines.push(csvCell(`รายงานข่าวกรองการเลื่อนระดับตำแหน่ง`));
  lines.push(csvCell(`หน่วยงาน: ${meta.organizationLabel}`));
  lines.push(csvCell(`ปีที่มีสิทธิ์พิจารณา (พ.ศ.): ${meta.appointmentYearBe}`));
  lines.push(csvCell(`วันที่สร้าง: ${meta.generatedDateTh}`));
  lines.push(csvCell(`ตัวกรองที่ใช้: ${describeFilters(meta.filter)}`));
  lines.push(csvCell(`จำนวนรายการ: ${meta.recordCount}`));
  lines.push("");
  lines.push(COLUMNS_TH.map(csvCell).join(","));
  for (const row of rows) {
    lines.push(rowCells(row).map(csvCell).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function promotionCsvFilename(appointmentYearBe: number): string {
  return `commander-promotion-${appointmentYearBe}.csv`;
}
