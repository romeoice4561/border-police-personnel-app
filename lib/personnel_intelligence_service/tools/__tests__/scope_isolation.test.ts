import { test } from "node:test";
import assert from "node:assert/strict";
import { executeIntelligenceTool } from "@/lib/personnel_intelligence_service/tools/executor";
import { resolveIntelligenceToolScope } from "@/lib/personnel_intelligence_service/tools/scope_resolver";
import { getIntelligenceToolRegistry } from "@/lib/personnel_intelligence_service/tools/registry";
import { makeBundle, officer } from "./_fixtures";

test("scope: unrestricted commander accepts narrower region scope", () => {
  const bundle = makeBundle("commander", [officer("a", { regionId: 1 }), officer("b", { regionId: 2 })]);
  const resolved = resolveIntelligenceToolScope(bundle.actor, { regionId: 1 });
  assert.equal(resolved.authorized.unrestricted, true);
  assert.equal(resolved.effective.regionId, 1);
});

test("scope: invalid organization id rejected", () => {
  const bundle = makeBundle("commander", [officer("a")]);
  assert.throws(() => resolveIntelligenceToolScope(bundle.actor, { regionId: -1 }));
});

test("scope: officer cannot escalate via org scope on own-detail tool", async () => {
  const bundle = makeBundle("officer", [officer("ภาค4/79")], "ภาค4/79");
  // officer detail input does not take regionId — unknown key rejected
  const result = await executeIntelligenceTool({
    toolName: "get_officer_intelligence",
    input: { officerId: "ภาค4/79", regionId: 1 },
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "INVALID_TOOL_INPUT");
});

test("isolation: registry holds no dataset / actor state", () => {
  const reg = getIntelligenceToolRegistry();
  const blob = JSON.stringify(
    [...reg.values()].map((d) => ({
      name: d.name,
      version: d.version,
      category: d.category,
      capability: d.capability,
    }))
  );
  assert.equal(blob.includes("officerId"), false);
  assert.equal(blob.includes("CommanderQuery"), false);
  assert.equal(blob.includes("mock:admin"), false);
});

test("determinism: same tool/input/context/asOf yields same data", async () => {
  const bundle = makeBundle("admin", [officer("a"), officer("b")]);
  const input = { asOf: "2026-07-23T00:00:00.000Z" };
  const r1 = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input,
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  const r2 = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input,
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(r1.ok && r2.ok, true);
  if (r1.ok && r2.ok) assert.deepEqual(r1.data, r2.data);
});
