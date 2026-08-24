/**
 * DrugCasePerson.role, DrugPersonIdentifier.type options, and new
 * DI-7.2/7.3 person intelligence option sets.
 *
 * Pure data — no I/O, no React.
 */

export const DRUG_CASE_PERSON_ROLES = ["SUSPECT", "ACCUSED", "ARRESTED_PERSON", "ASSOCIATED_PERSON", "WITNESS", "OTHER"] as const;
export type DrugCasePersonRole = (typeof DRUG_CASE_PERSON_ROLES)[number];

export const DRUG_CASE_PERSON_ROLE_LABELS: Record<DrugCasePersonRole, { labelTh: string; labelEn: string }> = {
  SUSPECT: { labelTh: "ผู้ต้องสงสัย", labelEn: "Suspect" },
  ACCUSED: { labelTh: "ผู้ถูกกล่าวหา", labelEn: "Accused" },
  ARRESTED_PERSON: { labelTh: "ผู้ถูกจับกุม", labelEn: "Arrested Person" },
  ASSOCIATED_PERSON: { labelTh: "ผู้เกี่ยวข้อง", labelEn: "Associated Person" },
  WITNESS: { labelTh: "พยาน", labelEn: "Witness" },
  OTHER: { labelTh: "อื่น ๆ", labelEn: "Other" },
};

export function isValidDrugCasePersonRole(value: string): value is DrugCasePersonRole {
  return (DRUG_CASE_PERSON_ROLES as readonly string[]).includes(value);
}

export const DRUG_PERSON_IDENTIFIER_TYPES = ["THAI_ID", "PASSPORT", "ALIEN_ID", "OTHER", "UNKNOWN"] as const;
export type DrugPersonIdentifierType = (typeof DRUG_PERSON_IDENTIFIER_TYPES)[number];

export const DRUG_PERSON_IDENTIFIER_TYPE_LABELS: Record<DrugPersonIdentifierType, { labelTh: string; labelEn: string }> = {
  THAI_ID: { labelTh: "เลขบัตรประชาชน", labelEn: "Thai National ID" },
  PASSPORT: { labelTh: "หนังสือเดินทาง", labelEn: "Passport" },
  ALIEN_ID: { labelTh: "เลขประจำตัวคนต่างด้าว", labelEn: "Alien ID" },
  OTHER: { labelTh: "อื่น ๆ", labelEn: "Other" },
  UNKNOWN: { labelTh: "ยังไม่ทราบตัวตน", labelEn: "Unknown" },
};

export function isValidDrugPersonIdentifierType(value: string): value is DrugPersonIdentifierType {
  return (DRUG_PERSON_IDENTIFIER_TYPES as readonly string[]).includes(value);
}

// ── DI-7.2: Sex ───────────────────────────────────────────────────────────────

export const DRUG_PERSON_SEX_OPTIONS = ["MALE", "FEMALE", "UNKNOWN"] as const;
export type DrugPersonSex = (typeof DRUG_PERSON_SEX_OPTIONS)[number];

export const DRUG_PERSON_SEX_LABELS: Record<DrugPersonSex, { labelTh: string; labelEn: string }> = {
  MALE:    { labelTh: "ชาย",        labelEn: "Male"    },
  FEMALE:  { labelTh: "หญิง",       labelEn: "Female"  },
  UNKNOWN: { labelTh: "ไม่ทราบ",    labelEn: "Unknown" },
};

export function isValidDrugPersonSex(value: string): value is DrugPersonSex {
  return (DRUG_PERSON_SEX_OPTIONS as readonly string[]).includes(value);
}

// ── DI-7.3: Network Role taxonomy ────────────────────────────────────────────

export const DRUG_NETWORK_ROLES = [
  "COURIER",
  "RUNNER",
  "RETAIL_DEALER",
  "WHOLESALE_DEALER",
  "USER",
  "SUPPLIER",
  "COORDINATOR",
  "STORAGE",
  "FINANCE",
  "ACCOUNT_MULE",
  "VEHICLE_PROVIDER",
  "LOCATION_PROVIDER",
  "OTHER",
] as const;
export type DrugNetworkRole = (typeof DRUG_NETWORK_ROLES)[number];

