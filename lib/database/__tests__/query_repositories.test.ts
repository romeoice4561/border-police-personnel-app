/**
 * Query-repository + pagination tests (Phase 13) over the fake read client.
 * Verifies the read repositories the API depends on, independent of the HTTP
 * layer. No live database.
 *
 * Run with:
 *   npx tsx --test lib/database/__tests__/query_repositories.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { FakeReadDatabaseClient, type FakeOfficerSeed } from "@/lib/api/__tests__/fake_read_client";
import { OfficerQueryRepository } from "@/lib/database/repositories/officer_query_repository";
import { UnitQueryRepository } from "@/lib/database/repositories/unit_query_repository";
import { RankQueryRepository } from "@/lib/database/repositories/rank_query_repository";
import { StatisticsQueryRepository } from "@/lib/database/repositories/statistics_query_repository";

const seeds: FakeOfficerSeed[] = Array.from({ length: 25 }, (_, i) => ({
  officerId: `ภาค1/${i + 1}`,
  rank: i % 2 === 0 ? "ร.ต.ท." : "พ.ต.อ.",
  firstName: `First${i + 1}`,
  lastName: `Last${String(i + 1).padStart(2, "0")}`,
  currentUnit: i < 15 ? "ตชด.447" : "ตชด.100",
  region: "ภาค1",
  careerYears: i,
  qualityScore: 50 + i,
  phone: `081-000-${String(1000 + i)}`,
}));

function client() {
  return new FakeReadDatabaseClient(seeds);
}

test("OfficerQueryRepository.list paginates (page 1 and page 2 differ, total correct)", async () => {
  const repo = new OfficerQueryRepository(client());

  const page1 = await repo.list({ page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(page1.data.length, 10);
  assert.equal(page1.total, 25);
  assert.equal(page1.totalPages, 3);

  const page2 = await repo.list({ page: 2, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(page2.data.length, 10);
  assert.notEqual(page1.data[0].officerId, page2.data[0].officerId);

  const page3 = await repo.list({ page: 3, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(page3.data.length, 5); // remainder
});

test("OfficerQueryRepository.list sorts ascending and descending", async () => {
  const repo = new OfficerQueryRepository(client());
  const asc = await repo.list({ page: 1, pageSize: 25, sortBy: "careerYears", sortOrder: "asc" });
  const desc = await repo.list({ page: 1, pageSize: 25, sortBy: "careerYears", sortOrder: "desc" });
  assert.equal(asc.data[0].careerYears, 0);
  assert.equal(desc.data[0].careerYears, 24);
});

test("OfficerQueryRepository.list filters by unit and minCareerYears", async () => {
  const repo = new OfficerQueryRepository(client());
  const result = await repo.list({ page: 1, pageSize: 100, sortBy: "careerYears", sortOrder: "asc", unit: "ตชด.100", minCareerYears: 20 });
  assert.ok(result.data.every((o) => o.currentUnit === "ตชด.100" && o.careerYears >= 20));
});

test("UnitQueryRepository.listWithCounts returns per-unit counts, most first", async () => {
  const units = await new UnitQueryRepository(client()).listWithCounts();
  assert.equal(units[0].unit, "ตชด.447");
  assert.equal(units[0].officerCount, 15);
  assert.equal(units[1].officerCount, 10);
});

test("RankQueryRepository.listWithCounts returns per-rank counts", async () => {
  const ranks = await new RankQueryRepository(client()).listWithCounts();
  const total = ranks.reduce((s, r) => s + r.officerCount, 0);
  assert.equal(total, 25);
});

test("StatisticsQueryRepository.compute averages and counts", async () => {
  const stats = await new StatisticsQueryRepository(client()).compute();
  assert.equal(stats.totalOfficers, 25);
  assert.equal(stats.units, 2);
  assert.equal(stats.regions, 1);
  assert.ok(stats.averageCareerYears > 0);
  assert.ok(stats.averageQuality > 0);
});

test("StatisticsQueryRepository.ping resolves true against a live client", async () => {
  assert.equal(await new StatisticsQueryRepository(client()).ping(), true);
});
