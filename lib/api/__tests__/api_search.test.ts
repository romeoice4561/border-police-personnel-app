/**
 * Search endpoint tests (Phase 13): match modes (contains/startsWith/exact),
 * case-insensitivity, multi-field AND, name-across-first/last, numeric
 * thresholds, and validation. Over the fake read client — no live DB.
 *
 * Run with:
 *   npx tsx --test lib/api/__tests__/api_search.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { createApiContainer } from "@/lib/api/api_container";
import { handleOfficerSearch } from "@/lib/api/api_handlers";
import { FakeReadDatabaseClient, type FakeOfficerSeed } from "@/lib/api/__tests__/fake_read_client";

const seeds: FakeOfficerSeed[] = [
  { officerId: "ภาค1/1", rank: "พ.ต.อ.", firstName: "Somchai", lastName: "Jaidee", currentUnit: "ตชด.447", currentPosition: "ผบ.ร้อย", region: "ภาค1", careerYears: 20, qualityScore: 95, phone: "081-111-1111" },
  { officerId: "ภาค1/2", rank: "ร.ต.ท.", firstName: "Anirut", lastName: "Khao", currentUnit: "ตชด.448", currentPosition: "ผบ.มว.", region: "ภาค1", careerYears: 10, qualityScore: 70, phone: "082-222-2222" },
  { officerId: "ภาค2/1", rank: "ร.ต.ท.", firstName: "Wichai", lastName: "Somsak", currentUnit: "ตชด.100", currentPosition: "รอง ผบ.ร้อย", region: "ภาค2", careerYears: 5, qualityScore: 60, phone: "081-333-3333" },
];

function container() {
  return createApiContainer(new FakeReadDatabaseClient(seeds));
}

async function ids(res: Response): Promise<string[]> {
  const json = (await res.json()) as { data: Array<{ officerId: string }> };
  return json.data.map((o) => o.officerId).sort();
}

test("contains match finds a substring, case-insensitively", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("name=chai&match=contains"));
  assert.equal(res.status, 200);
  // Both "Somchai" (ภาค1/1) and "Wichai" (ภาค2/1) contain "chai".
  assert.deepEqual(await ids(res), ["ภาค1/1", "ภาค2/1"]);
});

test("case-insensitive: uppercase query matches lowercase-stored value", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("name=SOMCHAI&match=exact"));
  assert.deepEqual(await ids(res), ["ภาค1/1"]);
});

test("startsWith match anchors at the beginning", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("name=Som&match=startsWith"));
  // "Somchai" (first) and "Somsak" (last) both start with "Som".
  assert.deepEqual(await ids(res), ["ภาค1/1", "ภาค2/1"]);
});

test("exact match requires the whole value", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("name=Som&match=exact"));
  assert.deepEqual(await ids(res), []); // no one is named exactly "Som"
});

test("name matches either first or last name", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("name=Khao&match=exact"));
  assert.deepEqual(await ids(res), ["ภาค1/2"]);
});

test("searches by unit", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("unit=ตชด.447&match=exact"));
  assert.deepEqual(await ids(res), ["ภาค1/1"]);
});

test("searches by phone (contains)", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("phone=081-&match=startsWith"));
  assert.deepEqual(await ids(res), ["ภาค1/1", "ภาค2/1"]);
});

test("searches by position", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("position=รอง&match=contains"));
  assert.deepEqual(await ids(res), ["ภาค2/1"]);
});

test("multi-field AND: rank + region narrows the result", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("rank=ร.ต.ท.&region=ภาค1&match=exact"));
  assert.deepEqual(await ids(res), ["ภาค1/2"]);
});

test("numeric thresholds: minCareerYears and minQuality", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("minCareerYears=10&minQuality=70"));
  assert.deepEqual(await ids(res), ["ภาค1/1", "ภาค1/2"]);
});

test("search with no parameters is a 400 (must provide at least one)", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("match=contains"));
  assert.equal(res.status, 400);
});

test("search results are paginated with meta", async () => {
  const res = await handleOfficerSearch(container(), new URLSearchParams("rank=ร.ต.ท.&match=exact&pageSize=1&page=1"));
  const json = (await res.json()) as { data: unknown[]; meta: Record<string, number> };
  assert.equal(json.data.length, 1);
  assert.equal(json.meta.total, 2);
  assert.equal(json.meta.totalPages, 2);
});
