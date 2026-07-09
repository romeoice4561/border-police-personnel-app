/**
 * Unit tests for the Phase 24A Master Data repositories + seeder over the
 * in-memory fake MasterDataClient — no live database.
 *
 * Run with:
 *   npx tsx --test lib/database/__tests__/master_data_repositories.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryMasterDataClient } from "@/lib/database/__tests__/in_memory_master_data_client";
import {
  MasterRegionRepository,
  MasterCommandRepository,
  MasterSubdivisionRepository,
  MasterCompanyRepository,
  MasterRankRepository,
  createMasterDataRepositories,
} from "@/lib/database/repositories/master_data_repositories";
import { seedMasterData } from "@/lib/database/master_data_seeder";
import { SEED_RANKS, SEED_REGIONS } from "@/lib/database/master_data_seed";

test("upsertByCode creates on first call and updates (no duplicate) on the second", async () => {
  const db = new InMemoryMasterDataClient();
  const repo = new MasterRegionRepository(db);

  const first = await repo.upsertByCode({ code: "REGION_1", nameTh: "ภาค 1", displayOrder: 1 });
  assert.equal(first.created, true);

  const second = await repo.upsertByCode({ code: "REGION_1", nameTh: "ภาค ๑ (แก้ไข)", displayOrder: 1 });
  assert.equal(second.created, false);

  assert.equal(await repo.count(), 1);
  const found = await repo.findByCode("REGION_1");
  assert.equal(found?.nameTh, "ภาค ๑ (แก้ไข)");
});

test("findByCode returns null for an unknown code", async () => {
  const db = new InMemoryMasterDataClient();
  const repo = new MasterRankRepository(db);
  assert.equal(await repo.findByCode("NOPE"), null);
});

test("the seeded row gets a DB-generated UUID id (not an int)", async () => {
  const db = new InMemoryMasterDataClient();
  const repo = new MasterRegionRepository(db);
  const { row } = await repo.upsertByCode({ code: "REGION_4", nameTh: "ภาค 4" });
  assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("listActive orders by displayOrder then code and excludes inactive/soft-deleted rows", async () => {
  const db = new InMemoryMasterDataClient();
  const repo = new MasterRankRepository(db);

  await repo.upsertByCode({ code: "RANK_B", nameTh: "B", level: 2, displayOrder: 2 });
  await repo.upsertByCode({ code: "RANK_A", nameTh: "A", level: 1, displayOrder: 1 });
  await repo.upsertByCode({ code: "RANK_C", nameTh: "C", level: 3, displayOrder: 3 });

  // Deactivate one and soft-delete another via the raw delegate.
  await db.masterRank.update({ where: { code: "RANK_C" }, data: { isActive: false } });
  await db.masterRank.update({ where: { code: "RANK_B" }, data: { isDeleted: true } });

  const active = await repo.listActive();
  assert.deepEqual(active.map((r) => r.code), ["RANK_A"]);
});

test("organization tree seeds by UUID FK: region -> command -> subdivision -> company", async () => {
  const db = new InMemoryMasterDataClient();
  const regions = new MasterRegionRepository(db);
  const commands = new MasterCommandRepository(db);
  const subdivisions = new MasterSubdivisionRepository(db);
  const companies = new MasterCompanyRepository(db);

  const region = (await regions.upsertByCode({ code: "REGION_4", nameTh: "ภาค 4" })).row;
  const command = (await commands.upsertByCode({ code: "BPP41", regionId: region.id, name: "บก.ตชด.41" })).row;
  const subdivision = (
    await subdivisions.upsertByCode({
      code: "BPP_SUB_41",
      commandId: command.id,
      shortName: "กก.ตชด.41",
      fullName: "กองกำกับการตำรวจตระเวนชายแดนที่ 41",
    })
  ).row;
  const company = (
    await companies.upsertByCode({
      code: "BPP447",
      subdivisionId: subdivision.id,
      companyNo: "447",
      shortName: "ร้อย ตชด.447",
      fullName: "กองร้อยตำรวจตระเวนชายแดนที่ 447",
    })
  ).row;

  assert.equal(command.regionId, region.id);
  assert.equal(subdivision.commandId, command.id);
  assert.equal(company.subdivisionId, subdivision.id);
});

test("seedMasterData is idempotent: second run creates nothing", async () => {
  const db = new InMemoryMasterDataClient();

  const first = await seedMasterData(db);
  const totalCreatedFirst = first.reduce((n, t) => n + t.created, 0);
  assert.ok(totalCreatedFirst > 0, "first run should create rows");
  assert.ok(first.every((t) => t.created === t.total), "first run creates every row");

  const second = await seedMasterData(db);
  assert.ok(second.every((t) => t.created === 0), "second run creates nothing");
  assert.ok(second.every((t) => t.updated === t.total), "second run updates every row");

  // Row counts unchanged after the second run.
  const repos = createMasterDataRepositories(db);
  assert.equal(await repos.regions.count(), SEED_REGIONS.length);
  assert.equal(await repos.ranks.count(), SEED_RANKS.length);
});

test("seeded ranks are ordered by ascending level via listActive/displayOrder", async () => {
  const db = new InMemoryMasterDataClient();
  await seedMasterData(db);
  const ranks = await new MasterRankRepository(db).listActive();
  const levels = ranks.map((r) => r.level as number);
  const sorted = [...levels].sort((a, b) => a - b);
  assert.deepEqual(levels, sorted);
});
