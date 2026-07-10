import { test } from "node:test";
import assert from "node:assert/strict";

import { OfficerQueryRepository } from "@/lib/database/repositories/officer_query_repository";
import { GlobalSearchService } from "@/lib/search/global_search_service";
import type { SearchProvider } from "@/lib/search/global_search_types";
import { FakeReadDatabaseClient, type FakeOfficerSeed } from "@/lib/api/__tests__/fake_read_client";

function seeds(): FakeOfficerSeed[] {
  return [
    { officerId: "ภาค4/79", rank: "ร.ต.ต.", firstName: "ชูศักดิ์", lastName: "ชูทอง" },
    { officerId: "ภาค1/5", rank: "ร.ต.ท.", firstName: "อนิรุทธิ์", lastName: "ขาวจันทร์คง" },
  ];
}

function fakeProvider(name: string, ids: string[]): SearchProvider {
  return { name, async findMatchingOfficerIds() { return new Set(ids); } };
}

test("with no providers registered, behaves exactly like OfficerQueryRepository.globalSearch alone", async () => {
  const officers = new OfficerQueryRepository(new FakeReadDatabaseClient(seeds()));
  const service = new GlobalSearchService({ officers });
  const result = await service.search({ q: "ชูทอง", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค4/79");
});

test("a provider match is unioned in even when the query matches no Officer field directly (Drive filename case)", async () => {
  const officers = new OfficerQueryRepository(new FakeReadDatabaseClient(seeds()));
  const provider = fakeProvider("drive_filename", ["ภาค1/5"]);
  const service = new GlobalSearchService({ officers, providers: [provider] });

  const result = await service.search({ q: "IMG_20260101.jpg", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
  assert.equal(result.data[0].officerId, "ภาค1/5");
});

test("results from multiple providers are merged and de-duplicated", async () => {
  const officers = new OfficerQueryRepository(new FakeReadDatabaseClient(seeds()));
  const providerA = fakeProvider("a", ["ภาค1/5"]);
  const providerB = fakeProvider("b", ["ภาค1/5", "ภาค4/79"]);
  const service = new GlobalSearchService({ officers, providers: [providerA, providerB] });

  const result = await service.search({ q: "no-direct-match", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 2);
});

test("a provider that finds nothing does not suppress a direct Officer-field match", async () => {
  const officers = new OfficerQueryRepository(new FakeReadDatabaseClient(seeds()));
  const emptyProvider = fakeProvider("empty", []);
  const service = new GlobalSearchService({ officers, providers: [emptyProvider] });

  const result = await service.search({ q: "ชูทอง", page: 1, pageSize: 10, sortBy: "lastName", sortOrder: "asc" });
  assert.equal(result.total, 1);
});