export const DRUG_NETWORK_ROLE_LABELS: Record<DrugNetworkRole, { labelTh: string; labelEn: string }> = {
  COURIER:           { labelTh: "นักบิน / คนส่งยา",         labelEn: "Courier / Drug Runner"     },
  RUNNER:            { labelTh: "เด็กเดินยา",                 labelEn: "Street Runner"             },
  RETAIL_DEALER:     { labelTh: "ผู้ค้ารายย่อย",              labelEn: "Retail Dealer"             },
  WHOLESALE_DEALER:  { labelTh: "ผู้ค้ารายใหญ่",              labelEn: "Wholesale Dealer"          },
  USER:              { labelTh: "ผู้เสพ",                    labelEn: "User / Consumer"           },
  SUPPLIER:          { labelTh: "ผู้จัดหา / ต้นทาง",          labelEn: "Supplier / Source"         },
  COORDINATOR:       { labelTh: "ผู้ประสานงาน",              labelEn: "Coordinator"               },
  STORAGE:           { labelTh: "ผู้พักยา / เก็บยา",          labelEn: "Storage / Stash Keeper"    },
  FINANCE:           { labelTh: "ผู้รับเงิน / การเงิน",       labelEn: "Finance / Money Handler"   },
  ACCOUNT_MULE:      { labelTh: "เจ้าของบัญชี / บัญชีม้า",   labelEn: "Account Mule"              },
  VEHICLE_PROVIDER:  { labelTh: "ผู้จัดหายานพาหนะ",          labelEn: "Vehicle Provider"          },
  LOCATION_PROVIDER: { labelTh: "ผู้จัดหาสถานที่",           labelEn: "Location Provider"         },
  OTHER:             { labelTh: "อื่น ๆ",                    labelEn: "Other"                     },
};

export function isValidDrugNetworkRole(value: string): value is DrugNetworkRole {
  return (DRUG_NETWORK_ROLES as readonly string[]).includes(value);
}

// ── DI-7.3: Network Role Provenance Source ────────────────────────────────────

export const DRUG_NETWORK_ROLE_SOURCES = [
  "DIRECT_ARREST",
  "TESTIMONY",
  "INVESTIGATION",
  "DOCUMENT",
  "OTHER_SOURCE",
  "UNKNOWN",
] as const;
export type DrugNetworkRoleSource = (typeof DRUG_NETWORK_ROLE_SOURCES)[number];

export const DRUG_NETWORK_ROLE_SOURCE_LABELS: Record<DrugNetworkRoleSource, { labelTh: string; labelEn: string }> = {
  DIRECT_ARREST: { labelTh: "จับกุม / ตรวจพบโดยตรง",          labelEn: "Direct Arrest / Detection"     },
  TESTIMONY:     { labelTh: "คำให้การ / ถูกซัดทอด",           labelEn: "Testimony / Accusation"        },
  INVESTIGATION: { labelTh: "ข้อมูลการสืบสวน",               labelEn: "Investigation Data"            },
  DOCUMENT:      { labelTh: "เอกสาร / ข้อมูลคดีเดิม",         labelEn: "Document / Prior Case Record"  },
  OTHER_SOURCE:  { labelTh: "แหล่งข้อมูลอื่น",                labelEn: "Other Source"                  },
  UNKNOWN:       { labelTh: "ไม่ทราบ",                        labelEn: "Unknown"                       },
};

// ── DI-7.3: Verification Status ───────────────────────────────────────────────

export const DRUG_NETWORK_ROLE_VERIFICATION_STATUSES = ["UNVERIFIED", "SUPPORTED", "CONFIRMED"] as const;
export type DrugNetworkRoleVerificationStatus = (typeof DRUG_NETWORK_ROLE_VERIFICATION_STATUSES)[number];

export const DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS: Record<DrugNetworkRoleVerificationStatus, { labelTh: string; labelEn: string }> = {
  UNVERIFIED: { labelTh: "ยังไม่ยืนยัน",           labelEn: "Unverified"            },
  SUPPORTED:  { labelTh: "มีข้อมูลสนับสนุน",        labelEn: "Supported by Evidence" },
  CONFIRMED:  { labelTh: "ยืนยันจากคดี/หลักฐาน",   labelEn: "Confirmed"             },
};

export function isValidDrugNetworkRoleVerificationStatus(value: string): value is DrugNetworkRoleVerificationStatus {
  return (DRUG_NETWORK_ROLE_VERIFICATION_STATUSES as readonly string[]).includes(value);
}
