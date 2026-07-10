/**
 * API endpoint tests (Phase 13) over a fake ReadDatabaseClient — no running
 * server, no live database. Covers list/pagination/sort, by-id profile,
 * units/ranks/statistics/health, and consistent error envelopes.
 *
 * Run with:
 *   npx tsx --test lib/api/__tests__/api_handlers.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createApiContainer, type PortraitBatchResolver } from "@/lib/api/api_container";
import {
  handleOfficerList,
  handleOfficerSearch,
  handleGlobalSearch,
  handleOfficerById,
  handleUnits,
  handleRanks,
  handleStatistics,
  handleHealth,
} from "@/lib/api/api_handlers";
import { FakeReadDatabaseClient, type FakeOfficerSeed } from "@/lib/api/__tests__/fake_read_client";

function seeds(): FakeOfficerSeed[] {
  return [
    { officerId: "ภาค1/1", rank: "พ.ต.อ.", firstName: "สมชาย", lastName: "ใจดี", currentUnit: "ตชด.447", region: "ภาค1", careerYears: 20, qualityScore: 95, phone: "081-111-1111" },
    { officerId: "ภาค1/2", rank: "ร.ต.ท.", firstName: "อนิรุทธิ์", lastName: "ขาว", currentUnit: "ตชด.447", region: "ภาค1", careerYears: 10, qualityScore: 70, phone: "081-222-2222" },
    { officerId: "ภาค2/1", rank: "ร.ต.ท.", firstName: "วิชัย", lastName: "แดง", currentUnit: "ตชด.100", region: "ภาค2", careerYears: 5, qualityScore: 60, phone: "081-333-3333" },
  ];
}

/** No portraits linked in these fixtures — every officer resolves to the placeholder. */
const fakePortraits: PortraitBatchResolver = {
  async resolveBatch(officerIds) {
    const map = new Map();
    for (const id of officerIds) {
      map.set(id, { driveFileId: null, thumbnailUrl: null, webViewUrl: null, source: "PLACEHOLDER" as const });
    }
    return map;
  },
};

function container() {
  const client = new FakeReadDatabaseClient(seeds(), {
    timeline: {
      "ภาค1/1": [
        {
          id: 1,
          officerId: 1,
          sequence: 0,
          year: "2564",
          yearValue: 2564,
          rank: null,
          position: "ผบ.ร้อย",
          unit: "ตชด.447",
          source: null,
          verified: "ยังไม่ตรวจ",
          day: null,
          month: null,
          yearBE: null,
          isPresent: false,
          effectiveDate: null,
          headquartersId: null,
          regionId: null,
          battalionId: null,
          companyId: null,
        },
      ],
    },
    phones: { "ภาค1/1": ["081-111-1111"] },
  });
  return createApiContainer(client, fakePortraits);
}

