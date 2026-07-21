/**
 * Document Category Registry (Phase 46 — Electronic Personnel File Foundation).
 *
 * Groups document TYPES (lib/document/document_types.ts) into CATEGORIES for
 * the e-PF document center. Purely a presentation/grouping layer over the
 * existing type registry — adds no schema, no new DB columns. A document's
 * category is always derived from its `documentType` code via this mapping,
 * never stored redundantly.
 *
 * Also extends the built-in type registry with the additional codes the e-PF
 * spec requires (Training/Education/Awards/Medical/Firearms/Evaluation/
 * Salary/Pension) that the original Phase 29A registry didn't cover yet —
 * registered the same extensible way any future type would be.
 */

import { registerDocumentType, type DocumentTypeDefinition } from "@/lib/document/document_types";

export interface DocumentCategoryDefinition {
  code: string;
  labelTh: string;
  labelEn: string;
  /** Type codes (from the document type registry) that belong to this category. */
  typeCodes: readonly string[];
}

// Register the e-PF spec's additional document types (idempotent — safe to
// call at module load even if already registered elsewhere).
const EPF_ADDITIONAL_TYPES: readonly DocumentTypeDefinition[] = [
  { code: "TRAINING_CERTIFICATE", labelTh: "เอกสารการฝึกอบรม", labelEn: "Training Certificate" },
  { code: "EDUCATION_CERTIFICATE", labelTh: "วุฒิการศึกษา", labelEn: "Education Certificate" },
  { code: "AWARD", labelTh: "เกียรติบัตรและรางวัล", labelEn: "Award" },
  { code: "MEDICAL_DOCUMENT", labelTh: "เอกสารทางการแพทย์", labelEn: "Medical Document" },
  { code: "FIREARMS_QUALIFICATION", labelTh: "ผลทดสอบอาวุธปืน", labelEn: "Firearms Qualification" },
  { code: "ANNUAL_EVALUATION", labelTh: "แบบประเมินผลประจำปี", labelEn: "Annual Evaluation" },
  { code: "SALARY_DOCUMENT", labelTh: "เอกสารเงินเดือน", labelEn: "Salary Document" },
  { code: "PENSION_DOCUMENT", labelTh: "เอกสารบำเหน็จบำนาญ", labelEn: "Pension Document" },
];

for (const def of EPF_ADDITIONAL_TYPES) {
  registerDocumentType(def);
}

/** Ordered category list — UI renders categories in this order. */
export const DOCUMENT_CATEGORIES: readonly DocumentCategoryDefinition[] = [
  {
    code: "IDENTITY",
    labelTh: "เอกสารประจำตัว",
    labelEn: "Identity Documents",
    typeCodes: ["NATIONAL_ID", "DRIVER_LICENSE", "HOUSE_REGISTRATION", "PASSPORT"],
  },
  {
    code: "OFFICIAL_PERSONNEL",
    labelTh: "เอกสารราชการ",
    labelEn: "Official Personnel Documents",
    typeCodes: ["OFFICER_CARD", "MILITARY_RECORD", "GP7", "APPOINTMENT_ORDER"],
  },
  {
    code: "EDUCATION",
    labelTh: "การศึกษา",
    labelEn: "Education",
    typeCodes: ["EDUCATION_CERTIFICATE", "CERTIFICATE"],
  },
  {
    code: "TRAINING",
    labelTh: "การฝึกอบรม",
    labelEn: "Training",
    typeCodes: ["TRAINING_CERTIFICATE"],
  },
  {
    code: "AWARDS",
    labelTh: "เกียรติบัตรและรางวัล",
    labelEn: "Awards",
    typeCodes: ["AWARD"],
  },
  {
    code: "MEDICAL",
    labelTh: "การแพทย์",
    labelEn: "Medical",
    typeCodes: ["MEDICAL_DOCUMENT"],
  },
  {
    code: "FINANCIAL",
    labelTh: "การเงิน",
    labelEn: "Financial",
    typeCodes: ["SALARY_DOCUMENT", "PENSION_DOCUMENT"],
  },
  {
    code: "WEAPONS_QUALIFICATION",
    labelTh: "การทดสอบอาวุธปืน",
    labelEn: "Weapons Qualification",
    typeCodes: ["FIREARMS_QUALIFICATION", "ANNUAL_EVALUATION"],
  },
  {
    code: "MISCELLANEOUS",
    labelTh: "เอกสารอื่น ๆ",
    labelEn: "Miscellaneous",
    typeCodes: ["OTHER"],
  },
];

const UNCATEGORIZED: DocumentCategoryDefinition = {
  code: "MISCELLANEOUS",
  labelTh: "เอกสารอื่น ๆ",
  labelEn: "Miscellaneous",
  typeCodes: [],
};

/** Resolves the category a document type code belongs to. Unknown/custom codes fall back to Miscellaneous. */
export function categoryForTypeCode(typeCode: string): DocumentCategoryDefinition {
  return DOCUMENT_CATEGORIES.find((cat) => cat.typeCodes.includes(typeCode)) ?? UNCATEGORIZED;
}

/** All categories, in display order. */
export function getDocumentCategories(): readonly DocumentCategoryDefinition[] {
  return DOCUMENT_CATEGORIES;
}
