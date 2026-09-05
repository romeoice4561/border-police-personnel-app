import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

test("Network page can open saved boards through the client/hooks layer, not the service", () => {
  const page = readFileSync(join(ROOT, "app/drug-intelligence/network/page.tsx"), "utf8");
  assert.doesNotMatch(page, /investigationBoardService/);
  assert.match(page, /boardId/);
  assert.match(page, /focusType/);
  assert.match(page, /focusId/);
  assert.match(page, /buildSavedBoardNetworkHref/);
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
