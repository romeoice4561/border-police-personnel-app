import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

test("ad-hoc Network page does not create or depend on saved boards", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
  assert.doesNotMatch(page, /investigationBoardService|createInvestigationBoard|boardId/);
  assert.match(page, /focusType/);
  assert.match(page, /focusId/);
});

test("entity and commander deep-link helpers still target ad-hoc Network", () => {
  const routes = readFileSync(join(ROOT, "lib/drug_intelligence/drug_entity_routes.ts"), "utf8");
  const commander = readFileSync(join(ROOT, "lib/drug_intelligence/drug_commander_drilldown.ts"), "utf8");
  const trail = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_investigation_trail.tsx"), "utf8");
  assert.match(routes, /\/drug-intelligence\/network/);
  assert.doesNotMatch(routes, /boardId/);
  assert.match(commander, /network/);
  assert.doesNotMatch(commander, /createInvestigationBoard/);
  assert.match(trail, /\/drug-intelligence\/network/);
});
