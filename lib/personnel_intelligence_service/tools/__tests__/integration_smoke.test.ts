/**
 * Integration-style smoke for Phase 49.6 tools (fixture dataset — no Next server-only).
 * Live DB smoke is covered by Phase 49.5 API routes; this proves the executor path.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { executeIntelligenceTool } from "@/lib/personnel_intelligence_service/tools/executor";
import { FORBIDDEN_INTELLIGENCE_KEYS } from "@/lib/personnel_intelligence_service/serializers";
import { makeBundle, officer } from "./_fixtures";

function assertNoSensitive(data: unknown): void {
  const blob = JSON.stringify(data).toLowerCase();
  for (const key of FORBIDDEN_INTELLIGENCE_KEYS) {
    assert.equal(blob.includes(key.toLowerCase()), false, key);
  }
}

test("integration smoke: admin tools + officer denial + invalid cases", async () => {
  const admin = makeBundle("admin", [
    officer("a", { priority: "high" }),
    officer("ภาค4/79", { priority: "medium" }),
    officer("c"),
  ]);

  const summary = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: admin.actor,
    service: admin.service,
    serviceContext: admin.context,
  });
  assert.equal(summary.ok, true);
  if (summary.ok) {
    assert.equal((summary.data as { personnelTotal: number }).personnelTotal, 3);
    assertNoSensitive(summary.data);
  }

  const search = await executeIntelligenceTool({
    toolName: "search_officers",
    input: { readyForPromotion: true, page: 1, pageSize: 5 },
    actor: admin.actor,
    service: admin.service,
    serviceContext: admin.context,
  });
  assert.equal(search.ok, true);

  const detail = await executeIntelligenceTool({
    toolName: "get_officer_intelligence",
    input: { officerId: "a" },
    actor: admin.actor,
    service: admin.service,
    serviceContext: admin.context,
  });
  assert.equal(detail.ok, true);
  if (detail.ok) assertNoSensitive(detail.data);

  const brief = await executeIntelligenceTool({
    toolName: "get_executive_brief",
    input: {},
    actor: admin.actor,
    service: admin.service,
    serviceContext: admin.context,
  });
  assert.equal(brief.ok, true);

  const report = await executeIntelligenceTool({
    toolName: "get_report_projection",
    input: { type: "monthlyBrief" },
    actor: admin.actor,
    service: admin.service,
    serviceContext: admin.context,
  });
  assert.equal(report.ok, true);

  const officerUser = makeBundle("officer", [officer("ภาค4/79"), officer("a")], "ภาค4/79");
  assert.notEqual(officerUser.context.contextId, admin.context.contextId);

  const forbidden = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: officerUser.actor,
    service: officerUser.service,
    serviceContext: officerUser.context,
  });
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) assert.equal(forbidden.error.code, "FORBIDDEN");

  const own = await executeIntelligenceTool({
    toolName: "get_officer_intelligence",
    input: { officerId: "ภาค4/79" },
    actor: officerUser.actor,
    service: officerUser.service,
    serviceContext: officerUser.context,
  });
  assert.equal(own.ok, true);

  const other = await executeIntelligenceTool({
    toolName: "get_officer_intelligence",
    input: { officerId: "a" },
    actor: officerUser.actor,
    service: officerUser.service,
    serviceContext: officerUser.context,
  });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.error.code, "FORBIDDEN");

  const missing = await executeIntelligenceTool({
    toolName: "nope",
    input: {},
    actor: admin.actor,
    service: admin.service,
    serviceContext: admin.context,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "TOOL_NOT_FOUND");

  const pageSize = await executeIntelligenceTool({
    toolName: "search_officers",
    input: { pageSize: 101 },
    actor: admin.actor,
    service: admin.service,
    serviceContext: admin.context,
  });
  assert.equal(pageSize.ok, false);
  if (!pageSize.ok) assert.equal(pageSize.error.code, "INVALID_TOOL_INPUT");

  // Reuse same context — no second dataset composition
  const summary2 = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: admin.actor,
    service: admin.service,
    serviceContext: admin.context,
  });
  assert.equal(summary2.ok, true);
  if (summary2.ok && summary.ok) {
    assert.equal(summary2.meta.contextId, summary.meta.contextId);
    assert.deepEqual(summary2.data, summary.data);
  }
});
