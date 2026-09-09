/**
 * DI-10E.6A — focused in-memory Prisma semantics used by Map V2.
 *
 * Run with:
 *   npx tsx --test lib/database/__tests__/in_memory_map_query_semantics.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";

test("not:null matches only populated columns", async () => {
  const db = new InMemoryDatabaseClient();
  await db.drugCase.create({ data: { id: "c-pair", latitude: 10, longitude: 99 } });
  await db.drugCase.create({ data: { id: "c-partial", latitude: 10, longitude: null } });
  const rows = await db.drugCase.findMany({
    where: { AND: [{ latitude: { not: null } }, { longitude: { not: null } }] },
  });
  assert.deepEqual(rows.map((row) => row.id), ["c-pair"]);
});

test("locations.some + nested location to-one matches complete ARREST_LOCATION", async () => {
  const db = new InMemoryDatabaseClient();
  await db.drugCase.create({ data: { id: "c-fb", latitude: null, longitude: null } });
  await db.drugLocation.create({ data: { id: "loc-1", latitude: 11, longitude: 100 } });
  await db.drugCaseLocation.create({ data: { id: "link-1", caseId: "c-fb", locationId: "loc-1", role: "ARREST_LOCATION" } });
  await db.drugCase.create({ data: { id: "c-none", latitude: null, longitude: null } });
  const rows = await db.drugCase.findMany({
    where: {
      locations: {
        some: {
          role: "ARREST_LOCATION",
          location: { AND: [{ latitude: { not: null } }, { longitude: { not: null } }] },
        },
      },
    },
  });
  assert.deepEqual(rows.map((row) => row.id), ["c-fb"]);
});

test("groupBy province returns Prisma-shaped _count._all", async () => {
  const db = new InMemoryDatabaseClient();
  await db.drugCase.create({ data: { id: "a", province: "ชุมพร" } });
  await db.drugCase.create({ data: { id: "b", province: "ชุมพร" } });
  await db.drugCase.create({ data: { id: "c", province: "ระนอง" } });
  const groupBy = db.drugCase.groupBy;
  assert.ok(groupBy);
  const groups = await groupBy.call(db.drugCase, { by: ["province"], _count: { _all: true } });
  const chumphon = groups.find((row) => row.province === "ชุมพร") as { _count: { _all: number } };
  assert.equal(chumphon._count._all, 2);
});

test("orderBy arrestDate desc nulls last then caseNumber and id", async () => {
  const db = new InMemoryDatabaseClient();
  await db.drugCase.create({ data: { id: "z", caseNumber: "TIE", arrestDate: new Date("2026-01-01") } });
  await db.drugCase.create({ data: { id: "a", caseNumber: "TIE", arrestDate: new Date("2026-01-01") } });
  await db.drugCase.create({ data: { id: "n", caseNumber: "NULL", arrestDate: null } });
  await db.drugCase.create({ data: { id: "m", caseNumber: "LATE", arrestDate: new Date("2026-03-01") } });
  const rows = await db.drugCase.findMany({
    orderBy: [{ arrestDate: { sort: "desc", nulls: "last" } }, { caseNumber: "asc" }, { id: "asc" }],
  });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["m", "a", "z", "n"]
  );
});

test("drugCaseLocation.case nested where filters parent DrugCase", async () => {
  const db = new InMemoryDatabaseClient();
  await db.drugCase.create({ data: { id: "keep", latitude: null, longitude: null } });
  await db.drugCase.create({ data: { id: "drop", latitude: 10, longitude: 99 } });
  await db.drugLocation.create({ data: { id: "loc", latitude: 1, longitude: 2 } });
  await db.drugCaseLocation.create({ data: { id: "l1", caseId: "keep", locationId: "loc", role: "ARREST_LOCATION" } });
  await db.drugCaseLocation.create({ data: { id: "l2", caseId: "drop", locationId: "loc", role: "ARREST_LOCATION" } });
  const rows = await db.drugCaseLocation.findMany({
    where: { role: "ARREST_LOCATION", case: { OR: [{ latitude: null }, { longitude: null }] } },
  });
  assert.deepEqual(rows.map((row) => row.caseId), ["keep"]);
});

test("skip/take paginate after orderBy", async () => {
  const db = new InMemoryDatabaseClient();
  for (const id of ["1", "2", "3"]) {
    await db.drugCase.create({ data: { id, caseNumber: id } });
  }
  const page = await db.drugCase.findMany({ orderBy: { id: "asc" }, skip: 1, take: 1 });
  assert.equal(page.length, 1);
  assert.equal(page[0]?.id, "2");
});
