/**
 * DI-10E.6C — Map case-detail cache, race, and abort helpers.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDrugMapCaseDetailSession, type DrugMapCaseDetailResult } from "@/lib/drug_intelligence/drug_map_case_detail_client";

const ROOT = join(process.cwd());

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

test("second open of the same case uses cache", async () => {
  let calls = 0;
  const session = createDrugMapCaseDetailSession(async (caseId) => {
    calls += 1;
    return detail(caseId);
  });
  const first = await session.load("case-a");
  const second = await session.load("case-a");
  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(calls, 1);
});

test("stale A cannot overwrite B", async () => {
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
});

test("abort is not treated as a user-facing failure", async () => {
  const session = createDrugMapCaseDetailSession(async (_caseId, signal) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 50);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    return detail("late");
  });
  const pending = session.load("case-a");
  session.close();
  const result = await pending;
  assert.equal(result.aborted, true);
  assert.equal(result.data, null);
});

test("page and client keep Map V2 fetch separate from detail fetch", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/map/page.tsx"), "utf8");
  const client = readFileSync(join(ROOT, "lib/drug_intelligence/drug_map_case_detail_client.ts"), "utf8");
  assert.match(client, /\/api\/drug-intelligence\/map\/cases\//);
  assert.doesNotMatch(client, /localStorage\./);
  assert.doesNotMatch(client, /sessionStorage\./);
  assert.match(page, /useDrugMapCaseDetail/);
  assert.doesNotMatch(page, /fetchDrugGeoResult[\s\S]*persons/);
});
