/**
 * Master Data seed values (Phase 24A — Database V2 Foundation).
 *
 * Static, standard reference data defined by MASTER_DATA.md. These are the
 * closed, well-known lists (ranks, positions, timeline types, asset types,
 * document types, regions) — NOT the large, data-derived organization tree
 * (commands / subdivisions / companies) which is populated from real source
 * data in a later dedicated migration phase, never invented here.
 *
 * Pure data only — no DB access. The seed script (scripts/seed_master_data.ts)
 * upserts each list by `code`, so applying this twice is a no-op (idempotent).
 *
 * Codes are stable identifiers and must never change once seeded (they are the
 * idempotent upsert key). Rank `level` orders ranks numerically (never by text
 * comparison — DATABASE_V2_DESIGN §22).
 */

import type {
  MasterRegionInput,
  MasterRankInput,
  MasterPositionInput,
  MasterTimelineTypeInput,
  MasterAssetTypeInput,
  MasterDocumentTypeInput,
} from "@/lib/database/repositories/master_data_repositories";

/** Regions (ภาค) — MASTER_DATA "Region" + DATABASE_V2_DESIGN §17. */
export const SEED_REGIONS: MasterRegionInput[] = [
  { code: "REGION_1", nameTh: "ภาค 1", displayOrder: 1 },
  { code: "REGION_2", nameTh: "ภาค 2", displayOrder: 2 },
  { code: "REGION_3", nameTh: "ภาค 3", displayOrder: 3 },
  { code: "REGION_4", nameTh: "ภาค 4", displayOrder: 4 },
  { code: "REGION_SOUTH", nameTh: "ภาคใต้", displayOrder: 5 },
  { code: "REGION_SBPP", nameTh: "ศชต.", displayOrder: 6 },
];

/**
 * Ranks (ยศ) — MASTER_DATA "Rank". `level` is ascending seniority (used for
 * ordering/comparison instead of text). ชั้นประทวน (non-commissioned) then
 * สัญญาบัตร (commissioned).
 */
// displayOrder mirrors `level` so listActive() (which orders by displayOrder)
// renders ranks in seniority order — DATABASE_V2_DESIGN §22 orders ranks by level.
export const SEED_RANKS: MasterRankInput[] = [
  { code: "RANK_POL_CONST", nameTh: "พลตำรวจ", abbreviation: "พลฯ", level: 1, groupName: "ชั้นประทวน", displayOrder: 1 },
  { code: "RANK_LCPL", nameTh: "สิบตำรวจตรี", abbreviation: "ส.ต.ต.", level: 2, groupName: "ชั้นประทวน", displayOrder: 2 },
  { code: "RANK_CPL", nameTh: "สิบตำรวจโท", abbreviation: "ส.ต.ท.", level: 3, groupName: "ชั้นประทวน", displayOrder: 3 },
  { code: "RANK_SGT", nameTh: "สิบตำรวจเอก", abbreviation: "ส.ต.อ.", level: 4, groupName: "ชั้นประทวน", displayOrder: 4 },
  { code: "RANK_SEN_SGT", nameTh: "จ่าสิบตำรวจ", abbreviation: "จ.ส.ต.", level: 5, groupName: "ชั้นประทวน", displayOrder: 5 },
  { code: "RANK_SGT_MAJOR", nameTh: "ดาบตำรวจ", abbreviation: "ด.ต.", level: 6, groupName: "ชั้นประทวน", displayOrder: 6 },
  { code: "RANK_SUB_LT", nameTh: "ร้อยตำรวจตรี", abbreviation: "ร.ต.ต.", level: 7, groupName: "สัญญาบัตร", displayOrder: 7 },
  { code: "RANK_LT", nameTh: "ร้อยตำรวจโท", abbreviation: "ร.ต.ท.", level: 8, groupName: "สัญญาบัตร", displayOrder: 8 },
  { code: "RANK_CAPT", nameTh: "ร้อยตำรวจเอก", abbreviation: "ร.ต.อ.", level: 9, groupName: "สัญญาบัตร", displayOrder: 9 },
  { code: "RANK_MAJOR", nameTh: "พันตำรวจตรี", abbreviation: "พ.ต.ต.", level: 10, groupName: "สัญญาบัตร", displayOrder: 10 },
  { code: "RANK_LT_COL", nameTh: "พันตำรวจโท", abbreviation: "พ.ต.ท.", level: 11, groupName: "สัญญาบัตร", displayOrder: 11 },
  { code: "RANK_COL", nameTh: "พันตำรวจเอก", abbreviation: "พ.ต.อ.", level: 12, groupName: "สัญญาบัตร", displayOrder: 12 },
  { code: "RANK_POL_MAJ_GEN", nameTh: "พลตำรวจตรี", abbreviation: "พล.ต.ต.", level: 13, groupName: "สัญญาบัตร", displayOrder: 13 },
  { code: "RANK_POL_LT_GEN", nameTh: "พลตำรวจโท", abbreviation: "พล.ต.ท.", level: 14, groupName: "สัญญาบัตร", displayOrder: 14 },
  { code: "RANK_POL_GEN", nameTh: "พลตำรวจเอก", abbreviation: "พล.ต.อ.", level: 15, groupName: "สัญญาบัตร", displayOrder: 15 },
];