async function body(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

test("GET /officers returns paginated data with meta", async () => {
  const res = await handleOfficerList(container(), new URLSearchParams("page=1&pageSize=2&sortBy=careerYears&sortOrder=desc"));
  assert.equal(res.status, 200);
  const json = await body(res);
  const data = json.data as unknown[];
  const meta = json.meta as Record<string, number>;
  assert.equal(data.length, 2);
  assert.equal(meta.total, 3);
  assert.equal(meta.totalPages, 2);
});

test("GET /officers sorts by the requested field/order", async () => {
  const res = await handleOfficerList(container(), new URLSearchParams("sortBy=careerYears&sortOrder=desc&pageSize=10"));
  const data = (await body(res)).data as Array<{ careerYears: number }>;
  assert.deepEqual(data.map((o) => o.careerYears), [20, 10, 5]);
});

test("GET /officers filters by region and minQuality", async () => {
  const res = await handleOfficerList(container(), new URLSearchParams("region=ภาค1&minQuality=90&pageSize=10"));
  const data = (await body(res)).data as Array<{ officerId: string }>;
  assert.equal(data.length, 1);
  assert.equal(data[0].officerId, "ภาค1/1");
});

test("GET /officers rejects invalid query with 400 and details", async () => {
  const res = await handleOfficerList(container(), new URLSearchParams("pageSize=9999"));
  assert.equal(res.status, 400);
  const json = await body(res);
  assert.ok((json.error as { code: string }).code === "BAD_REQUEST");
});

test("Phase 24B-3: GET /officers attaches the resolved portrait to each row via ONE batch call (no N+1)", async () => {
  let callCount = 0;
  let lastRequestedIds: readonly string[] = [];
  const portraitsWithData: PortraitBatchResolver = {
    async resolveBatch(officerIds) {
      callCount += 1;
      lastRequestedIds = officerIds;
      const map = new Map();
      for (const id of officerIds) {
        map.set(
          id,
          id === "ภาค1/1"
            ? { driveFileId: "drive-1", thumbnailUrl: "https://x/thumb-1", webViewUrl: "https://x/view-1", source: "DRIVE_PORTRAIT" as const }
            : { driveFileId: null, thumbnailUrl: null, webViewUrl: null, source: "PLACEHOLDER" as const }
        );
      }
      return map;
    },
  };
  const client = new FakeReadDatabaseClient(seeds());
  const c = createApiContainer(client, portraitsWithData);

  const res = await handleOfficerList(c, new URLSearchParams("pageSize=10"));
  const data = (await body(res)).data as Array<{ officerId: string; thumbnailUrl: string | null; driveFileId: string | null; portraitSource: string }>;

  assert.equal(callCount, 1, "the batch resolver must be called exactly once for the whole page");
  assert.equal(lastRequestedIds.length, 3);

  const withPhoto = data.find((o) => o.officerId === "ภาค1/1")!;
  assert.equal(withPhoto.thumbnailUrl, "https://x/thumb-1");
  assert.equal(withPhoto.driveFileId, "drive-1");
  assert.equal(withPhoto.portraitSource, "DRIVE_PORTRAIT");

  const placeholder = data.find((o) => o.officerId === "ภาค1/2")!;
  assert.equal(placeholder.thumbnailUrl, null);
  assert.equal(placeholder.portraitSource, "PLACEHOLDER");
});

test("Phase 24B-3: GET /search attaches portraits via the same batch resolver", async () => {
  const portraitsWithData: PortraitBatchResolver = {
    async resolveBatch(officerIds) {
      const map = new Map();
      for (const id of officerIds) map.set(id, { driveFileId: "d", thumbnailUrl: "t", webViewUrl: "w", source: "MANUAL_MATCH" as const });
      return map;
    },
  };
  const c = createApiContainer(new FakeReadDatabaseClient(seeds()), portraitsWithData);
  const res = await handleOfficerSearch(c, new URLSearchParams("name=สมชาย&match=contains"));
  const data = (await body(res)).data as Array<{ thumbnailUrl: string | null; portraitSource: string }>;
  assert.ok(data.length > 0);
  assert.ok(data.every((o) => o.thumbnailUrl === "t" && o.portraitSource === "MANUAL_MATCH"));
});

// ── Phase 26B Part B: Global Search ──────────────────────────────────────────

test("GET /search/global finds an officer whose unit text contains the query digits ('434' -> 'ร้อย ตชด.434')", async () => {
  const client = new FakeReadDatabaseClient([
    { officerId: "ภาค4/79", rank: "ร.ต.ต.", firstName: "ชูศักดิ์", lastName: "ชูทอง", currentUnit: "ร้อย ตชด.434" },
  ]);
  const c = createApiContainer(client, fakePortraits);
  const res = await handleGlobalSearch(c, new URLSearchParams("q=434"));
  assert.equal(res.status, 200);
  const json = (await body(res)) as { data: Array<{ officerId: string }>; meta: { total: number } };
  assert.equal(json.meta.total, 1);
  assert.equal(json.data[0].officerId, "ภาค4/79");
});

test("GET /search/global rejects an empty query with 400", async () => {
  const res = await handleGlobalSearch(container(), new URLSearchParams("q="));
  assert.equal(res.status, 400);
});

test("GET /search/global rejects a missing query with 400", async () => {
  const res = await handleGlobalSearch(container(), new URLSearchParams(""));
  assert.equal(res.status, 400);
});

test("GET /search/global attaches portraits via the same batch resolver as list/search", async () => {
  const portraitsWithData: PortraitBatchResolver = {
    async resolveBatch(officerIds) {
      const map = new Map();
      for (const id of officerIds) map.set(id, { driveFileId: "d", thumbnailUrl: "t", webViewUrl: "w", source: "MANUAL_MATCH" as const });
      return map;
    },
  };
  const c = createApiContainer(new FakeReadDatabaseClient(seeds()), portraitsWithData);
  const res = await handleGlobalSearch(c, new URLSearchParams("q=สมชาย"));
  const data = (await body(res)).data as Array<{ thumbnailUrl: string | null; portraitSource: string }>;
  assert.ok(data.length > 0);
  assert.ok(data.every((o) => o.thumbnailUrl === "t" && o.portraitSource === "MANUAL_MATCH"));
});

test("GET /officers/{id} returns full profile with timeline and quality", async () => {
  const res = await handleOfficerById(container(), "ภาค1/1");
  assert.equal(res.status, 200);
  const data = (await body(res)).data as Record<string, unknown>;
  const officer = data.officer as Record<string, unknown>;
  assert.equal(officer.id, "ภาค1/1");
  assert.equal((data.timeline as unknown[]).length, 1);
  assert.equal((data.quality as { qualityScore: number }).qualityScore, 95);
});

test("GET /officers/{id} returns 404 for an unknown officer", async () => {
  const res = await handleOfficerById(container(), "ไม่มี/999");
  assert.equal(res.status, 404);
  assert.equal(((await body(res)).error as { code: string }).code, "NOT_FOUND");
});

test("GET /officers/{id} response is backward compatible: existing top-level keys unchanged (Phase 20C; Phase 23A adds contact/education/training additively)", async () => {
  const res = await handleOfficerById(container(), "ภาค1/1");
  const data = (await body(res)).data as Record<string, unknown>;
  const keys = new Set(Object.keys(data));
  // Every pre-existing key must still be present, unrenamed, unremoved.
  for (const key of ["officer", "organization", "photo", "timeline", "phones", "quality"]) {
    assert.ok(keys.has(key), `expected pre-existing key "${key}" to still be present`);
  }
  // Phase 23A adds these — additive only, never replacing an existing key.
  assert.deepEqual(keys, new Set(["officer", "organization", "photo", "contact", "timeline", "phones", "education", "training", "quality"]));
  const officer = data.officer as Record<string, unknown>;
  // Existing officer fields present and unrenamed — no new keys snuck into `officer`.
  assert.deepEqual(
    new Set(Object.keys(officer)),
    new Set(["id", "rank", "firstName", "lastName", "currentPosition", "currentUnit", "phone", "careerYears", "region", "confidence"])
  );
});

test("GET /officers/{id} includes an optional `organization` block with null ids when unresolved (Phase 20C)", async () => {
  const res = await handleOfficerById(container(), "ภาค1/1");
  const data = (await body(res)).data as Record<string, unknown>;
  const organization = data.organization as Record<string, unknown>;
  assert.deepEqual(organization, { regionId: null, battalionId: null, companyId: null });
});

test("GET /officers/{id} surfaces resolved organization ids when present on the officer row (Phase 20C)", async () => {
  const seededClient = new FakeReadDatabaseClient([
    { officerId: "ภาค1/1", rank: "พ.ต.อ.", firstName: "สมชาย", lastName: "ใจดี", regionId: 4, battalionId: 44, companyId: 447 },
  ]);
  const res = await handleOfficerById(createApiContainer(seededClient, fakePortraits), "ภาค1/1");
  const data = (await body(res)).data as Record<string, unknown>;
  assert.deepEqual(data.organization, { regionId: 4, battalionId: 44, companyId: 447 });
});

test("GET /officers list rows carry the new organization ids as optional fields without breaking existing consumers (Phase 20C)", async () => {
  const res = await handleOfficerList(container(), new URLSearchParams("pageSize=10"));
  const data = (await body(res)).data as Array<Record<string, unknown>>;
  assert.ok(data.every((o) => o.regionId === null && o.battalionId === null && o.companyId === null));
});

test("GET /statistics computes totals, averages, and duplicate counts", async () => {
  // Two officers share a phone/name to exercise duplicate detection.
  const dupSeeds: FakeOfficerSeed[] = [
    ...seeds(),
    // Same rank + name as ภาค1/1 (พ.ต.อ. สมชาย ใจดี) and same phone → duplicate.
    { officerId: "ภาค3/1", rank: "พ.ต.อ.", firstName: "สมชาย", lastName: "ใจดี", phone: "081-111-1111", region: "ภาค3", careerYears: 8 },
  ];
  const c = createApiContainer(new FakeReadDatabaseClient(dupSeeds), fakePortraits);
  const res = await handleStatistics(c);
  const stats = (await body(res)).data as Record<string, number>;

  assert.equal(stats.totalOfficers, 4);
  assert.equal(stats.duplicatePhones, 1); // 081-111-1111 shared
  assert.equal(stats.duplicateNames, 1); // สมชาย ใจดี shared
  assert.ok(stats.averageCareerYears > 0);
});

test("GET /units returns units with officer counts, most populous first", async () => {
  const res = await handleUnits(container());
  const units = (await body(res)).data as Array<{ unit: string; officerCount: number }>;
  assert.equal(units[0].unit, "ตชด.447");
  assert.equal(units[0].officerCount, 2);
});

test("GET /ranks returns ranks with officer counts", async () => {
  const res = await handleRanks(container());
  const ranks = (await body(res)).data as Array<{ rank: string; officerCount: number }>;
  const rt = ranks.find((r) => r.rank === "ร.ต.ท.");
  assert.equal(rt?.officerCount, 2);
});

test("GET /health reports ok + connected with the full status shape when the database responds", async () => {
  const res = await handleHealth(container());
  assert.equal(res.status, 200);
  const data = (await body(res)).data as Record<string, unknown>;
  assert.equal(data.status, "ok");
  assert.equal(data.database, "connected");
  assert.ok(data.timestamp);
  // Phase 16A: version, uptime, environment are part of the body.
  assert.ok(typeof data.version === "string");
  assert.ok(typeof data.uptime === "number");
  assert.ok(typeof data.environment === "string");
});

test("GET /health reports 503 degraded (with full shape) when the database ping throws", async () => {
  const brokenContainer = container();
  brokenContainer.statistics.ping = async () => {
    throw new Error("db down");
  };
  const res = await handleHealth(brokenContainer);
  assert.equal(res.status, 503);
  const details = ((await body(res)).error as { details?: Record<string, unknown> }).details ?? {};
  assert.equal(details.status, "degraded");
  assert.equal(details.database, "disconnected");
  assert.ok(typeof details.uptime === "number");
  assert.ok(typeof details.environment === "string");
});
