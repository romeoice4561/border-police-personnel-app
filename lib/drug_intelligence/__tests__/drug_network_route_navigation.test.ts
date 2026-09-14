/**
 * Same-route Network URL updates must keep page scroll position.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";
import {
  applyNetworkSearchParamPatch,
  buildNetworkSameRouteHref,
  NETWORK_SAME_ROUTE_ROUTER_OPTIONS,
} from "@/lib/drug_intelligence/drug_network_route_navigation";
import { connectionDepthUrlPatch } from "@/lib/drug_intelligence/drug_network_connection_depth";
import { depthViewUrlPatch } from "@/lib/drug_intelligence/drug_network_depth_view";

const dir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(dir, "..", "..", "..", "app", "drug-intelligence", "network", "page.tsx"), "utf8");

test("same-route Network router options disable page scroll-to-top", () => {
  assert.deepEqual(NETWORK_SAME_ROUTE_ROUTER_OPTIONS, { scroll: false });
});

test("depth and view patches preserve focusType/focusId and update only those params", () => {
  const current = new URLSearchParams(
    "focusType=PERSON&focusId=04d2ac30-976a-460d-b77d-31e74153e59f&depth=2&view=by-depth"
  );
  const afterView = applyNetworkSearchParamPatch(current, depthViewUrlPatch("FULL_NETWORK"));
  assert.equal(afterView.get("focusType"), "PERSON");
  assert.equal(afterView.get("focusId"), "04d2ac30-976a-460d-b77d-31e74153e59f");
  assert.equal(afterView.get("depth"), "2");
  assert.equal(afterView.get("view"), "full");

  const afterDepth = applyNetworkSearchParamPatch(afterView, connectionDepthUrlPatch(1));
  assert.equal(afterDepth.get("focusType"), "PERSON");
  assert.equal(afterDepth.get("focusId"), "04d2ac30-976a-460d-b77d-31e74153e59f");
  assert.equal(afterDepth.get("depth"), "1");
  assert.equal(afterDepth.get("view"), "full");
  assert.equal(
    buildNetworkSameRouteHref(afterDepth),
    "/drug-intelligence/network?focusType=PERSON&focusId=04d2ac30-976a-460d-b77d-31e74153e59f&depth=1&view=full"
  );
});

test("page same-route updateParams uses no-scroll push; real leave navigation does not", () => {
  assert.match(pageSource, /router\.push\(buildNetworkSameRouteHref\(next\),\s*NETWORK_SAME_ROUTE_ROUTER_OPTIONS\)/);
  const leaveNav = pageSource.slice(pageSource.indexOf("function requestNavigateHref"), pageSource.indexOf("function confirmPendingLeave"));
  assert.match(leaveNav, /router\.push\(href\)/);
  assert.doesNotMatch(leaveNav, /scroll:\s*false/);
});

test("fitView/setViewport are graph-only and do not call window page scroll helpers", () => {
  assert.doesNotMatch(pageSource, /window\.scrollTo/);
  assert.doesNotMatch(pageSource, /scrollIntoView/);
  assert.match(pageSource, /fitView\(/);
  assert.match(pageSource, /setViewport\(/);
});
