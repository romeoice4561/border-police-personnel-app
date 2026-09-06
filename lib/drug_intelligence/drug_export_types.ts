/**
 * DI-10B export contracts — types only. Generators for Case / Commander /
 * Map / Network reports are deferred.
 */

export const DRUG_EXPORT_TYPES = [
  "OPERATIONAL_CASES",
  "OPERATIONAL_PERSONS",
  "OPERATIONAL_ALERTS",
  "CASE_REPORT",
  "COMMANDER_REPORT",
  "MAP_DATA",
  "NETWORK_DATA",
  "BOARD_DATA",
] as const;
export type DrugExportType = (typeof DRUG_EXPORT_TYPES)[number];

export const DRUG_EXPORT_FORMATS = ["CSV", "JSON", "HTML_PRINT"] as const;
export type DrugExportFormat = (typeof DRUG_EXPORT_FORMATS)[number];

export const DRUG_EXPORT_PRESETS = ["MINIMAL", "OPERATIONAL", "INTELLIGENCE", "CUSTOM"] as const;
export type DrugExportPreset = (typeof DRUG_EXPORT_PRESETS)[number];

export const DRUG_EXPORT_MASKING_MODES = ["MASKED", "FULL"] as const;
export type DrugExportMaskingMode = (typeof DRUG_EXPORT_MASKING_MODES)[number];

export const DRUG_EXPORT_INTENTS = ["PREVIEW", "DOWNLOAD"] as const;
export type DrugExportIntent = (typeof DRUG_EXPORT_INTENTS)[number];

/** Fields that Custom/Intelligence must never expose through column selection. */
export const DRUG_EXPORT_RESTRICTED_COLUMNS = [
  "phone",
  "nationalId",
  "passport",
  "alienId",
  "imsi",
  "iccid",
  "imei",
  "vin",
  "plate",
  "latitude",
  "longitude",
  "coordinates",
  "imageUrl",
  "signedUrl",
  "annotationText",
] as const;
export type DrugExportRestrictedColumn = (typeof DRUG_EXPORT_RESTRICTED_COLUMNS)[number];

export const OPERATIONAL_CASES_COLUMNS = [
  { key: "caseId", labelTh: "รหัสคดี", labelEn: "Case ID" },
  { key: "caseNumber", labelTh: "เลขคดี", labelEn: "Case number" },
  { key: "title", labelTh: "ชื่อเรื่อง", labelEn: "Title" },
  { key: "status", labelTh: "สถานะ", labelEn: "Status" },
  { key: "arrestDate", labelTh: "วันที่จับกุม", labelEn: "Arrest date" },
  { key: "province", labelTh: "จังหวัด", labelEn: "Province" },
  { key: "reportingUnit", labelTh: "หน่วยรายงาน", labelEn: "Reporting unit" },
  { key: "leadUnit", labelTh: "หน่วยจับกุมหลัก", labelEn: "Lead unit" },
  { key: "createdAt", labelTh: "วันที่สร้าง", labelEn: "Created at" },
] as const;

export type OperationalCasesColumnKey = (typeof OPERATIONAL_CASES_COLUMNS)[number]["key"];

export const OPERATIONAL_PERSONS_COLUMNS = [
  { key: "personId", labelTh: "รหัสบุคคล", labelEn: "Person ID" },
  { key: "displayName", labelTh: "ชื่อที่แสดง", labelEn: "Display name" },
  { key: "status", labelTh: "สถานะ", labelEn: "Status" },
  { key: "caseCount", labelTh: "จำนวนคดี", labelEn: "Case count" },
  { key: "createdAt", labelTh: "วันที่สร้าง", labelEn: "Created at" },
] as const;

export type OperationalPersonsColumnKey = (typeof OPERATIONAL_PERSONS_COLUMNS)[number]["key"];

export const CASE_REPORT_SECTIONS = [
  "case",
  "people",
  "phones",
  "sims",
  "devices",
  "vehicles",
  "locations",
  "seizures",
] as const;
export type CaseReportSectionKey = (typeof CASE_REPORT_SECTIONS)[number];

export interface DrugExportPreviewColumn {
  key: string;
  label: string;
}

export interface DrugExportPreviewV1 {
  exportType: DrugExportType;
  format: DrugExportFormat;
  locale: "th" | "en";
  contextSummary: Record<string, string | number | boolean | null>;
  estimatedRecordCount: number | null;
  softLimit: number;
  hardLimit: number;
  columns: DrugExportPreviewColumn[];
  presets: DrugExportPreset[];
  maskingMode: DrugExportMaskingMode;
  warnings: string[];
  implemented: boolean;
}
