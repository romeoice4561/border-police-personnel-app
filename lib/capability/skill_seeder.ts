/**
 * Skill catalog seeder (Phase 44 — Personnel Capability Intelligence).
 *
 * Idempotently upserts the SkillCategory / Skill / SkillLevel master data from
 * lib/capability/skill_catalog.ts, keyed on each row's stable `code`. Safe to
 * run repeatedly (a second run creates nothing, only updates display fields).
 * Mirrors the Phase 24A master_data_seeder convention — pure, dependency-
 * injected over a delegate surface so a test can inject an in-memory fake.
 *
 * Additive only: touches exclusively the new skill master tables.
 */

import { SKILL_CATALOG, SKILL_LEVELS } from "@/lib/capability/skill_catalog";

interface SeedDelegate {
  findUnique(args: { where: Record<string, unknown> }): Promise<{ id: number } | null>;
  create(args: { data: Record<string, unknown> }): Promise<{ id: number }>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ id: number }>;
}

export interface SkillSeederClient {
  skillCategory: SeedDelegate;
  skill: SeedDelegate;
  skillLevel: SeedDelegate;
}

export interface SeedTableSummary {
  table: string;
  created: number;
  updated: number;
  total: number;
}

/** Upserts one row by `code`, returning its id and whether it was created. */
async function upsertByCode(
  delegate: SeedDelegate,
  code: string,
  data: Record<string, unknown>
): Promise<{ id: number; created: boolean }> {
  const existing = await delegate.findUnique({ where: { code } });
  if (existing) {
    await delegate.update({ where: { code }, data });
    return { id: existing.id, created: false };
  }
  const row = await delegate.create({ data: { code, ...data } });
  return { id: row.id, created: true };
}

/**
 * Seeds levels, categories, and skills. Categories are upserted first so each
 * skill can resolve its categoryId. Returns a per-table summary.
 */
export async function seedSkillCatalog(client: SkillSeederClient): Promise<SeedTableSummary[]> {
  let levelCreated = 0;
  for (const level of SKILL_LEVELS) {
    const { created } = await upsertByCode(client.skillLevel, level.code, {
      nameTh: level.nameTh,
      nameEn: level.nameEn,
      rank: level.rank,
      active: true,
    });
    if (created) levelCreated += 1;
  }

  let categoryCreated = 0;
  let skillCreated = 0;
  let skillTotal = 0;
  let categorySort = 0;
  for (const category of SKILL_CATALOG) {
    categorySort += 1;
    const { id: categoryId, created } = await upsertByCode(client.skillCategory, category.code, {
      nameTh: category.nameTh,
      nameEn: category.nameEn,
      icon: category.icon,
      sortOrder: categorySort,
      active: true,
    });
    if (created) categoryCreated += 1;

    let skillSort = 0;
    for (const skill of category.skills) {
      skillSort += 1;
      skillTotal += 1;
      const { created: skillWasCreated } = await upsertByCode(client.skill, skill.code, {
        categoryId,
        nameTh: skill.nameTh,
        nameEn: skill.nameEn,
        searchableKeywords: skill.keywords ?? "",
        requiresCertificate: skill.requiresCertificate ?? false,
        hasExpiry: skill.hasExpiry ?? false,
        sortOrder: skillSort,
        active: true,
      });
      if (skillWasCreated) skillCreated += 1;
    }
  }

  return [
    { table: "SkillLevel", created: levelCreated, updated: SKILL_LEVELS.length - levelCreated, total: SKILL_LEVELS.length },
    { table: "SkillCategory", created: categoryCreated, updated: SKILL_CATALOG.length - categoryCreated, total: SKILL_CATALOG.length },
    { table: "Skill", created: skillCreated, updated: skillTotal - skillCreated, total: skillTotal },
  ];
}
