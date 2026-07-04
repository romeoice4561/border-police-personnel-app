/**
 * API client integration tests (Phase 14): the client's request building and
 * envelope unwrapping against a mocked global fetch — no running server.
 * Verifies success unwrap, error-envelope → ApiClientError, query-string
 * building, and network-failure handling.
 *
 * Run with:
 *   npx tsx --test lib/ui/__tests__/api_client.test.ts
 */

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import { apiClient, ApiClientError } from "@/lib/ui/api_client";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Installs a fake fetch that records the URL and returns the given body/status. */
function mockFetch(body: unknown, status = 200): { urls: string[] } {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { urls };
}

test("listOfficers unwraps { data, meta } and builds the query string", async () => {
  const rec = mockFetch({ data: [{ officerId: "ภาค1/1", rank: "ร.ต.ท." }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

  const result = await apiClient.listOfficers({ page: 2, pageSize: 10, rank: "ร.ต.ท." });

  assert.equal(result.data.length, 1);
  assert.equal(result.meta.total, 1);
  const url = rec.urls[0];
  assert.match(url, /\/api\/officers\?/);
  assert.match(url, /page=2/);
  assert.match(url, /pageSize=10/);
  assert.match(url, /rank=/);
});

test("listOfficers drops undefined/empty query params", async () => {
  const rec = mockFetch({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  await apiClient.listOfficers({ page: 1, rank: undefined, unit: "" });
  const url = rec.urls[0];
  assert.doesNotMatch(url, /rank=/);
  assert.doesNotMatch(url, /unit=/);
});

test("getOfficer returns the profile data", async () => {
  mockFetch({ data: { officer: { id: "ภาค1/1" }, timeline: [], phones: [], quality: {} } });
  const profile = await apiClient.getOfficer("ภาค1/1");
  assert.equal(profile.officer.id, "ภาค1/1");
});

test("an error envelope becomes an ApiClientError carrying status + code", async () => {
  mockFetch({ error: { code: "NOT_FOUND", message: "Officer 'x' not found" } }, 404);
  await assert.rejects(
    () => apiClient.getOfficer("x"),
    (err: unknown) => {
      assert.ok(err instanceof ApiClientError);
      assert.equal(err.status, 404);
      assert.equal(err.code, "NOT_FOUND");
      return true;
    }
  );
});

test("a 503 with error envelope surfaces the service-unavailable code", async () => {
  mockFetch({ error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable" } }, 503);
  await assert.rejects(
    () => apiClient.getStatistics(),
    (err: unknown) => err instanceof ApiClientError && err.status === 503 && err.code === "SERVICE_UNAVAILABLE"
  );
});

test("a network failure becomes an ApiClientError with a friendly message", async () => {
  globalThis.fetch = (async () => {
    throw new Error("connection refused");
  }) as typeof fetch;

  await assert.rejects(
    () => apiClient.getHealth(),
    (err: unknown) => err instanceof ApiClientError && err.code === "NETWORK_ERROR"
  );
});

test("searchOfficers hits /search and returns paginated data", async () => {
  const rec = mockFetch({ data: [{ officerId: "ภาค1/1" }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1, match: "contains" } });
  const result = await apiClient.searchOfficers({ name: "som", match: "contains" });
  assert.equal(result.meta.match, "contains");
  assert.match(rec.urls[0], /\/api\/search\?/);
  assert.match(rec.urls[0], /name=som/);
});
