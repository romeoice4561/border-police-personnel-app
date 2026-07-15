/**
 * Capability domain types (Phase 44 — Personnel Capability Intelligence).
 *
 * Framework-free view models shared by the profile UI, Commander Search, and
 * the dashboard so they all describe skills identically. Pure types — no I/O,
 * no React.
 */

/** A proficiency level as the UI/search consume it. */
export interface SkillLevelView {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  rank: number;
}

/** One skill within a category. */
export interface SkillView {
  id: number;
  code: string;
  categoryId: number;
  nameTh: string;
  nameEn: string;
  searchableKeywords: string;
  requiresCertificate: boolean;
  hasExpiry: boolean;
}

/** A category with its skills, for the accordion + filter option lists. */
export interface SkillCategoryView {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string;
  icon: string | null;
  skills: SkillView[];
}

/** The whole seeded catalog — categories (with skills) + levels — loaded once for the UI/options. */
export interface SkillCatalog {
  categories: SkillCategoryView[];
  levels: SkillLevelView[];
}

/**
 * A compact, precomputed per-officer skill signal used by Commander Search and
 * the dashboard so they can filter/aggregate without re-querying. Derived from
 * OfficerSkill + its skill/category/level (read model, no engine).
 */
export interface OfficerSkillSignal {
  skillId: number;
  skillCode: string;
  categoryId: number;
  levelRank: number | null;
  yearsExperience: number | null;
  verified: boolean;
  hasCertificate: boolean;
  /** Certificate present, has an expiry date, and it falls within the "expiring soon" window. */
  certificateExpiringSoon: boolean;
  availableForDeployment: boolean;
  isExpert: boolean;
  isInstructor: boolean;
}

/** Days-ahead window that counts a certificate as "expiring soon" for search/dashboard. */
export const CERT_EXPIRING_SOON_DAYS = 90;
