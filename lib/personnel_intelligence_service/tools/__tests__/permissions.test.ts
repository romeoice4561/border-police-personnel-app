import { test } from "node:test";
import assert from "node:assert/strict";
import { executeIntelligenceTool } from "@/lib/personnel_intelligence_service/tools/executor";
import {
  assertCanExecuteIntelligenceTool,
  canExecuteIntelligenceTool,
} from "@/lib/personnel_intelligence_service/tools/permission_resolver";
import { getIntelligenceToolDefinition } from "@/lib/personnel_intelligence_service/tools/registry";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";
import { makeBundle, officer } from "./_fixtures";

test("permissions: admin and commander allowed for summary", () => {
  const def = getIntelligenceToolDefinition("get_commander_summary");
  const admin = makeBundle("admin", [officer("a")]);
  const commander = makeBundle("commander", [officer("a")]);
  assert.equal(canExecuteIntelligenceTool(admin.actor, def, {}), true);
  assert.equal(canExecuteIntelligenceTool(commander.actor, def, {}), true);
  assertCanExecuteIntelligenceTool(admin.actor, def, {});
});

test("permissions: officer denied summary and search; allowed own detail only", async () => {
  const officers = [officer("ภาค4/79"), officer("other")];
  const bundle = makeBundle("officer", officers, "ภาค4/79");

  const summary = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(summary.ok, false);
  if (!summary.ok) assert.equal(summary.error.code, "FORBIDDEN");

  const search = await executeIntelligenceTool({
    toolName: "search_officers",
    input: {},
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(search.ok, false);
  if (!search.ok) assert.equal(search.error.code, "FORBIDDEN");

  const own = await executeIntelligenceTool({
    toolName: "get_officer_intelligence",
    input: { officerId: "ภาค4/79" },
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(own.ok, true);

  const other = await executeIntelligenceTool({
    toolName: "get_officer_intelligence",
    input: { officerId: "other" },
    actor: bundle.actor,
    service: bundle.service,
    serviceContext: bundle.context,
  });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.error.code, "FORBIDDEN");
});

test("permissions: capability check happens before handler (forbidden never returns data)", async () => {
  const bundle = makeBundle("officer", [officer("a")]);
  let calls = 0;
  const wrapped = {
    ...bundle.service,
    getCommanderSummary: () => {
      calls += 1;
      return bundle.service.getCommanderSummary();
    },
  };
  const result = await executeIntelligenceTool({
    toolName: "get_commander_summary",
    input: {},
    actor: bundle.actor,
    service: wrapped,
    serviceContext: bundle.context,
  });
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test("permissions: assertCanExecute throws FORBIDDEN for officer summary", () => {
  const def = getIntelligenceToolDefinition("get_commander_summary");
  const bundle = makeBundle("officer", [officer("a")], "a");
  assert.throws(
    () => assertCanExecuteIntelligenceTool(bundle.actor, def, {}),
    (e: unknown) => e instanceof IntelligenceToolError && e.code === "FORBIDDEN"
  );
});
