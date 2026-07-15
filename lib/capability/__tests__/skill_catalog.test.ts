import { test } from "node:test";
import assert from "node:assert/strict";

import { SKILL_CATALOG, SKILL_LEVELS, TOTAL_SKILL_COUNT, EXPERT_LEVEL_RANK, INSTRUCTOR_LEVEL_RANK } from "@/lib/capability/skill_catalog";
import { seedSkillCatalog, type SkillSeederClient } from "@/lib/capability/skill_seeder";

// Phase 44 — skill catalog + idempotent seeder.

test("there are exactly 7 proficiency levels, ranked 1..7 lowest → highest", () => {
  assert.equal(SKILL_LEVELS.length, 7);
  assert.deepEqual(SKILL_LEVELS.map((l) => l.rank), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(SKILL_LEVELS[0].nameTh, "พื้นฐาน");
  assert.equal(SKILL_LEVELS.at(-1)!.nameTh, "ครูฝึก / วิทยากร");
  assert.equal(EXPERT_LEVEL_RANK, 6);
  assert.equal(INSTRUCTOR_LEVEL_RANK, 7);
});

test("all 11 spec categories are present, each with an icon and at least one skill", () => {
  assert.equal(SKILL_CATALOG.length, 11);
  const codes = SKILL_CATALOG.map((c) => c.code);
  for (const expected of ["LEGAL", "TECH", "LANGUAGE", "TACTICAL", "MEDICAL", "AVIATION", "MECHANIC", "SPORTS", "MEDIA", "MUSIC", "OTHER"]) {
    assert.ok(codes.includes(expected), `missing category ${expected}`);
  }
  for (const c of SKILL_CATALOG) {
    assert.ok(c.icon.length > 0, `${c.code} missing icon`);
    assert.ok(c.skills.length > 0, `${c.code} has no skills`);
  }
});

test("every skill and category has a non-empty bilingual name and a unique code", () => {
  const codes = new Set<string>();
  for (const c of SKILL_CATALOG) {
    assert.ok(c.nameTh.length > 0 && c.nameEn.length > 0, `${c.code} bilingual name`);
    for (const s of c.skills) {
      assert.ok(s.nameTh.length > 0 && s.nameEn.length > 0, `${s.code} bilingual name`);
      assert.equal(codes.has(s.code), false, `duplicate skill code ${s.code}`);
      codes.add(s.code);
    }
  }
  assert.equal(codes.size, TOTAL_SKILL_COUNT);
});

test("spec-critical skills exist for future AI queries (Chinese, AI, Drone, TCCC, instructor, legal)", () => {
  const allSkills = SKILL_CATALOG.flatMap((c) => c.skills.map((s) => s.code));
  for (const code of ["LANG_ZH", "TECH_AI", "AVI_DRONE_PILOT", "TAC_TCCC", "TECH_POWERBI", "TECH_GRAPHIC", "MEDIA_MC", "MECH_ENGINE", "LEGAL_BARRISTER"]) {
    assert.ok(allSkills.includes(code), `missing spec skill ${code}`);
  }
});

// ── Idempotent seeder over an in-memory fake ──

function makeFake(): SkillSeederClient & { rows: Record<string, Array<{ id: number; code: string; [k: string]: unknown }>> } {
  const rows: Record<string, Array<{ id: number; code: string; [k: string]: unknown }>> = {
    skillCategory: [],
    skill: [],
    skillLevel: [],
  };
  let nextId = 1;
  const makeDelegate = (table: string) => ({
    async findUnique(args: { where: Record<string, unknown> }) {
      return rows[table].find((r) => r.code === args.where.code) ?? null;
    },
    async create(args: { data: Record<string, unknown> }) {
      const row = { id: nextId++, ...(args.data as { code: string }) };
      rows[table].push(row);
      return row;
    },
    async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const row = rows[table].find((r) => r.code === args.where.code)!;
      Object.assign(row, args.data);
      return row;
    },
  });
  return { rows, skillCategory: makeDelegate("skillCategory"), skill: makeDelegate("skill"), skillLevel: makeDelegate("skillLevel") };
}

test("seeder creates every level/category/skill on first run", async () => {
  const fake = makeFake();
  const summary = await seedSkillCatalog(fake);
  assert.equal(fake.rows.skillLevel.length, 7);
  assert.equal(fake.rows.skillCategory.length, 11);
  assert.equal(fake.rows.skill.length, TOTAL_SKILL_COUNT);
  assert.equal(summary.find((s) => s.table === "Skill")!.created, TOTAL_SKILL_COUNT);
});

test("seeder is idempotent — a second run creates nothing, only updates", async () => {
  const fake = makeFake();
  await seedSkillCatalog(fake);
  const second = await seedSkillCatalog(fake);
  assert.equal(fake.rows.skill.length, TOTAL_SKILL_COUNT); // no duplicates
  assert.equal(fake.rows.skillCategory.length, 11);
  for (const t of second) {
    assert.equal(t.created, 0, `${t.table} created on 2nd run`);
    assert.equal(t.updated, t.total);
  }
});

test("seeder resolves each skill's categoryId to a real seeded category", async () => {
  const fake = makeFake();
  await seedSkillCatalog(fake);
  const categoryIds = new Set(fake.rows.skillCategory.map((c) => c.id));
  for (const s of fake.rows.skill) {
    assert.ok(categoryIds.has(s.categoryId as number), `skill ${s.code} has dangling categoryId`);
  }
});
