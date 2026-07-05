/**
 * Drive content-type classification (Phase 18B).
 *
 * The new Google Drive root organizes images into SEMANTIC top-level folders
 * (personnel profiles, neighbor maps, org charts, deployment maps, company /
 * battalion location maps). Only PROFILE images should later enter the OCR →
 * OpenAI → officer-extraction pipeline; the rest become Gallery modules.
 *
 * This module classifies a top-level folder NAME into a DriveContentType so the
 * scanner can attach it to every discovered image BEFORE any processing
 * decision is made. It is pure metadata — no OCR, no OpenAI, no imports, no DB.
 *
 * Classification is by the TOP-LEVEL folder (the one directly under the scan
 * root); nested subfolders (e.g. ตชด.447 under แผนที่ตั้งกองร้อย) inherit their
 * top-level folder's content type.
 */

/** The semantic content types a top-level Drive folder can hold. */
export enum DriveContentType {
  /** Personnel profile cards — the only type that later enters OCR/OpenAI/extraction. */
  Profile = "PROFILE",
  /** Maps of neighboring units. */
  NeighborMap = "NEIGHBOR_MAP",
  /** Unit structure / organization charts. */
  OrgChart = "ORG_CHART",
  /** Force-deployment maps. */
  DeploymentMap = "DEPLOYMENT_MAP",
  /** Company (ร้อย) location maps. */
  CompanyLocation = "COMPANY_LOCATION",
  /** Battalion (กองกำกับ) location maps. */
  BattalionLocation = "BATTALION_LOCATION",
  /** Anything that matches no rule. */
  Unknown = "UNKNOWN",
}

/**
 * A single classification rule. `kind` distinguishes a prefix match ("folders
 * beginning with …") from an exact folder-name match. Rules are evaluated in
 * order; the first match wins.
 */
interface ContentTypeRule {
  kind: "prefix" | "exact";
  pattern: string;
  type: DriveContentType;
}

/**
 * The routing rules, in priority order. Prefix rules cover the "Profile … ภาค N"
 * family; the two location families are exact folder names whose children are
 * unit subfolders (ตชด.447, กก.ตชด.44). Matching is whitespace-tolerant
 * (collapsed + trimmed) so "แผนที่ตั้ง  กองกำกับ  ตชด" still matches.
 */
const RULES: ContentTypeRule[] = [
  { kind: "prefix", pattern: "Profile", type: DriveContentType.Profile },
  { kind: "prefix", pattern: "แผนที่หน่วยข้างเคียง", type: DriveContentType.NeighborMap },
  { kind: "prefix", pattern: "แผนผังโครงสร้าง", type: DriveContentType.OrgChart },
  { kind: "prefix", pattern: "แผนผังการวางกำลัง", type: DriveContentType.DeploymentMap },
  { kind: "exact", pattern: "แผนที่ตั้งกองร้อย", type: DriveContentType.CompanyLocation },
  { kind: "exact", pattern: "แผนที่ตั้ง กองกำกับ ตชด", type: DriveContentType.BattalionLocation },
];

/** Normalizes a folder name for matching: collapse internal whitespace, trim. */
function normalize(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/**
 * Classifies a TOP-LEVEL folder name into a DriveContentType. Prefix rules match
 * case-sensitively on the normalized name's start; exact rules match the whole
 * normalized name. Returns UNKNOWN when nothing matches. Pure — no side effects.
 */
export function classifyFolderContentType(folderName: string | null | undefined): DriveContentType {
  if (typeof folderName !== "string") return DriveContentType.Unknown;
  const name = normalize(folderName);
  if (name.length === 0) return DriveContentType.Unknown;

  for (const rule of RULES) {
    if (rule.kind === "prefix" && name.startsWith(rule.pattern)) return rule.type;
    if (rule.kind === "exact" && name === normalize(rule.pattern)) return rule.type;
  }
  return DriveContentType.Unknown;
}

/** True when a content type is the personnel-profile type that later enters the OCR/OpenAI pipeline. */
export function isProfileContent(type: DriveContentType): boolean {
  return type === DriveContentType.Profile;
}
