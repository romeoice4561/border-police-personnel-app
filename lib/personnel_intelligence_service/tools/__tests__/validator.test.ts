import { test } from "node:test";
import assert from "node:assert/strict";
import { getIntelligenceToolDefinition } from "@/lib/personnel_intelligence_service/tools/registry";
import { validateIntelligenceToolInput } from "@/lib/personnel_intelligence_service/tools/validator";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";

test("validation: valid search input accepted; input not mutated", () => {
  const def = getIntelligenceToolDefinition("search_officers");
  const input = { page: 1, pageSize: 20, priority: "high", sort: "name", order: "asc" };
  const snapshot = JSON.stringify(input);
  const parsed = validateIntelligenceToolInput(def, input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.ok(parsed && typeof parsed === "object");
});

test("validation: invalid enum / sort / pageSize / date / unknown key rejected", () => {
  const def = getIntelligenceToolDefinition("search_officers");
  assert.throws(
    () => validateIntelligenceToolInput(def, { priority: "nopenope" }),
    (e: unknown) => e instanceof IntelligenceToolError && e.code === "INVALID_TOOL_INPUT"
  );
  assert.throws(
    () => validateIntelligenceToolInput(def, { sort: "hack.path" }),
    (e: unknown) => e instanceof IntelligenceToolError && e.code === "INVALID_TOOL_INPUT"
  );
  assert.throws(
    () => validateIntelligenceToolInput(def, { pageSize: 101 }),
    (e: unknown) => e instanceof IntelligenceToolError && e.code === "INVALID_TOOL_INPUT"
  );
  assert.throws(
    () => validateIntelligenceToolInput(def, { asOf: "not-a-date" }),
    (e: unknown) => e instanceof IntelligenceToolError && e.code === "INVALID_TOOL_INPUT"
  );
  assert.throws(
    () => validateIntelligenceToolInput(def, { unexpectedRoot: 1 }),
    (e: unknown) => e instanceof IntelligenceToolError && e.code === "INVALID_TOOL_INPUT"
  );
});

test("validation: empty input allowed for summary tools", () => {
  const def = getIntelligenceToolDefinition("get_commander_summary");
  const parsed = validateIntelligenceToolInput(def, {});
  assert.ok(parsed && typeof parsed === "object");
  assert.equal((parsed as { asOf?: string }).asOf, undefined);
});

test("validation: report type required and must be known", () => {
  const def = getIntelligenceToolDefinition("get_report_projection");
  assert.throws(
    () => validateIntelligenceToolInput(def, {}),
    IntelligenceToolError
  );
  assert.throws(
    () => validateIntelligenceToolInput(def, { type: "totally-unknown" }),
    (e: unknown) => e instanceof IntelligenceToolError && e.code === "INVALID_TOOL_INPUT"
  );
  const ok = validateIntelligenceToolInput(def, { type: "monthlyBrief" });
  assert.equal((ok as { type: string }).type, "monthlyBrief");
});
