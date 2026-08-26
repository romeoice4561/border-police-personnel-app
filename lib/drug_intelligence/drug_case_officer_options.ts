/**
 * DI-7.6: arrest-team officer roles and participating-unit roles.
 *
 * Both are closed vocabularies (real Postgres enums — DrugCaseOfficerRole /
 * DrugCaseUnitRole), matching DRUG_CASE_PERSON_ROLES / DRUG_CASE_STATUSES'
 * established pattern for genuinely closed sets (contrast
 * DRUG_NETWORK_ROLES, which stays a free string because criminal-network
 * roles are an open/emergent vocabulary).
 *
 * Pure data — no I/O, no React.
 */

export const DRUG_CASE_OFFICER_ROLES = [
  "ARREST_TEAM_LEAD",
  "ARRESTING_OFFICER",
  "INVESTIGATOR",
  "INTELLIGENCE_OFFICER",
  "CASE_COORDINATOR",
  "EVIDENCE_OFFICER",
  "SUPPORT",
  "OTHER",
] as const;
export type DrugCaseOfficerRole = (typeof DRUG_CASE_OFFICER_ROLES)[number];

export const DRUG_CASE_OFFICER_ROLE_LABELS: Record<DrugCaseOfficerRole, { labelTh: string; labelEn: string }> = {
  ARREST_TEAM_LEAD:     { labelTh: "หัวหน้าชุดจับกุม",                labelEn: "Arrest Team Lead"          },
  ARRESTING_OFFICER:    { labelTh: "เจ้าหน้าที่ผู้จับกุม",             labelEn: "Arresting Officer"         },
  INVESTIGATOR:         { labelTh: "พนักงานสอบสวน / ผู้รับผิดชอบคดี", labelEn: "Investigator"              },
  INTELLIGENCE_OFFICER: { labelTh: "เจ้าหน้าที่ข่าวกรอง",             labelEn: "Intelligence Officer"      },
  CASE_COORDINATOR:     { labelTh: "ผู้ประสานงานคดี",                labelEn: "Case Coordinator"          },
  EVIDENCE_OFFICER:     { labelTh: "ผู้รับผิดชอบของกลาง/พยานหลักฐาน", labelEn: "Evidence Officer"          },
  SUPPORT:              { labelTh: "สนับสนุนการปฏิบัติ",             labelEn: "Support"                   },
  OTHER:                { labelTh: "อื่น ๆ",                        labelEn: "Other"                     },
};

export function isValidDrugCaseOfficerRole(value: string): value is DrugCaseOfficerRole {
  return (DRUG_CASE_OFFICER_ROLES as readonly string[]).includes(value);
}

export const DRUG_CASE_UNIT_ROLES = [
  "LEAD",
  "PARTICIPATING",
  "INVESTIGATION_SUPPORT",
  "INTELLIGENCE_SUPPORT",
  "OTHER",
] as const;
export type DrugCaseUnitRole = (typeof DRUG_CASE_UNIT_ROLES)[number];

export const DRUG_CASE_UNIT_ROLE_LABELS: Record<DrugCaseUnitRole, { labelTh: string; labelEn: string }> = {
  LEAD:                   { labelTh: "หน่วยจับกุมหลัก",   labelEn: "Lead Arrest Unit"        },
  PARTICIPATING:          { labelTh: "หน่วยร่วมจับกุม",   labelEn: "Participating Unit"      },
  INVESTIGATION_SUPPORT:  { labelTh: "สนับสนุนการสอบสวน", labelEn: "Investigation Support"   },
  INTELLIGENCE_SUPPORT:   { labelTh: "สนับสนุนข่าวกรอง",  labelEn: "Intelligence Support"    },
  OTHER:                  { labelTh: "อื่น ๆ",           labelEn: "Other"                   },
};

export function isValidDrugCaseUnitRole(value: string): value is DrugCaseUnitRole {
  return (DRUG_CASE_UNIT_ROLES as readonly string[]).includes(value);
}
