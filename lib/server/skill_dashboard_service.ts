/**
 * Skill dashboard service (Phase 44 — Personnel Capability Intelligence).
 *
 * Server seam that loads officers (with skills) and runs the pure
 * buildSkillDashboard aggregation. REUSES loadCommanderOfficerProfiles (which
 * already includes the skills relation) — no duplicated query, and the
 * Commander Intelligence engine is untouched. Server-only.
 */

import "server-only";
import { loadCommanderOfficerProfiles } from "@/lib/server/commander_intelligence_service";
import { buildSkillDashboard, type SkillDashboardData } from "@/lib/capability/skill_dashboard";

export async function getSkillDashboardData(): Promise<SkillDashboardData> {
  const officers = await loadCommanderOfficerProfiles();
  return buildSkillDashboard(officers);
}