/** Positions (ตำแหน่ง) — MASTER_DATA "Position" + DATABASE_V2_DESIGN §23. */
export const SEED_POSITIONS: MasterPositionInput[] = [
  { code: "POS_DEP_SQUAD_LEADER", nameTh: "รอง ผบ.หมู่", displayOrder: 1 },
  { code: "POS_SQUAD_LEADER", nameTh: "ผบ.หมู่", displayOrder: 2 },
  { code: "POS_DEP_INSPECTOR", nameTh: "รอง สว.", displayOrder: 3 },
  { code: "POS_INSPECTOR", nameTh: "สว.", displayOrder: 4 },
  { code: "POS_DEP_SUPT", nameTh: "รอง ผกก.", displayOrder: 5 },
  { code: "POS_SUPT", nameTh: "ผกก.", displayOrder: 6 },
  { code: "POS_DEP_COMMANDER", nameTh: "รอง ผบก.", displayOrder: 7 },
  { code: "POS_COMMANDER", nameTh: "ผบก.", displayOrder: 8 },
];

/** Timeline event types — MASTER_DATA "Timeline Event Type" + §37. */
export const SEED_TIMELINE_TYPES: MasterTimelineTypeInput[] = [
  { code: "TL_APPOINTMENT", nameTh: "แต่งตั้ง", nameEn: "Appointment", displayOrder: 1 },
  { code: "TL_TRANSFER", nameTh: "ย้ายหน่วย", nameEn: "Transfer", displayOrder: 2 },
  { code: "TL_PROMOTION", nameTh: "เลื่อนตำแหน่ง", nameEn: "Promotion", displayOrder: 3 },
  { code: "TL_RANK_CHANGE", nameTh: "เลื่อนยศ", nameEn: "Rank Change", displayOrder: 4 },
  { code: "TL_SALARY", nameTh: "เงินเดือน", nameEn: "Salary Change", displayOrder: 5 },
  { code: "TL_EDUCATION", nameTh: "การศึกษา", nameEn: "Education", displayOrder: 6 },
  { code: "TL_TRAINING", nameTh: "ฝึกอบรม", nameEn: "Training", displayOrder: 7 },
  { code: "TL_AWARD", nameTh: "รางวัล", nameEn: "Award", displayOrder: 8 },
  { code: "TL_CERTIFICATE", nameTh: "ใบประกาศ", nameEn: "Certificate", displayOrder: 9 },
  { code: "TL_RETIREMENT", nameTh: "เกษียณ", nameEn: "Retirement", displayOrder: 10 },
  { code: "TL_RESIGNATION", nameTh: "ลาออก", nameEn: "Resignation", displayOrder: 11 },
  { code: "TL_LEAVE", nameTh: "ลา", nameEn: "Leave", displayOrder: 12 },
  { code: "TL_DISCIPLINARY", nameTh: "วินัย", nameEn: "Disciplinary", displayOrder: 13 },
  { code: "TL_SPECIAL_ASSIGN", nameTh: "ปฏิบัติหน้าที่พิเศษ", nameEn: "Special Assignment", displayOrder: 14 },
  { code: "TL_MISSION", nameTh: "ภารกิจ", nameEn: "Mission", displayOrder: 15 },
  { code: "TL_OTHER", nameTh: "อื่นๆ", nameEn: "Other", displayOrder: 16 },
];

