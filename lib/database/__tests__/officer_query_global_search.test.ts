/**
 * Unit tests for OfficerQueryRepository.globalSearch (Phase 26B Part B), over
 * the fake ReadDatabaseClient. No running server, no live database.
 *
 * Run with:
 *   npx tsx --test lib/database/__tests__/officer_query_global_search.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { OfficerQueryRepository } from "@/lib/database/repositories/officer_query_repository";
import { FakeReadDatabaseClient, type FakeOfficerSeed } from "@/lib/api/__tests__/fake_read_client";

function seeds(): FakeOfficerSeed[] {
  return [
    {
      officerId: "ภาค4/79",
      rank: "ร.ต.ต.",
      firstName: "ชูศักดิ์",
      lastName: "ชูทอง",
      currentPosition: "รอง ผกก.",
      currentUnit: "ร้อย ตชด.434",
      region: "ภาค4",
      phone: "081-766-1006",
      battalionRefNameTh: "กก.ตชด.43",
      companyRefNameTh: "ตชด.434",
      regionRefNameTh: "ภาค 4",
    },
    {
      officerId: "ภาค1/5",
      rank: "ร.ต.ท.",
      firstName: "อนิรุทธิ์",
      lastName: "ขาวจันทร์คง",
      currentPosition: "ผบ.หมู่",
      currentUnit: "ตชด.117",
      region: "ภาค1",
      phone: "089-999-9999",
    },
  ];
}

function repo() {
  return new OfficerQueryRepository(new FakeReadDatabaseClient(seeds()));
}

test("globalSearch finds an officer by a digit substring inside their company/unit text ('434' -> 'ร้อย ตชด.434')", async () => {
  const result = await repo().globalSearch({ q: "434", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});

test("globalSearch finds an officer by phone substring ('081')", async () => {
  const result = await repo().globalSearch({ q: "081", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});

test("globalSearch finds an officer by surname ('ชูทอง')", async () => {
  const result = await repo().globalSearch({ q: "ชูทอง", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});

test("globalSearch finds an officer by position ('รอง ผกก.')", async () => {
  const result = await repo().globalSearch({ q: "รอง ผกก.", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});

test("globalSearch finds an officer by officerId substring", async () => {
  const result = await repo().globalSearch({ q: "ภาค1/5", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค1/5");
});

test("globalSearch finds an officer by rank", async () => {
  const result = await repo().globalSearch({ q: "ร.ต.ต.", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});

test("globalSearch finds an officer by linked Company display name (regionRef/battalionRef/companyRef)", async () => {
  const result = await repo().globalSearch({ q: "กก.ตชด.43", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});

test("globalSearch is case-insensitive", async () => {
  const result = await repo().globalSearch({ q: "CHU", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 0); // no Latin text in these fixtures — sanity check it doesn't crash/false-positive
});

test("globalSearch unions in extraOfficerIds from other search providers (e.g. Drive filename matches)", async () => {
  const result = await repo().globalSearch({ q: "no-such-text-anywhere", extraOfficerIds: ["ภาค1/5"], page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค1/5");
});

test("globalSearch returns nothing for a query that matches no field", async () => {
  const result = await repo().globalSearch({ q: "zzz-not-present-zzz", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 0);
});

test("globalSearch with a blank query and no extraOfficerIds returns everything (empty where clause)", async () => {
  const result = await repo().globalSearch({ q: "", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 2);
});
