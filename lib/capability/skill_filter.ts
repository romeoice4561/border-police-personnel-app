/**
 * Skill signal derivation + Commander Search matching (Phase 44).
 *
 * Pure functions — no I/O, no React, no engine coupling. `toSkillSignals`
 * turns an officer's loaded OfficerSkill rows into the compact
 * OfficerSkillSignal[] the read model attaches to each CommanderQueryOfficer;
 * `matchesSkillFilter` decides whether an officer's signals satisfy a skill
 * filter. Both are shared by Commander Search and the dashboard so "who has
 * this skill" is answered identically everywhere (and is future-AI ready).
 */

import { CERT_EXPIRING_SOON_DAYS, type OfficerSkillSignal } from "@/lib/capability/capability_types";
import { EXPERT_LEVEL_RANK, INSTRUCTOR_LEVEL_RANK } from "@/lib/capability/skill_catalog";
import type { OfficerSkillWithRelations } from "@/lib/database/query_types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** True when `expiry` is set and falls within `withinDays` from `asOf` (and not already long past — an expired cert still counts as "needs attention"). */
export function isExpiringSoon(expiry: Date | null | undefined, asOf: Date, withinDays = CERT_EXPIRING_SOON_DAYS): boolean {
  if (!expiry) return false;
  const days = (new Date(expiry).getTime() - asOf.getTime()) / MS_PER_DAY;
  return days <= withinDays; // includes already-expired (days < 0)
}

/** Derives the compact per-officer skill signals from loaded OfficerSkill rows. */
export function toSkillSignals(rows: readonly OfficerSkillWithRelations[], asOf: Date = new Date()): OfficerSkillSignal[] {
  return rows.map((row) => {
    const levelRank = row.level?.rank ?? null;
    const hasCertificate = Boolean(row.certificateNumber && row.certificateNumber.trim().length > 0);
    return {
      skillId: row.skillId,
      skillCode: row.skill.code,
      categoryId: row.skill.categoryId,
      levelRank,
      yearsExperience: row.yearsExperience ?? null,
      verified: row.verified,
      hasCertificate,
      certificateExpiringSoon: hasCertificate && isExpiringSoon(row.expiryDate, asOf),
      availableForDeployment: row.availableForDeployment,
      isExpert: levelRank != null && levelRank >= EXPERT_LEVEL_RANK,
      isInstructor: levelRank != null && levelRank >= INSTRUCTOR_LEVEL_RANK,
    };
  });
}

/** A Commander Search skill filter. Every field optional — omitted = not constrained. All present constraints must be met by the SAME skill signal. */
export interface SkillFilter {
  categoryId?: number;
  skillId?: number;
  /** Minimum proficiency level rank (1..7); the matching skill's level must be >= this. */
  minLevelRank?: number;
  verified?: boolean;
  hasCertificate?: boolean;
  certificateExpiringSoon?: boolean;
  availableForDeployment?: boolean;
  isExpert?: boolean;
  isInstructor?: boolean;
  /** Minimum years of experience on the matching skill. */
  minYearsExperience?: number;
}

/** True when the filter is empty (no constraints) — callers can skip work. */
export function isEmptySkillFilter(filter: SkillFilter): boolean {
  return (
    filter.categoryId == null &&
    filter.skillId == null &&
    filter.minLevelRank == null &&
    filter.verified == null &&
    filter.hasCertificate == null &&
    filter.certificateExpiringSoon == null &&
    filter.availableForDeployment == null &&
    filter.isExpert == null &&
    filter.isInstructor == null &&
    filter.minYearsExperience == null
  );
}

/** Does a single skill signal satisfy every present constraint in `filter`? */
function signalMatches(sig: OfficerSkillSignal, filter: SkillFilter): boolean {
  if (filter.categoryId != null && sig.categoryId !== filter.categoryId) return false;
  if (filter.skillId != null && sig.skillId !== filter.skillId) return false;
  if (filter.minLevelRank != null && (sig.levelRank == null || sig.levelRank < filter.minLevelRank)) return false;
  if (filter.verified === true && !sig.verified) return false;
  if (filter.hasCertificate === true && !sig.hasCertificate) return false;
  if (filter.certificateExpiringSoon === true && !sig.certificateExpiringSoon) return false;
  if (filter.availableForDeployment === true && !sig.availableForDeployment) return false;
  if (filter.isExpert === true && !sig.isExpert) return false;
  if (filter.isInstructor === true && !sig.isInstructor) return false;
  if (filter.minYearsExperience != null && (sig.yearsExperience == null || sig.yearsExperience < filter.minYearsExperience)) return false;
  return true;
}

/**
 * True when the officer (via their skill signals) matches the filter. An empty
 * filter matches everyone. A non-empty filter requires at least ONE skill
 * signal that satisfies EVERY present constraint (so "Chinese, Excellent,
 * deployment-ready" must all hold for the same skill, not spread across skills).
 */
export function matchesSkillFilter(signals: readonly OfficerSkillSignal[], filter: SkillFilter): boolean {
  if (isEmptySkillFilter(filter)) return true;
  return signals.some((sig) => signalMatches(sig, filter));
}
