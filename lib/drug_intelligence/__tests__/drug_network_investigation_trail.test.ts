/**
 * Network expand-context trail — URL/client navigation only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  appendNetworkTrailStep,
  buildNetworkTrailReturnFocus,
  clearNetworkTrailUrlPatch,
  NETWORK_TRAIL_MAX_PREVIOUS,
  networkTrailUrlPatch,
  parseNetworkInvestigationTrail,
  sanitizeNetworkTrailLabel,
  shouldShowNetworkTrail,
} from "@/lib/drug_intelligence/drug_network_investigation_trail";
import { applyNetworkSearchParamPatch } from "@/lib/drug_intelligence/drug_network_route_navigation";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");
const trailSource = readFileSync(path.join(dir, "..", "drug_network_investigation_trail.ts"), "utf8");
const uiSource = readFileSync(path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_investigation_trail.tsx"), "utf8");

const PERSON = {
  type: "PERSON" as const,
  id: "04d2ac30-976a-460d-b77d-31e74153e59f",
  label: "นายกิตติศักดิ์ ทดสอบระบบ",
};
const VEHICLE = {
  type: "VEHICLE" as const,
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  label: "TEST-9009",
};
const CASE_NODE = {
  type: "CASE" as const,
  id: "11111111-2222-3333-4444-555555555555",
  label: "DI-TEST-005",
};

test("expand from PERSON to VEHICLE preserves origin context in URL params", () => {
  const next = appendNetworkTrailStep([], PERSON);
  const patch = networkTrailUrlPatch(next);
  const params = applyNetworkSearchParamPatch(
    new URLSearchParams("focusType=PERSON&focusId=04d2ac30-976a-460d-b77d-31e74153e59f&depth=2&view=by-depth"),
    { focusType: "VEHICLE", focusId: VEHICLE.id, ...patch }
  );
  assert.equal(params.get("focusType"), "VEHICLE");
  assert.equal(params.get("focusId"), VEHICLE.id);
  assert.equal(params.get("from"), `PERSON:${PERSON.id}`);
  assert.equal(parseNetworkInvestigationTrail(params)[0]?.label, PERSON.label);
  assert.equal(params.get("depth"), "2");
  assert.equal(params.get("view"), "by-depth");
});

test("trail renders original then current entities and return restores PERSON", () => {
  const previous = parseNetworkInvestigationTrail(
    new URLSearchParams(networkTrailUrlPatch([PERSON]) as Record<string, string>)
  );
  assert.equal(previous[0]?.id, PERSON.id);
  assert.equal(previous[0]?.label, PERSON.label);
  assert.equal(shouldShowNetworkTrail({ previous, currentFocusId: VEHICLE.id }), true);
  const restore = buildNetworkTrailReturnFocus(previous)!;
  const back = applyNetworkSearchParamPatch(
    new URLSearchParams(`focusType=VEHICLE&focusId=${VEHICLE.id}&depth=2&view=by-depth&from=PERSON:${PERSON.id}`),
    { focusType: restore.focusType, focusId: restore.focusId, ...clearNetworkTrailUrlPatch() }
  );
  assert.equal(back.get("focusType"), "PERSON");
  assert.equal(back.get("focusId"), PERSON.id);
  assert.equal(back.get("from"), null);
  assert.equal(back.get("fromLabels"), null);
  assert.equal(back.get("depth"), "2");
  assert.equal(back.get("view"), "by-depth");
});

test("invalid trail params fail safely and never accept a return URL", () => {
  assert.deepEqual(parseNetworkInvestigationTrail(new URLSearchParams("from=https://evil.example")), []);
  assert.deepEqual(parseNetworkInvestigationTrail(new URLSearchParams("from=PERSON:../etc/passwd")), []);
  assert.deepEqual(parseNetworkInvestigationTrail(new URLSearchParams("from=UNKNOWN:04d2ac30-976a-460d-b77d-31e74153e59f")), []);
  assert.deepEqual(parseNetworkInvestigationTrail(new URLSearchParams({ from: `PERSON:${PERSON.id},PERSON:${PERSON.id}` })), []);
  assert.equal(sanitizeNetworkTrailLabel("<script>x</script>"), "scriptx/script");
  assert.doesNotMatch(trailSource, /returnTo/);
  assert.doesNotMatch(uiSource, /returnTo|https?:\/\//);
  assert.match(pageSource, /networkTrailUrlPatch/);
  assert.match(pageSource, /clearNetworkTrailUrlPatch/);
  assert.doesNotMatch(pageSource, /expandFromNode[\s\S]{0,500}returnTo=/);
});

test("depth and view stay on expand; history stays push-compatible", () => {
  const expandStart = pageSource.indexOf("function expandFromNode");
  const expandBody = pageSource.slice(expandStart, pageSource.indexOf("function returnToTrailOrigin"));
  assert.match(expandBody, /networkTrailUrlPatch/);
  assert.doesNotMatch(expandBody, /depth:\s*undefined/);
  assert.match(pageSource, /router\.push\(buildNetworkSameRouteHref\(next\),\s*NETWORK_SAME_ROUTE_ROUTER_OPTIONS\)/);
  assert.doesNotMatch(pageSource, /router\.replace\(/);
});

test("trail helpers do not mutate graph semantics or write to an API/DB", () => {
  assert.doesNotMatch(trailSource, /SUPPLIED_BY|prisma|fetch\(|localStorage|sessionStorage/);
  assert.doesNotMatch(pageSource, /function expandFromNode[\s\S]{0,800}mutate|function returnToTrailOrigin[\s\S]{0,500}mutate/);
  assert.match(uiSource, /เส้นทางการสำรวจ|di\.network\.trailHeading/);
  assert.match(uiSource, /กลับไปยัง|di\.network\.trailReturnTo/);
  const trailThenCanvas = pageSource.match(/DrugNetworkInvestigationTrail[\s\S]{0,400}ref=\{canvasContainerRef\}/);
  assert.ok(trailThenCanvas, "trail must sit immediately above the graph canvas");
  assert.doesNotMatch(pageSource, /DrugNetworkInvestigationTrail[\s\S]{0,200}DrugNetworkReadabilitySummary/);
});

test("multi-step trail is bounded and keeps origin plus current context", () => {
  assert.equal(NETWORK_TRAIL_MAX_PREVIOUS, 3);
  const one = appendNetworkTrailStep([], PERSON);
  const two = appendNetworkTrailStep(one, VEHICLE);
  const three = appendNetworkTrailStep(two, CASE_NODE);
  const four = appendNetworkTrailStep(three, {
    type: "PHONE",
    id: "99999999-8888-7777-6666-555555555555",
    label: "overflow",
  });
  assert.deepEqual(three.map((step) => step.id), [PERSON.id, VEHICLE.id, CASE_NODE.id]);
  assert.equal(four.length, 3);
  assert.equal(four[0]?.id, PERSON.id);
  assert.equal(four.at(-1)?.label, "overflow");
  assert.equal(four.some((step) => step.id === VEHICLE.id), false);
});