/** Asset types — MASTER_DATA "Asset Type" + DATABASE_V2_DESIGN §51. */
export const SEED_ASSET_TYPES: MasterAssetTypeInput[] = [
  { code: "ASSET_PORTRAIT", nameTh: "รูปประจำตัว", nameEn: "Portrait", displayOrder: 1 },
  { code: "ASSET_TIMELINE", nameTh: "ไทม์ไลน์", nameEn: "Timeline", displayOrder: 2 },
  { code: "ASSET_GP7", nameTh: "ก.พ.7", nameEn: "GP7", displayOrder: 3 },
  { code: "ASSET_CERTIFICATE", nameTh: "ใบประกาศ", nameEn: "Certificate", displayOrder: 4 },
  { code: "ASSET_APPOINTMENT_ORDER", nameTh: "คำสั่งแต่งตั้ง", nameEn: "Appointment Order", displayOrder: 5 },
  { code: "ASSET_TRAINING", nameTh: "หลักสูตร", nameEn: "Training", displayOrder: 6 },
  { code: "ASSET_AWARD", nameTh: "รางวัล", nameEn: "Award", displayOrder: 7 },
  { code: "ASSET_MAP", nameTh: "แผนที่", nameEn: "Map", displayOrder: 8 },
  { code: "ASSET_ORG_CHART", nameTh: "ผังองค์กร", nameEn: "Organization Chart", displayOrder: 9 },
  { code: "ASSET_REPORT", nameTh: "รายงาน", nameEn: "Report", displayOrder: 10 },
  { code: "ASSET_PRESENTATION", nameTh: "งานนำเสนอ", nameEn: "Presentation", displayOrder: 11 },
  { code: "ASSET_DOCUMENT", nameTh: "เอกสาร", nameEn: "Document", displayOrder: 12 },
  { code: "ASSET_VIDEO", nameTh: "วิดีโอ", nameEn: "Video", displayOrder: 13 },
  { code: "ASSET_IMAGE", nameTh: "รูปภาพ", nameEn: "Image", displayOrder: 14 },
  { code: "ASSET_SPREADSHEET", nameTh: "ตาราง", nameEn: "Spreadsheet", displayOrder: 15 },
  { code: "ASSET_OTHER", nameTh: "อื่นๆ", nameEn: "Other", displayOrder: 16 },
];

/** Document types — MASTER_DATA "Document Type" + DATABASE_V2_DESIGN §52. */
export const SEED_DOCUMENT_TYPES: MasterDocumentTypeInput[] = [
  { code: "DOC_GP7", nameTh: "ก.พ.7", nameEn: "GP7", displayOrder: 1 },
  { code: "DOC_APPOINTMENT_ORDER", nameTh: "คำสั่งแต่งตั้ง", nameEn: "Appointment Order", displayOrder: 2 },
  { code: "DOC_TRANSFER_ORDER", nameTh: "คำสั่งย้าย", nameEn: "Transfer Order", displayOrder: 3 },
  { code: "DOC_SERVICE_RECORD", nameTh: "ประวัติราชการ", nameEn: "Service Record", displayOrder: 4 },
  { code: "DOC_EDUCATION", nameTh: "วุฒิการศึกษา", nameEn: "Education Certificate", displayOrder: 5 },
  { code: "DOC_TRAINING", nameTh: "หลักสูตร", nameEn: "Training", displayOrder: 6 },
  { code: "DOC_CERTIFICATE", nameTh: "ใบประกาศ", nameEn: "Certificate", displayOrder: 7 },
  { code: "DOC_ROYAL_DECORATION", nameTh: "เครื่องราช", nameEn: "Royal Decoration", displayOrder: 8 },
  { code: "DOC_OFFICIAL_LETTER", nameTh: "หนังสือราชการ", nameEn: "Official Letter", displayOrder: 9 },
  { code: "DOC_REPORT", nameTh: "รายงาน", nameEn: "Report", displayOrder: 10 },
  { code: "DOC_OTHER", nameTh: "อื่นๆ", nameEn: "Other", displayOrder: 11 },
];
