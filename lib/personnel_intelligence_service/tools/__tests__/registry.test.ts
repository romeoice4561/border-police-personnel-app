import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTELLIGENCE_TOOL_NAMES,
  getIntelligenceToolDefinition,
  getIntelligenceToolManifest,
  getIntelligenceToolRegistry,
  hasIntelligenceTool,
  listIntelligenceToolDefinitions,
} from "@/lib/personnel_intelligence_service/tools/index";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";

test("registry: exactly nine unique canonical tools", () => {
  assert.equal(INTELLIGENCE_TOOL_NAMES.length, 9);
  assert.equal(listIntelligenceToolDefinitions().length, 9);
  assert.equal(new Set(INTELLIGENCE_TOOL_NAMES).size, 9);
  for (const name of INTELLIGENCE_TOOL_NAMES) {
    assert.equal(hasIntelligenceTool(name), true);
  }
});

test("registry: unknown name not found", () => {
  assert.equal(hasIntelligenceTool("hack_the_planet"), false);
  assert.throws(
    () => getIntelligenceToolDefinition("hack_the_planet"),
    (e: unknown) => e instanceof IntelligenceToolError && e.code === "TOOL_NOT_FOUND"
  );
});

test("registry: every tool is read-only with version/category/title/description/capability/validation", () => {
  for (const def of listIntelligenceToolDefinitions()) {
    assert.equal(def.readOnly, true);
    assert.ok(def.version.length > 0);
    assert.ok(def.category);
    assert.ok(def.title.th && def.title.en);
    assert.ok(def.description.th && def.description.en);
    assert.ok(def.capability.startsWith("intelligence."));
    assert.ok(typeof def.inputSchema.parse === "function");
    assert.ok(Array.isArray(def.inputSchema.fields));
    assert.ok(typeof def.handler === "function");
  }
});

test("registry: callers cannot mutate the canonical registry", () => {
  const reg = getIntelligenceToolRegistry() as Map<string, unknown>;
  reg.set("evil_tool", {});
  assert.equal(hasIntelligenceTool("evil_tool"), false);
  assert.equal(getIntelligenceToolRegistry().size, 9);
  assert.equal(listIntelligenceToolDefinitions().length, 9);
});

test("manifest excludes handlers and auth internals", () => {
  const manifest = getIntelligenceToolManifest();
  assert.equal(manifest.length, 9);
  const blob = JSON.stringify(manifest);
  assert.equal(blob.includes("handler"), false);
  assert.equal(blob.includes("inputSchema"), false);
  assert.equal(blob.includes("parse"), false);
  assert.equal(blob.includes("Prisma"), false);
  for (const entry of manifest) {
    assert.equal(entry.readOnly, true);
    assert.ok(entry.inputDescription.length >= 0);
  }
});
