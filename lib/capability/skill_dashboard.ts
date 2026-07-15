/**
 * Skill dashboard analytics (Phase 44 — Personnel Capability Intelligence).
 *
 * Pure aggregation over officers' loaded skills — no I/O, no React, no engine
 * coupling. Gives commanders an immediate view of capability coverage and
 * shortages: top skills, language speakers, AI/Drone experts, all instructors,
 * medical/legal/IT/PR staff, certificates expiring soon, skill coverage, and
 * deployment-ready count. Category/skill membership is decided by the stable
 * seed codes in skill_catalog.ts (not display names), so the buckets are
 * language-independent and stable.
 */

import { toSkillSignals } from "@/lib/capability/skill_filter";
import type { OfficerWithRelations } from "@/lib/database/query_types";

/** One "top skill" row: the skill and how many officers hold it. */
export interface TopSkillEntry {
  skillId: number;
  skillCode: string;
  nameTh: string;
  nameEn: string;
  count: number;
}

export interface SkillDashboardData {
  /** Officers with at least one recorded skill. */
  officersWithSkills: number;
  /** Total officers considered (for coverage %). */
  totalOfficers: number;
  /** Distinct officers ready to deploy on at least one skill. */
  deploymentReady: number;
  /** Distinct officers with a certificate expiring soon (or already expired). */
  certificatesExpiringSoon: number;
  languageSpeakers: number;
  aiExperts: number;
  droneExperts: number;
  instructors: number;
  medicalStaff: number;
  legalStaff: number;
  itStaff: number;
  prStaff: number;
  topSkills: TopSkillEntry[];
}

/** Category codes (from skill_catalog.ts) used for the staff buckets. */
const CATEGORY_LANGUAGE = "LANGUAGE";
const CATEGORY_MEDICAL = "MEDICAL";
const CATEGORY_LEGAL = "LEGAL";
const CATEGORY_TECH = "TECH";
const CATEGORY_MEDIA = "MEDIA";

/** Skill codes for the AI / Drone expert buckets. */
const AI_SKILL_CODES = new Set(["TECH_AI"]);
const DRONE_SKILL_CODES = new Set(["TECH_DRONE", "TECH_UAV", "AVI_DRONE_PILOT", "AVI_UAV_MAPPING", "AVI_THERMAL_DRONE"]);

/**
 * Builds the dashboard aggregation. `now` is injectable for deterministic
 * "expiring soon" tests. Each staff/expert bucket counts DISTINCT officers.
 */
export function buildSkillDashboard(officers: readonly OfficerWithRelations[], now: Date = new Date()): SkillDashboardData {
  const totalOfficers = officers.length;
  let officersWithSkills = 0;
  let deploymentReady = 0;
  let certificatesExpiringSoon = 0;
  let languageSpeakers = 0;
  let aiExperts = 0;
  let droneExperts = 0;
  let instructors = 0;
  let medicalStaff = 0;
  let legalStaff = 0;
  let itStaff = 0;
  let prStaff = 0;

  // For top skills: skillId -> { count, code, names }.
  const skillCounts = new Map<number, TopSkillEntry>();

  for (const officer of officers) {
    const rows = officer.skills ?? [];
    if (rows.length === 0) continue;
    officersWithSkills += 1;

    const signals = toSkillSignals(rows, now);
    const categoryCodes = new Set(rows.map((r) => r.skill.category.code));

    if (signals.some((s) => s.availableForDeployment)) deploymentReady += 1;
    if (signals.some((s) => s.certificateExpiringSoon)) certificatesExpiringSoon += 1;
    if (signals.some((s) => s.isInstructor)) instructors += 1;
    if (categoryCodes.has(CATEGORY_LANGUAGE)) languageSpeakers += 1;
    if (categoryCodes.has(CATEGORY_MEDICAL)) medicalStaff += 1;
    if (categoryCodes.has(CATEGORY_LEGAL)) legalStaff += 1;
    if (categoryCodes.has(CATEGORY_TECH)) itStaff += 1;
    if (categoryCodes.has(CATEGORY_MEDIA)) prStaff += 1;
    if (signals.some((s) => AI_SKILL_CODES.has(s.skillCode) && s.isExpert)) aiExperts += 1;
    if (signals.some((s) => DRONE_SKILL_CODES.has(s.skillCode) && s.isExpert)) droneExperts += 1;

    for (const row of rows) {
      const entry = skillCounts.get(row.skillId) ?? {
        skillId: row.skillId,
        skillCode: row.skill.code,
        nameTh: row.skill.nameTh,
        nameEn: row.skill.nameEn,
        count: 0,
      };
      entry.count += 1;
      skillCounts.set(row.skillId, entry);
    }
  }

  const topSkills = [...skillCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  return {
    officersWithSkills,
    totalOfficers,
    deploymentReady,
    certificatesExpiringSoon,
    languageSpeakers,
    aiExperts,
    droneExperts,
    instructors,
    medicalStaff,
    legalStaff,
    itStaff,
    prStaff,
    topSkills,
  };
}
