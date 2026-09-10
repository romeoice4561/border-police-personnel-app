/**
 * DI-10E.6C architecture-review adversarial tests.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { handleDrugMapCaseDetail } from "@/lib/drug_intelligence/drug_geo_api_handlers";
import {
  DrugMapCaseDetailService,
  MAP_DETAIL_PERSON_CAP,
  MAP_DETAIL_SEIZURE_GROUP_CAP,
  MAP_DETAIL_UNIT_CAP,
} from "@/lib/drug_intelligence/drug_map_case_detail";
import { createDrugMapCaseDetailSession, type DrugMapCaseDetailResult } from "@/lib/drug_intelligence/drug_map_case_detail_client";
import { DrugMapQueryService } from "@/lib/drug_intelligence/drug_map_query";
import type { DrugCaseCreateRequest, DrugCasePersonInput, DrugCaseSeizedItemInput } from "@/lib/drug_intelligence/drug_case_types";

const ROOT = join(process.cwd());

function requestWithSession(url: string): Request {
  return new Request(url, { headers: { cookie: `${SESSION_COOKIE_NAME}=test-session` } });
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "MAP-6C-ADV",
    title: "review",
    status: "OPEN",
    arrestDate: new Date("2026-01-15"),
    arrestTime: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    leadUnitText: "ชุดจับกุม",
    province: "ชุมพร",
    district: "ท่าแซะ",
    subdistrict: null,
    locationName: "จุดตรวจ",
    latitude: 10,
    longitude: 99,
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

function person(name: string): DrugCasePersonInput {
  return {
    newPerson: { primaryFullName: name, nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
    role: "SUSPECT",
    linkedOfficerId: null,
    notes: null,
    phones: [],
    sims: [],
    devices: [],
    vehicles: [],
  };
}

function countItem(quantity: number, unit = "เม็ด"): DrugCaseSeizedItemInput {
  return {
    drugCategory: "METHAMPHETAMINE_TABLET",
    otherDrugCategoryLabel: null,
    measurementKind: "COUNT",
    drugType: "ยาบ้า",
    subtype: null,
    quantity,
    unit,
    weightGrams: null,
    packageCount: null,
    notes: null,
  };
}

function detail(id: string): DrugMapCaseDetailResult {
  return {
    case: {
      id,
      caseNumber: id,
      arrestDate: null,
      status: "OPEN",
      province: null,
      district: null,
      locationName: null,
      reportingUnitText: null,
      leadUnitText: null,
    },
    persons: { items: [], displayedCount: 0, totalCount: 0, truncated: false },
    seizures: { items: [], displayedCount: 0, totalCount: 0, truncated: false },
    participatingUnits: { items: [], displayedCount: 0, totalCount: 0, truncated: false },
    officers: { count: 0 },
  };
}

function assertNoFalseExactTotal(list: { displayedCount: number; totalCount: number | null; truncated: boolean }, actual: number, cap: number) {
  assert.equal(list.displayedCount, cap);
  assert.equal(list.truncated, true);
  assert.notEqual(list.totalCount, cap + 1, `must not present cap+1 (${cap + 1}) as an exact total when actual=${actual}`);
  if (list.totalCount != null) assert.equal(list.totalCount, actual);
}

test("persons actual 100 / cap 20 must not claim exact total 21", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "ADV-P100",
      persons: Array.from({ length: 100 }, (_, i) => person(`บุคคล ${String(i).padStart(3, "0")}`)),
    })
  );
  const result = await new DrugMapCaseDetailService(db).load(created.caseId);
  assertNoFalseExactTotal(result.persons, 100, MAP_DETAIL_PERSON_CAP);
});

test("units actual 100 / cap 20 must not claim exact total 21", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "ADV-U100",
      participatingUnits: Array.from({ length: 100 }, (_, i) => ({
        headquartersId: null,
        regionId: null,
        battalionId: null,
        companyId: null,
        unitText: `หน่วย ${String(i).padStart(3, "0")}`,
        role: "PARTICIPATING",
        note: null,
      })),
    })
  );
  const result = await new DrugMapCaseDetailService(db).load(created.caseId);
  assertNoFalseExactTotal(result.participatingUnits, 100, MAP_DETAIL_UNIT_CAP);
});

test("60 raw seized rows of one COUNT group include all 60 in the quantity", async () => {
  const db = new InMemoryDatabaseClient();
  const quantities = Array.from({ length: 60 }, (_, i) => i + 1);
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "ADV-S60",
      seizedItems: quantities.map((qty) => countItem(qty, "เม็ด")),
    })
  );
  const expected = quantities.reduce((sum, qty) => sum + qty, 0);
  const result = await new DrugMapCaseDetailService(db).load(created.caseId);
  assert.equal(result.seizures.items.length, 1);
  assert.equal(result.seizures.truncated, false);
  assert.equal(result.seizures.items[0]?.measurementKind, "COUNT");
  assert.equal(result.seizures.items[0]?.quantity, expected);
  assert.equal(result.seizures.items[0]?.displayUnit, "เม็ด");
});

test("more than 20 genuine seizure groups truncate truthfully and keep COUNT/MASS separate", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(
    baseCase({
      caseNumber: "ADV-S25",
      seizedItems: [
        ...Array.from({ length: 24 }, (_, i) => countItem(i + 1, `หน่วยนับ ${i}`)),
        {
          drugCategory: "CRYSTAL_METHAMPHETAMINE",
          otherDrugCategoryLabel: null,
          measurementKind: "MASS",
          drugType: "ไอซ์",
          subtype: null,
          quantity: null,
          unit: null,
          weightGrams: 1000,
          packageCount: null,
          notes: null,
        },
      ],
    })
  );
  const result = await new DrugMapCaseDetailService(db).load(created.caseId);
  assert.equal(result.seizures.displayedCount, MAP_DETAIL_SEIZURE_GROUP_CAP);
  assert.equal(result.seizures.truncated, true);
  assertNoFalseExactTotal(result.seizures, 25, MAP_DETAIL_SEIZURE_GROUP_CAP);
  const kinds = new Set(result.seizures.items.map((row) => row.measurementKind));
  assert.ok(kinds.size >= 1);
  for (const item of result.seizures.items) {
    if (item.measurementKind === "COUNT") assert.notEqual(item.displayUnit, "กก.");
    if (item.measurementKind === "MASS") assert.equal(item.displayUnit, "กก.");
  }
});

test("denied actor gets 403 for both an existing case and a nonexistent case", async () => {
  const db = new InMemoryDatabaseClient();
  const created = await new DrugCaseService({ db }).createCase(baseCase({ caseNumber: "ADV-DENY" }));
  const service = new DrugMapCaseDetailService(db);
  const existing = await handleDrugMapCaseDetail(service, created.caseId, "mock:1101700123456", requestWithSession("http://localhost/detail"));
  const missing = await handleDrugMapCaseDetail(service, "missing-case-id-0001", "mock:1101700123456", requestWithSession("http://localhost/detail"));
  assert.equal(existing.status, 403);
  assert.equal(missing.status, 403);
  assert.equal((await existing.json()).error.code, "FORBIDDEN");
  assert.equal((await missing.json()).error.code, "FORBIDDEN");
});

test("aborted A is not cached and reopen issues a new request", async () => {
  let calls = 0;
  const session = createDrugMapCaseDetailSession(async (_caseId, signal) => {
    calls += 1;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 80);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    return detail("case-a");
  });
  const pending = session.load("case-a");
  session.close();
  const aborted = await pending;
  assert.equal(aborted.aborted, true);
  assert.equal(session.cache.has("case-a"), false);
  const again = await session.load("case-a");
  assert.equal(again.fromCache, false);
  assert.equal(again.data?.case.id, "case-a");
  assert.equal(calls, 2);
});

test("pending A then select B keeps B and treats late A as stale", async () => {
  let releaseA: (() => void) | undefined;
  const session = createDrugMapCaseDetailSession(async (caseId) => {
    if (caseId === "case-a") {
      await new Promise<void>((resolve) => {
        releaseA = resolve;
      });
    }
    return detail(caseId);
  });
  const pendingA = session.load("case-a");
  const b = await session.load("case-b");
  releaseA?.();
  const a = await pendingA;
  assert.equal(b.data?.case.id, "case-b");
  assert.equal(b.stale, false);
  assert.equal(a.stale, true);
  assert.equal(a.data, null);
  assert.equal(session.cache.get("case-b")?.case.id, "case-b");
  assert.equal(session.cache.has("case-a"), false);
});

test("cached A then pending B then reopen A stays A and does not cache a failure", async () => {
  let releaseB: (() => void) | undefined;
  let calls = 0;
  const session = createDrugMapCaseDetailSession(async (caseId) => {
    calls += 1;
    if (caseId === "case-b") {
      await new Promise<void>((resolve) => {
        releaseB = resolve;
      });
    }
    return detail(caseId);
  });
  await session.load("case-a");
  const pendingB = session.load("case-b");
  const againA = await session.load("case-a");
  assert.equal(againA.fromCache, true);
  assert.equal(againA.data?.case.id, "case-a");
  releaseB?.();
  const b = await pendingB;
  assert.equal(againA.data?.case.id, "case-a");
  assert.ok(b.stale || b.data?.case.id === "case-b" || b.aborted);
  assert.equal(session.cache.get("case-a")?.case.id, "case-a");
  assert.equal(calls, 2);
});

test("failed detail is not cached and retry issues a new request", async () => {
  let calls = 0;
  let fail = true;
  const session = createDrugMapCaseDetailSession(async (caseId) => {
    calls += 1;
    if (fail) throw new Error("forced");
    return detail(caseId);
  });
  await assert.rejects(() => session.load("case-a"));
  assert.equal(session.cache.has("case-a"), false);
  session.invalidate("case-a");
  fail = false;
  const retried = await session.load("case-a");
  assert.equal(retried.fromCache, false);
  assert.equal(retried.data?.case.id, "case-a");
  assert.equal(calls, 2);
});

test("outside-filter, no-coordinate, and hard-limit caseId do not start a detail request", async () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/map/page.tsx"), "utf8");
  assert.match(page, /detailCaseId = viewMode === "MAP" && selectedCaseId && geoQuery\.data\?\.markers\.some/);
  assert.doesNotMatch(page, /useDrugMapCaseDetail\(actorId, filters\.caseId/);
  assert.doesNotMatch(page, /useDrugMapCaseDetail\(actorId, selectedCaseId, true\)/);
  const mapQuery = readFileSync(join(ROOT, "lib/drug_intelligence/drug_map_query.ts"), "utf8");
  assert.match(mapQuery, /!markerLimitReached && withCoordinates > 0/);
  assert.match(mapQuery, /if \(!markerLimitReached\)/);
  assert.match(mapQuery, /if \(!coord\) return null/);

  const db = new InMemoryDatabaseClient();
  const cases = new DrugCaseService({ db });
  const withCoord = await cases.createCase(baseCase({ caseNumber: "ADV-COORD" }));
  const noCoord = await cases.createCase(
    baseCase({
      caseNumber: "ADV-NOCOORD",
      latitude: null,
      longitude: null,
    })
  );
  const map = await new DrugMapQueryService(db).load({});
  const detailCaseId = (selectedCaseId: string, markers: Array<{ caseId: string }>) =>
    markers.some((marker) => marker.caseId === selectedCaseId) ? selectedCaseId : null;
  assert.equal(detailCaseId(withCoord.caseId, map.markers), withCoord.caseId);
  assert.equal(detailCaseId(noCoord.caseId, map.markers), null);
  assert.equal(detailCaseId("outside-filter-case-id", map.markers), null);
  assert.equal(detailCaseId(withCoord.caseId, []), null);
});

test("popup discloses truncation and omits empty sections", () => {
  const popup = readFileSync(join(ROOT, "components/drug_intelligence/drug_geo_marker_popup.tsx"), "utf8");
  assert.match(popup, /persons\.items\.length > 0/);
  assert.match(popup, /seizures\.items\.length > 0/);
  assert.match(popup, /participatingUnits\.items\.length > 0/);
  assert.match(popup, /officers\.count > 0/);
  assert.match(popup, /persons\.truncated/);
  assert.match(popup, /seizures\.truncated/);
  assert.match(popup, /participatingUnits\.truncated/);
  assert.match(popup, /di\.map\.detailTruncated/);
  assert.match(popup, /withReturnTo\(/);
  assert.match(popup, /max-h-80/);
});
