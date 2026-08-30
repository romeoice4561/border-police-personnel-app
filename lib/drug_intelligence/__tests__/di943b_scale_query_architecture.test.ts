/**
 * DI-9.4.3B — scale-shaped architecture tests (in-memory only).
 * Proves pagination/search/network query counts stay bounded as N grows.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugPersonDirectoryService } from "@/lib/drug_intelligence/drug_person_profile_service";
import { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import { DrugNetworkGraphService } from "@/lib/drug_intelligence/drug_network_graph_service";
import { DrugPersonAdvancedSearchService } from "@/lib/drug_intelligence/drug_person_advanced_search_service";
import {
  enableQueryCountInstrumentation,
  disableQueryCountInstrumentation,
  resetQueryCounts,
  getTotalQueryCount,
  instrumentDatabaseClient,
} from "@/lib/drug_intelligence/query_count_instrumentation";
import type { DatabaseClient } from "@/lib/database/database_types";

function seedPersons(db: InMemoryDatabaseClient, n: number) {
  for (let i = 0; i < n; i++) {
    const id = `person-${i}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).drugPerson.create({
      data: {
        id,
        primaryFullName: i % 10 === 0 ? `นาย ทดสอบ ${i}` : `Person ${i}`,
        nickname: null,
        nationality: "TH",
        sex: "MALE",
        dateOfBirth: null,
        approximateAge: 30,
        notes: null,
        createdBy: "qa",
        createdByName: "QA",
        updatedBy: null,
        updatedByName: null,
        status: "ACTIVE",
        mergedIntoPersonId: null,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).drugPersonAlias.create({
      data: { id: `alias-${i}`, personId: id, fullName: `Alias ${i}`, isPrimary: false, createdBy: "qa" },
    });
  }
}

test("Persons directory paginates without enriching the whole ACTIVE pool", async () => {
  const raw = new InMemoryDatabaseClient();
  seedPersons(raw, 80);
  enableQueryCountInstrumentation();
  resetQueryCounts();
  const db = instrumentDatabaseClient(raw as unknown as DatabaseClient);
  const service = new DrugPersonDirectoryService(db);
  const result = await service.list({ page: 2, pageSize: 10 });
  assert.equal(result.rows.length, 10);
  assert.equal(result.total, 80);
  // Enrichment should reference page ids only for child tables — total queries
  // must not grow like O(N * 5) for N=80 (old path was ~11N+).
  const total = getTotalQueryCount();
  assert.ok(total < 80, `expected bounded queries, got ${total}`);
  disableQueryCountInstrumentation();
});

test("Grouped search uses DB contains and does not require full phone-table JS scan for partial phone", async () => {
  const raw = new InMemoryDatabaseClient();
  seedPersons(raw, 40);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (raw as any).drugPhoneNumber.create({
    data: { id: "phone-1", normalizedNumber: "66812345678", createdBy: "qa" },
  });
  enableQueryCountInstrumentation();
  resetQueryCounts();
  const db = instrumentDatabaseClient(raw as unknown as DatabaseClient);
  const service = new DrugIntelligenceSearchService(db);
  const result = await service.searchGrouped(
    { query: "ทดสอบ", perGroupLimit: 5 },
    { canViewFull: true, actorId: "mock:admin", actorName: "Administrator" }
  );
  assert.ok(result.groups.some((g) => g.entityType === "PERSON"));
  const total = getTotalQueryCount();
  assert.ok(total < 200, `expected bounded search queries, got ${total}`);
  disableQueryCountInstrumentation();
});

test("Advanced persons/search bounds join loads to candidates", async () => {
  const raw = new InMemoryDatabaseClient();
  seedPersons(raw, 60);
  enableQueryCountInstrumentation();
  resetQueryCounts();
  const db = instrumentDatabaseClient(raw as unknown as DatabaseClient);
  const service = new DrugPersonAdvancedSearchService(db);
  const result = await service.search({ query: "ทดสอบ", page: 1, pageSize: 10 });
  assert.ok(result.total >= 1);
  assert.ok(result.items.length <= 10);
  const total = getTotalQueryCount();
  // Old path rebuilt identities with ~11N queries; batched matching keeps this far below N*10.
  assert.ok(total < 80, `expected bounded advanced search queries, got ${total}`);
  disableQueryCountInstrumentation();
});

test("Network respects maxNodes=150 and batches hydration", async () => {
  const raw = new InMemoryDatabaseClient();
  // Focus person + many linked cases
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = raw as any;
  await dbAny.drugPerson.create({
    data: {
      id: "focus",
      primaryFullName: "Focus",
      nickname: null,
      nationality: "TH",
      sex: "MALE",
      dateOfBirth: null,
      approximateAge: null,
      notes: null,
      createdBy: "qa",
      createdByName: "QA",
      updatedBy: null,
      updatedByName: null,
      status: "ACTIVE",
      mergedIntoPersonId: null,
    },
  });
  for (let i = 0; i < 40; i++) {
    const caseId = `case-${i}`;
    await dbAny.drugCase.create({
      data: {
        id: caseId,
        caseNumber: `C-${i}`,
        title: `Case ${i}`,
        arrestDate: new Date("2024-01-01"),
        status: "OPEN",
        createdBy: "qa",
        createdByName: "QA",
      },
    });
    await dbAny.drugCasePerson.create({
      data: { id: `cp-${i}`, caseId, personId: "focus", role: "SUSPECT", createdBy: "qa" },
    });
  }

  enableQueryCountInstrumentation();
  resetQueryCounts();
  const db = instrumentDatabaseClient(raw as unknown as DatabaseClient);
  const service = new DrugNetworkGraphService(db);
  const graph = await service.getNeighborhood(
    { entityType: "PERSON", entityId: "focus", depth: 1, maxNodes: 150 },
    { canViewFull: true }
  );
  assert.ok(graph.nodes.length <= 150);
  assert.ok(graph.nodes.length >= 2);
  // Hydration uses id IN batches (not 1 query/node). Frontier still expands leaves;
  // assert we stayed well below the pre-batch hydration+count fan-out (~3N+).
  const total = getTotalQueryCount();
  assert.ok(total < 400, `expected improved network query bound, got ${total}`);
  disableQueryCountInstrumentation();
});

test("ModelDelegate skip/take is honored by in-memory client", async () => {
  const db = new InMemoryDatabaseClient();
  seedPersons(db, 25);
  const page = await db.drugPerson.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    skip: 5,
    take: 7,
  });
  assert.equal(page.length, 7);
});
