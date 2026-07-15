/**
 * SkillCatalogRepository (Phase 44 — Personnel Capability Intelligence).
 *
 * Read-only access to the seeded skill master data (categories, skills,
 * levels), assembled into the SkillCatalog view the profile accordion, the
 * Commander Search filter, and the dashboard all consume. Only ACTIVE rows are
 * returned, ordered by their sortOrder/rank for a stable UI.
 *
 * Pure data access — no business logic.
 */

import type { ReadDatabaseClient, SkillCategory, Skill, SkillLevel } from "@/lib/database/query_types";
import type { SkillCatalog } from "@/lib/capability/capability_types";

export class SkillCatalogRepository {
  constructor(private readonly db: ReadDatabaseClient) {}

  /** Loads the whole active catalog (categories with their skills, plus levels), ordered for display. */
  async getCatalog(): Promise<SkillCatalog> {
    const [categories, skills, levels] = await Promise.all([
      this.db.skillCategory.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }) as Promise<SkillCategory[]>,
      this.db.skill.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }) as Promise<Skill[]>,
      this.db.skillLevel.findMany({ where: { active: true }, orderBy: { rank: "asc" } }) as Promise<SkillLevel[]>,
    ]);

    const skillsByCategory = new Map<number, Skill[]>();
    for (const s of skills) {
      const list = skillsByCategory.get(s.categoryId) ?? [];
      list.push(s);
      skillsByCategory.set(s.categoryId, list);
    }

    return {
      categories: categories.map((c) => ({
        id: c.id,
        code: c.code,
        nameTh: c.nameTh,
        nameEn: c.nameEn,
        icon: c.icon,
        skills: (skillsByCategory.get(c.id) ?? []).map((s) => ({
          id: s.id,
          code: s.code,
          categoryId: s.categoryId,
          nameTh: s.nameTh,
          nameEn: s.nameEn,
          searchableKeywords: s.searchableKeywords,
          requiresCertificate: s.requiresCertificate,
          hasExpiry: s.hasExpiry,
        })),
      })),
      levels: levels.map((l) => ({ id: l.id, code: l.code, nameTh: l.nameTh, nameEn: l.nameEn, rank: l.rank })),
    };
  }
}
