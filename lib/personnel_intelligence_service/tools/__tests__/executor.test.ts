import { test } from "node:test";
import assert from "node:assert/strict";
import { executeIntelligenceTool } from "@/lib/personnel_intelligence_service/tools/executor";
import { assertSafeIntelligenceToolOutput } from "@/lib/personnel_intelligence_service/tools/output_validator";
import { makeBundle, officer } from "./_fixtures";

test("executor: successful summary + stable envelope + requestId", async () => {
  const bundle = makeBundle("admin", [officer("a"), officer("b")]);
  const result = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
    requestId: "fixed-req-1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.tool.name, "get_commander_summary");
  assert.equal(result.meta.requestId, "fixed-req-1");
  assert.equal(result.meta.contextId, bundle.context.contextId);
  assert.ok(typeof result.meta.durationMs === "number");
  assert.equal((result.data as { personnelTotal: number }).personnelTotal, 2);
  assertSafeIntelligenceToolOutput(result.data);
});

test("executor: tool not found / invalid input / missing service", async () => {
  const bundle = makeBundle("admin", [officer("a")]);
  const missing = await executeIntelligenceTool({
    toolName: "no_such_tool",
    input: {},
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error.code, "TOOL_NOT_FOUND");

  const badPage = await executeIntelligenceTool({
    toolName: "search_officers",
    input: { pageSize: 101 },
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(badPage.ok, false);
  if (!badPage.ok) assert.equal(badPage.error.code, "INVALID_TOOL_INPUT");

  const noSvc = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: bundle.actor,
  });
  assert.equal(noSvc.ok, false);
  if (!noSvc.ok) assert.equal(noSvc.error.code, "INTERNAL_ERROR");
});

test("executor: handler executes exactly once; service context reused", async () => {
  const bundle = makeBundle("admin", [officer("a")]);
  let calls = 0;
  const wrapped = {
    ...bundle.service,
    getCommanderSummary: (input?: Parameters<typeof bundle.service.getCommanderSummary>[0]) => {
      calls += 1;
      return bundle.service.getCommanderSummary(input);
    },
    getContextId: () => bundle.service.getContextId(),
  };

  const a = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: bundle.actor,
    service: wrapped,
    serviceContext: bundle.context,
  });
  const b = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: bundle.actor,
    service: wrapped,
    serviceContext: bundle.context,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(calls, 2);
  if (a.ok && b.ok) {
    assert.equal(a.meta.contextId, b.meta.contextId);
    assert.deepEqual(a.data, b.data);
  }
});

test("executor: all nine tools delegate and return safe DTOs", async () => {
  const bundle = makeBundle("admin", [
    officer("a", { priority: "high" }),
    officer("b"),
  ]);
  const cases: Array<{ name: string; input: unknown }> = [
    { name: "get_commander_summary", input: {} },
    { name: "search_officers", input: { page: 1, pageSize: 10 } },
    { name: "get_officer_intelligence", input: { officerId: "a" } },
    { name: "get_promotion_summary", input: {} },
    { name: "get_retirement_summary", input: {} },
    { name: "get_document_summary", input: {} },
    { name: "get_training_summary", input: {} },
    { name: "get_executive_brief", input: {} },
    { name: "get_report_projection", input: { type: "monthlyBrief" } },
  ];
  for (const c of cases) {
    const result = await executeIntelligenceTool({
      toolName: c.name,
      input: c.input,
      actor: bundle.actor,
      service: bundle.service,
      serviceContext: bundle.context,
    });
    assert.equal(result.ok, true, c.name);
    if (result.ok) assertSafeIntelligenceToolOutput(result.data);
  }
});

test("executor: request isolation — distinct contextIds", async () => {
  const a = makeBundle("admin", [officer("a")]);
  const b = makeBundle("admin", [officer("b")]);
  assert.notEqual(a.context.contextId, b.context.contextId);
  const ra = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: a.actor,
    service: a.service,
    serviceContext: a.context,
  });
  const rb = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: b.actor,
    service: b.service,
    serviceContext: b.context,
  });
  assert.equal(ra.ok && rb.ok, true);
  if (ra.ok && rb.ok) {
    assert.notEqual(ra.meta.contextId, rb.meta.contextId);
    assert.equal((ra.data as { personnelTotal: number }).personnelTotal, 1);
    assert.equal((rb.data as { personnelTotal: number }).personnelTotal, 1);
  }
});

test("executor: dataset not mutated; input not mutated", async () => {
  const bundle = makeBundle("admin", [officer("a")]);
  const input = { page: 1, pageSize: 5, priority: "high" };
  const inputSnap = JSON.stringify(input);
  const idsSnap = bundle.dataset.officers.map((o) => o.officerId);
  await executeIntelligenceTool({
    toolName: "search_officers",
    input,
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(JSON.stringify(input), inputSnap);
  assert.deepEqual(
    bundle.dataset.officers.map((o) => o.officerId),
    idsSnap
  );
});

test("executor: unsafe fake handler output → OUTPUT_VALIDATION_FAILED", async () => {
  const bundle = makeBundle("admin", [officer("a")]);
  const wrapped = {
    ...bundle.service,
    getCommanderSummary: () => ({ personnelTotal: 1, nationalId: "LEAK" }) as never,
    getContextId: () => bundle.service.getContextId(),
  };
  const result = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: bundle.actor,
    service: wrapped,
    serviceContext: bundle.context,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "OUTPUT_VALIDATION_FAILED");
    assert.equal("data" in result, false);
  }
});
