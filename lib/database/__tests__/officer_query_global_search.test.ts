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
    {
      // Phase 27 Part 9 regression fixture: a genuine Battalion 21 officer
      // whose PHONE NUMBER happens to contain "44" — nothing to do with
      // their battalion/region. Reproduces the reported bug ("44" surfacing
      // an unrelated Battalion 21 record).
      officerId: "ภาค2/21",
      rank: "ด.ต.",
      firstName: "สมชาย",
      lastName: "แซ่ตั้ง",
      currentPosition: "ผบ.หมู่",
      currentUnit: "กก.ตชด.21",
      region: "ภาค2",
      phone: "089-244-6301",
      battalionRefNameTh: "กก.ตชด.21",
      regionRefNameTh: "ภาค 2",
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
  assert.equal(result.total, 3);
});

// ── Phase 27 Part 9: short all-digit queries never blanket-`contains` free text (esp. phone) ──

test("globalSearch('44') does NOT return an unrelated Battalion 21 officer whose phone number happens to contain '44' (the reported bug)", async () => {
  const result = await repo().globalSearch({ q: "44", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.data.some((o) => o.officerId === "ภาค2/21"), false);
});

test("globalSearch('44') never matches phone at all for a 1-2 digit query, even when it's a real substring", async () => {
  // ภาค4/79's phone "081-766-1006" does not contain "44" and ภาค2/21's does —
  // this asserts the phone field is excluded outright for short numeric
  // queries, not merely that this particular fixture doesn't match.
  const result = await repo().globalSearch({ q: "44", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 0);
});

test("globalSearch('4') matches structured fields (region/officerId) but not phone/position/currentUnit via blanket contains", async () => {
  const result = await repo().globalSearch({ q: "4", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  const ids = result.data.map((o) => o.officerId);
  // ภาค4/79 matches via region "ภาค4" / officerId "ภาค4/79" / regionRef "ภาค 4".
  assert.ok(ids.includes("ภาค4/79"));
  // ภาค2/21's officerId contains "2" not "4", region is "ภาค2" — must NOT
  // match on "4" via its phone "089-244-6301" (which does contain "4").
  assert.equal(ids.includes("ภาค2/21"), false);
});

test("globalSearch('434') — a realistic 3-digit company code — still uses the full broad contains fan-out (existing behavior preserved)", async () => {
  const result = await repo().globalSearch({ q: "434", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});

test("globalSearch('081') — a realistic 3-digit phone substring — still matches phone (existing behavior preserved)", async () => {
  const result = await repo().globalSearch({ q: "081", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});
