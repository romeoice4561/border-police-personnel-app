/**
 * Selectable police / joint drug-enforcement organizations for Create Case.
 *
 * Labels are copied exactly from docs/reference/หน่วยที่ชอบจับยา.txt.
 * This is a suggestion list only — selecting a label stores free text and
 * never creates an organization master row, reporting unit, or lead arrest
 * unit.
 */

export const JOINT_DRUG_ENFORCEMENT_ORG_GROUPS: Readonly<Record<string, readonly string[]>> = {
  "สำนักงานตำรวจแห่งชาติ (บช. และหน่วยเทียบเท่า)": [
    "บช.น.",
    "ภ.1",
    "ภ.2",
    "ภ.3",
    "ภ.4",
    "ภ.5",
    "ภ.6",
    "ภ.7",
    "ภ.8",
    "ภ.9",
    "บช.ก.",
    "บช.ปส.",
    "บช.ส.",
    "บช.ตชด.",
    "สตม.",
    "บช.ทท.",
    "บช.สอท.",
    "บช.ศ.",
    "รร.นรต.",
    "สพฐ.ตร.",
    "รพ.ตร.",
    "สกพ.",
    "สกบ.",
    "สยศ.ตร.",
    "สงป.",
    "กมค.",
    "สทส.",
    "จต.",
    "สง.ก.ตร.",
  ],
  "หน่วยงานร่วมบูรณาการปราบปรามยาเสพติด": [
    "สำนักงาน ป.ป.ส.",
    "กรมการปกครอง",
    "กองอาสารักษาดินแดน (อส.)",
    "กองทัพบก",
    "กองทัพเรือ",
    "กองทัพอากาศ",
    "ศรชล.",
    "กรมศุลกากร",
    "กรมราชทัณฑ์",
    "กรมสอบสวนคดีพิเศษ (DSI)",
  ],
};

export const JOINT_DRUG_ENFORCEMENT_ORG_LABELS: readonly string[] = Object.values(JOINT_DRUG_ENFORCEMENT_ORG_GROUPS).flat();

export function isJointDrugEnforcementOrgLabel(value: string): boolean {
  return JOINT_DRUG_ENFORCEMENT_ORG_LABELS.includes(value.trim());
}
