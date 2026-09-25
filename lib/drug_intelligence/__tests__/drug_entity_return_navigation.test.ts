/**
 * DI-9.5.3 — context-aware entity return navigation (Network ↔ entity detail).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DrugNetworkEdgeDetail } from "@/components/drug_intelligence/drug_network_edge_detail";
import { DrugNetworkNodeDetail } from "@/components/drug_intelligence/drug_network_node_detail";
import { drugEntityDetailHref, drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import type { DrugGraphEdge, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import {
  ENTITY_DETAIL_SEARCH_FALLBACK,
  currentInternalHref,
  entityDetailBackHref,
  getSafeReturnTo,
  isSafeInternalReturnPath,
  withReturnTo,
} from "@/lib/ui/return_context";
import { entityDetailBackLabelKey } from "@/lib/ui/return_to_back_label";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function renderWithProviders(node: ReactNode): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, node));
}

const KITTISAK_ID = "04d2ac30-976a-460d-b77d-31e74153e59f";
const PHONE_ID = "ph-1001";
const SIM_ID = "sim-1001";
const CASE_ID = "11111111-2222-3333-4444-555555555555";
const DEVICE_ID = "dev-1001";
const VEHICLE_ID = "veh-1001";

const PERSON_NETWORK_HREF =
  `/drug-intelligence/network?focusType=PERSON&focusId=${KITTISAK_ID}&depth=2&view=by-depth&from=CASE:${CASE_ID}&fromLabels=DI-TEST-003`;
const CASE_NETWORK_HREF =
  `/drug-intelligence/network?focusType=CASE&focusId=${CASE_ID}&depth=2&view=by-depth`;

function queryOf(href: string): URLSearchParams {
  const query = href.split("?")[1] ?? "";
  return new URLSearchParams(query);
}

function phoneNode(id: string, label: string): DrugGraphNode {
  return {
    id,
    type: "PHONE",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "PHONE", carrier: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function simNode(id: string, label: string): DrugGraphNode {
  return {
    id,
    type: "SIM",
    label,
    secondaryLabel: null,
    maskedLabel: label,
    metadata: { type: "SIM", imsi: null, carrier: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function caseNode(id: string, label: string): DrugGraphNode {
  return {
    id,
    type: "CASE",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: {
      type: "CASE",
      caseNumber: label,
      status: "OPEN",
      arrestDate: null,
      arrestTime: null,
      province: null,
      reportingUnitText: null,
    },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function personNode(id: string, label: string): DrugGraphNode {
  return {
    id,
    type: "PERSON",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "PERSON", status: "ACTIVE", canonicalTarget: null, hasPotentialDuplicate: false },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function deviceNode(id: string, label: string): DrugGraphNode {
  return {
    id,
    type: "DEVICE",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "DEVICE", brand: "Apple", model: "iPhone 14" },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function vehicleNode(id: string, label: string): DrugGraphNode {
  return {
    id,
    type: "VEHICLE",
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type: "VEHICLE", registrationProvince: null, brand: null, model: null, color: null },
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function casePhoneEdge(caseId: string, phoneId: string): DrugGraphEdge {
  return {
    id: `cp:${phoneId}`,
    source: caseId,
    target: phoneId,
    relationshipType: "CASE_PHONE",
    edgeKind: "DIRECT",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds: [caseId],
    explanation: { kind: "DIRECT_LINK" },
  };
}

function roundTrip(entityType: "PHONE" | "SIM" | "DEVICE" | "VEHICLE", entityId: string, networkHref: string): string {
  const href = drugEntityDetailHref(entityType, entityId, networkHref);
  return entityDetailBackHref(queryOf(href));
}

test("A: Network PERSON → Phone return preserves the exact Network path and query", () => {
  const back = roundTrip("PHONE", PHONE_ID, PERSON_NETWORK_HREF);
  assert.equal(back, PERSON_NETWORK_HREF);
  assert.equal(entityDetailBackLabelKey(back), "di.entity.backToNetwork");
});

test("B: Network PERSON → SIM return preserves the same Network context", () => {
  assert.equal(roundTrip("SIM", SIM_ID, PERSON_NETWORK_HREF), PERSON_NETWORK_HREF);
});

test("C: Network CASE → Phone return restores the CASE-focused Network URL", () => {
  assert.equal(roundTrip("PHONE", PHONE_ID, CASE_NETWORK_HREF), CASE_NETWORK_HREF);
});

test("D: focusType, focusId, depth, view, from, and fromLabels survive returnTo encode/decode", () => {
  const restored = new URL(roundTrip("PHONE", PHONE_ID, PERSON_NETWORK_HREF), "https://cintel.local");
  assert.equal(restored.pathname, "/drug-intelligence/network");
  assert.equal(restored.searchParams.get("focusType"), "PERSON");
  assert.equal(restored.searchParams.get("focusId"), KITTISAK_ID);
  assert.equal(restored.searchParams.get("depth"), "2");
  assert.equal(restored.searchParams.get("view"), "by-depth");
  assert.equal(restored.searchParams.get("from"), `CASE:${CASE_ID}`);
  assert.equal(restored.searchParams.get("fromLabels"), "DI-TEST-003");
});

test("E: direct Phone URL without returnTo falls back to Search Center", () => {
  assert.equal(entityDetailBackHref(new URLSearchParams()), ENTITY_DETAIL_SEARCH_FALLBACK);
  assert.equal(entityDetailBackLabelKey(getSafeReturnTo(new URLSearchParams())), "di.entity.backToSearch");
  const phonePage = read("app/drug-intelligence/phones/[id]/page.tsx");
  assert.match(phonePage, /entityDetailBackHref\(searchParams\)/);
  assert.match(phonePage, /entityDetailBackLabelKey\(inboundReturnTo\)/);
});

test("F: direct SIM URL without returnTo falls back to Search Center", () => {
  const simPage = read("app/drug-intelligence/sims/[id]/page.tsx");
  assert.match(simPage, /entityDetailBackHref\(searchParams\)/);
  assert.match(simPage, /entityDetailBackLabelKey\(inboundReturnTo\)/);
  assert.equal(entityDetailBackHref(new URLSearchParams({ caseId: CASE_ID })), ENTITY_DETAIL_SEARCH_FALLBACK);
});

test("G: malicious external returnTo is rejected and falls back to Search", () => {
  assert.equal(isSafeInternalReturnPath("https://evil.example"), false);
  assert.equal(getSafeReturnTo(new URLSearchParams({ returnTo: "https://evil.example" })), null);
  assert.equal(entityDetailBackHref(new URLSearchParams({ returnTo: "https://evil.example" })), ENTITY_DETAIL_SEARCH_FALLBACK);
  assert.equal(withReturnTo(drugEntityDetailPath("PHONE", PHONE_ID), "https://evil.example"), drugEntityDetailPath("PHONE", PHONE_ID));
});

test("H: protocol-relative returnTo is rejected", () => {
  assert.equal(isSafeInternalReturnPath("//evil.example"), false);
  assert.equal(entityDetailBackHref(new URLSearchParams({ returnTo: "//evil.example" })), ENTITY_DETAIL_SEARCH_FALLBACK);
  assert.equal(getSafeReturnTo(new URLSearchParams({ returnTo: "javascript:alert(1)" })), null);
  assert.equal(getSafeReturnTo(new URLSearchParams({ returnTo: "data:text/html,x" })), null);
});

test("I: Device and Vehicle opened from Network use the same safe-return contract", () => {
  assert.equal(roundTrip("DEVICE", DEVICE_ID, PERSON_NETWORK_HREF), PERSON_NETWORK_HREF);
  assert.equal(roundTrip("VEHICLE", VEHICLE_ID, PERSON_NETWORK_HREF), PERSON_NETWORK_HREF);
  const devicePage = read("app/drug-intelligence/devices/[id]/page.tsx");
  const vehiclePage = read("app/drug-intelligence/vehicles/[id]/page.tsx");
  assert.match(devicePage, /entityDetailBackHref\(searchParams\)/);
  assert.match(devicePage, /entityDetailBackLabelKey\(inboundReturnTo\)/);
  assert.match(vehiclePage, /entityDetailBackHref\(searchParams\)/);
  assert.match(vehiclePage, /entityDetailBackLabelKey\(inboundReturnTo\)/);
  const deviceHtml = renderWithProviders(
    createElement(DrugNetworkNodeDetail, {
      node: deviceNode(DEVICE_ID, "iPhone"),
      onExpand: () => undefined,
      openReturnPath: PERSON_NETWORK_HREF,
    })
  );
  const vehicleHtml = renderWithProviders(
    createElement(DrugNetworkNodeDetail, {
      node: vehicleNode(VEHICLE_ID, "TEST-9009"),
      onExpand: () => undefined,
      openReturnPath: PERSON_NETWORK_HREF,
    })
  );
  assert.match(deviceHtml, /returnTo=/);
  assert.match(vehicleHtml, /returnTo=/);
  assert.match(deviceHtml, new RegExp(encodeURIComponent(PERSON_NETWORK_HREF)));
  assert.match(vehicleHtml, new RegExp(encodeURIComponent(PERSON_NETWORK_HREF)));
});

test("currentInternalHref captures live Network pathname and search without reconstructing focus", () => {
  const captured = currentInternalHref("/drug-intelligence/network", new URLSearchParams(PERSON_NETWORK_HREF.split("?")[1]));
  assert.equal(captured, PERSON_NETWORK_HREF.replace(`CASE:${CASE_ID}`, encodeURIComponent(`CASE:${CASE_ID}`)));
  const restored = entityDetailBackHref(queryOf(withReturnTo(drugEntityDetailPath("PHONE", PHONE_ID), captured)));
  assert.equal(restored, captured);
});

test("Network drawers attach the live Network href via withReturnTo, not a guessed root", () => {
  const networkPage = read("app/drug-intelligence/network/page.tsx");
  const edgeDetail = read("components/drug_intelligence/drug_network_edge_detail.tsx");
  const nodeDetail = read("components/drug_intelligence/drug_network_node_detail.tsx");
  assert.match(networkPage, /currentInternalHref\(pathname, searchParams\)/);
  // DI-8.7 V1.5B VISUAL HOTFIX (2nd round): the Inspector drawers now attach
  // temporalAwareReturnPath, not currentNetworkHref directly — it derives
  // from currentNetworkHref (falls back to it exactly) but ALSO carries
  // temporal-focus context when the user is still "in" the temporal
  // workflow (see temporalAwareReturnPath / lastActiveTemporalReturnSelection).
  // Still the same "live Network href, not a guessed root" guarantee.
  assert.match(networkPage, /const temporalAwareReturnPath = useMemo\(\(\) => \{\s*\n\s*if \(!lastActiveTemporalReturnSelection\) return currentNetworkHref;/);
  assert.match(networkPage, /openReturnPath=\{temporalAwareReturnPath\}/);
  assert.doesNotMatch(networkPage, /expandFromNode[\s\S]{0,500}returnTo=/);
  assert.match(edgeDetail, /withReturnTo\(href, openReturnPath\)/);
  assert.match(nodeDetail, /withReturnTo\(drugEntityDetailPath\(node\.type, node\.id\), openReturnPath\)/);
  assert.match(read("lib/drug_intelligence/drug_network_relationship_explainability.ts"), /return drugEntityDetailPath\(type, id\);/);
});

test("Phone/SIM action bar copy is Network-aware without changing intelligence-profile layout", () => {
  const layout = read("components/drug_intelligence/drug_entity_detail_layout.tsx");
  const dict = read("lib/i18n/dictionary.ts");
  assert.match(layout, /backLabelKey \? t\(backLabelKey\)|t\(backLabelKey\)/);
  assert.match(dict, /"di\.entity\.backToNetwork": tr\("← กลับไปยังผังความเชื่อมโยง"/);
  assert.match(dict, /"di\.entity\.backToSearch": tr\("← กลับไปยังการค้นหา"/);
  assert.equal(entityDetailBackLabelKey(PERSON_NETWORK_HREF), "di.entity.backToNetwork");
  assert.equal(entityDetailBackLabelKey(null), "di.entity.backToSearch");
});

test("drawer Phone/SIM links encode the Network returnTo onto canonical entity paths", () => {
  const graphCase = caseNode(CASE_ID, "DI-TEST-003");
  const graphPhone = phoneNode(PHONE_ID, "0900001001");
  const graphSim = simNode(SIM_ID, "89000000000000000001");
  const graphPerson = personNode(KITTISAK_ID, "นายกิตติศักดิ์ ทดสอบระบบ");
  const phoneEdge = casePhoneEdge(CASE_ID, PHONE_ID);
  const html = renderToStaticMarkup(
    createElement(DrugNetworkEdgeDetail, {
      edge: phoneEdge,
      sourceNode: graphCase,
      targetNode: graphPhone,
      neighborhood: {
        nodes: [graphCase, graphPhone, graphSim, graphPerson],
        edges: [phoneEdge],
      },
      focusId: KITTISAK_ID,
      openReturnPath: PERSON_NETWORK_HREF,
    })
  );
  assert.match(html, /\/drug-intelligence\/phones\/ph-1001\?returnTo=/);
  assert.match(html, new RegExp(encodeURIComponent(PERSON_NETWORK_HREF)));
});
