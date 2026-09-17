/**
 * LC-2B two-box Link Compare UX — client state, wording, and source contracts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "path";

import { ApiClientError } from "@/lib/ui/api_client";
import { translate } from "@/lib/i18n/dictionary";
import { DRUG_GRAPH_RELATIONSHIP_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { applyNetworkSearchParamPatch } from "@/lib/drug_intelligence/drug_network_route_navigation";
import {
  buildLinkCompareExplanationParts,
  buildLinkCompareHref,
  canAnalyzeLinkCompare,
  classifyLinkCompareHttpError,
  clearLinkCompareSlot,
  connectionHeadlineKey,
  groupSharedEntities,
  isAnalyzeDisabled,
  isSameCanonicalEntity,
  linkCompareNetworkFocusHref,
  pairIdentityKey,
  parseLinkCompareReturnTo,
  parseLinkCompareSearchParams,
  relationshipWordingKey,
  selectLinkCompareSlot,
  serializeLinkCompareSearchParams,
  sharedJunctionHeading,
  shouldFetchLinkCompare,
  supportingSharedCases,
  visibleSharedCases,
  type LinkCompareSlotSelection,
  type LinkCompareTwoBoxState,
} from "@/lib/drug_intelligence/drug_link_compare_client_state";
import { getSafeReturnTo, withReturnTo } from "@/lib/ui/return_context";
import {
  entityDetailBackLabelKey,
  isLinkCompareReturnTo,
  isNetworkReturnTo,
  returnToBackLabelKey,
} from "@/lib/ui/return_to_back_label";

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const personA: LinkCompareSlotSelection = {
  entityType: "PERSON",
  entityId: "p-kittisak",
  label: "นายกิตติศักดิ์ ทดสอบระบบ",
  caseCount: 3,
};
const vehicleB: LinkCompareSlotSelection = {
  entityType: "VEHICLE",
  entityId: "v-9009",
  label: "TEST-9009",
  caseCount: 2,
};
const phoneC: LinkCompareSlotSelection = {
  entityType: "PHONE",
  entityId: "ph-1001",
  label: "66900001001",
  caseCount: 3,
};

function emptyState(): LinkCompareTwoBoxState {
  return { A: null, B: null };
}

test("empty A/B cannot analyze", () => {
  assert.equal(canAnalyzeLinkCompare(emptyState()), false);
  assert.equal(isAnalyzeDisabled(emptyState(), false), true);
});

test("Analyze is disabled with only A", () => {
  assert.equal(canAnalyzeLinkCompare({ A: personA, B: null }), false);
  assert.equal(isAnalyzeDisabled({ A: personA, B: null }, false), true);
});

test("Analyze is enabled with distinct A+B and disabled while loading", () => {
  const state = { A: personA, B: vehicleB };
  assert.equal(canAnalyzeLinkCompare(state), true);
  assert.equal(isAnalyzeDisabled(state, false), false);
  assert.equal(isAnalyzeDisabled(state, true), true);
});

test("duplicate canonical entity is blocked and does not replace the other slot", () => {
  const start = { A: personA, B: null };
  const applied = selectLinkCompareSlot(start, "B", { ...personA, label: "same person again" });
  assert.equal(applied.error, "duplicate");
  assert.equal(applied.state.B, null);
  assert.equal(applied.state.A?.entityId, personA.entityId);
});

test("choosing A then B keeps both; changing A preserves B; removing A keeps B", () => {
  const afterA = selectLinkCompareSlot(emptyState(), "A", personA);
  assert.equal(afterA.error, null);
  const afterB = selectLinkCompareSlot(afterA.state, "B", vehicleB);
  assert.equal(afterB.state.A?.entityId, personA.entityId);
  assert.equal(afterB.state.B?.entityId, vehicleB.entityId);

  const changedA = selectLinkCompareSlot(afterB.state, "A", phoneC);
  assert.equal(changedA.state.A?.entityId, phoneC.entityId);
  assert.equal(changedA.state.B?.entityId, vehicleB.entityId);

  const changedB = selectLinkCompareSlot(changedA.state, "B", personA);
  assert.equal(changedB.state.A?.entityId, phoneC.entityId);
  assert.equal(changedB.state.B?.entityId, personA.entityId);

  const removedA = clearLinkCompareSlot(changedB.state, "A");
  assert.equal(removedA.A, null);
  assert.equal(removedA.B?.entityId, personA.entityId);
});

test("URL hydration uses type+id identity and never treats labels as identity", () => {
  const params = new URLSearchParams("aType=PERSON&aId=p-kittisak&bType=VEHICLE&bId=v-9009");
  const parsed = parseLinkCompareSearchParams(params);
  assert.equal(parsed.A?.entityType, "PERSON");
  assert.equal(parsed.A?.entityId, "p-kittisak");
  assert.equal(parsed.B?.entityType, "VEHICLE");
  assert.equal(parsed.B?.entityId, "v-9009");
  assert.equal(parsed.A?.label, "");

  const serialized = serializeLinkCompareSearchParams({ A: personA, B: vehicleB });
  assert.equal(serialized.get("aType"), "PERSON");
  assert.equal(serialized.get("aId"), "p-kittisak");
  assert.equal(serialized.get("bType"), "VEHICLE");
  assert.equal(serialized.get("bId"), "v-9009");
  assert.equal(serialized.get("aLabel"), null);
  assert.equal(serialized.has("cType"), false);
  assert.equal(serialized.has("cId"), false);
});

test("malformed URL types and LOCATION fail safely as empty slots", () => {
  const params = new URLSearchParams("aType=LOCATION&aId=loc-1&bType=NOPE&bId=x&cType=PERSON&cId=p-1");
  const parsed = parseLinkCompareSearchParams(params);
  assert.equal(parsed.A, null);
  assert.equal(parsed.B, null);
});

test("duplicate A/B in URL is detected and must not fetch", () => {
  const parsed = parseLinkCompareSearchParams(new URLSearchParams("aType=PERSON&aId=p1&bType=PERSON&bId=p1"));
  assert.equal(isSameCanonicalEntity(parsed.A, parsed.B), true);
  assert.equal(canAnalyzeLinkCompare(parsed), false);
  assert.equal(shouldFetchLinkCompare(pairIdentityKey(parsed), parsed), false);
});

test("changing selection after a submitted compare stops fetching until Analyze", () => {
  const submitted = pairIdentityKey({ A: personA, B: vehicleB });
  assert.equal(shouldFetchLinkCompare(submitted, { A: personA, B: vehicleB }), true);
  assert.equal(shouldFetchLinkCompare(submitted, { A: personA, B: phoneC }), false);
  assert.equal(shouldFetchLinkCompare(null, { A: personA, B: vehicleB }), false);
});

test("DIRECT / INDIRECT / NONE_KNOWN headlines and NONE_KNOWN never says ไม่เกี่ยวข้องกัน", () => {
  assert.equal(translate(connectionHeadlineKey("DIRECT"), "th"), "พบความเชื่อมโยงโดยตรง");
  assert.equal(translate(connectionHeadlineKey("INDIRECT"), "th"), "พบความเชื่อมโยงผ่านตัวกลาง");
  assert.equal(translate(connectionHeadlineKey("NONE_KNOWN"), "th"), "ยังไม่พบความเชื่อมโยงจากข้อมูลที่มีในระบบ");
  assert.doesNotMatch(translate("di.linkCompare.noneKnown", "th"), /ไม่เกี่ยวข้องกัน/);
  assert.doesNotMatch(translate("di.linkCompare.noneKnownHintLong", "th"), /ไม่เกี่ยวข้องกัน/);
});

test("demo A person / B vehicle explanation is DIRECT without ownership wording", () => {
  const parts = buildLinkCompareExplanationParts(
    { connectionKind: "DIRECT", hopCount: 1, shortestPath: { hopCount: 1, steps: [] }, sharedCases: [{ caseId: "c3", caseNumber: "DI-TEST-003", label: "DI-TEST-003" }] },
    { A: personA, B: vehicleB }
  );
  assert.deepEqual(parts[0], { kind: "direct", a: "นายกิตติศักดิ์ ทดสอบระบบ", b: "TEST-9009" });
  const text = translate("di.linkCompare.explainDirect", "th").replace("{a}", personA.label).replace("{b}", vehicleB.label);
  assert.match(text, /นายกิตติศักดิ์ ทดสอบระบบ/);
  assert.match(text, /TEST-9009/);
  assert.doesNotMatch(text, /เจ้าของ/);
});

test("demo vehicle → case → phone explanation is INDIRECT via DI-TEST-003", () => {
  const parts = buildLinkCompareExplanationParts(
    {
      connectionKind: "INDIRECT",
      hopCount: 2,
      shortestPath: {
        hopCount: 2,
        steps: [
          { node: { type: "VEHICLE", label: "TEST-9009" } },
          { node: { type: "CASE", label: "DI-TEST-003" } },
          { node: { type: "PHONE", label: "66900001001" } },
        ],
      },
      sharedCases: [{ caseId: "c3", caseNumber: "DI-TEST-003", label: "DI-TEST-003" }],
    },
    { A: vehicleB, B: phoneC }
  );
  assert.equal(parts[0]?.kind, "indirect");
  if (parts[0]?.kind === "indirect") {
    assert.equal(parts[0].intermediateCount, 1);
    assert.deepEqual(parts[0].viaCaseLabels, ["DI-TEST-003"]);
  }
});

test("multiple shared cases add the extra factual sentence", () => {
  const parts = buildLinkCompareExplanationParts(
    {
      connectionKind: "DIRECT",
      hopCount: 1,
      shortestPath: { hopCount: 1, steps: [] },
      sharedCases: [
        { caseId: "1", caseNumber: "DI-TEST-001", label: "DI-TEST-001" },
        { caseId: "2", caseNumber: "DI-TEST-002", label: "DI-TEST-002" },
        { caseId: "3", caseNumber: "DI-TEST-003", label: "DI-TEST-003" },
      ],
    },
    { A: personA, B: phoneC }
  );
  assert.ok(parts.some((part) => part.kind === "extraSharedCases" && part.count === 3));
});

test("shared cases cap visible rows until expanded", () => {
  const cases = Array.from({ length: 8 }, (_, i) => ({
    caseId: `c${i}`,
    caseNumber: `CASE-${i}`,
    label: `CASE-${i}`,
  }));
  const collapsed = visibleSharedCases(cases, false, 5);
  assert.equal(collapsed.items.length, 5);
  assert.equal(collapsed.hidden, 3);
  assert.equal(visibleSharedCases(cases, true, 5).hidden, 0);
});

test("shared entities group by canonical type using DTO labels", () => {
  const grouped = groupSharedEntities([
    { entityType: "VEHICLE", entityId: "v1", label: "TEST-9009" },
    { entityType: "PHONE", entityId: "p1", label: "669xxx1001" },
  ]);
  assert.deepEqual(
    grouped.map((g) => g.entityType),
    ["PHONE", "VEHICLE"]
  );
  assert.equal(grouped[0].items[0].label, "669xxx1001");
});

test("relationship wording reuses catalog keys and is not raw enums or ownership", () => {
  assert.equal(relationshipWordingKey("PERSON_CASE"), DRUG_GRAPH_RELATIONSHIP_LABEL_KEY.PERSON_CASE);
  assert.equal(relationshipWordingKey("PERSON_VEHICLE"), DRUG_GRAPH_RELATIONSHIP_LABEL_KEY.PERSON_VEHICLE);
  assert.equal(relationshipWordingKey("CASE_PHONE"), DRUG_GRAPH_RELATIONSHIP_LABEL_KEY.CASE_PHONE);
  assert.equal(translate("di.network.relPersonVehicle", "th"), "พบใช้งานยานพาหนะร่วมกัน");
  assert.doesNotMatch(translate("di.network.relPersonVehicle", "th"), /เจ้าของ/);
  assert.doesNotMatch(translate("di.network.relPersonPhone", "th"), /เจ้าของ/);
});

test("HTTP errors map to 400/403/404/retry without exposing stack text", () => {
  assert.equal(classifyLinkCompareHttpError(new ApiClientError("nope", 400, "BAD")), "invalid");
  assert.equal(classifyLinkCompareHttpError(new ApiClientError("nope", 403, "FORBIDDEN")), "forbidden");
  assert.equal(classifyLinkCompareHttpError(new ApiClientError("nope", 404, "NOT_FOUND")), "not_found");
  assert.equal(classifyLinkCompareHttpError(new ApiClientError("nope", 500, "X")), "retryable");
  assert.equal(classifyLinkCompareHttpError(new Error("Prisma explode")), "retryable");
});

test("LC-2B page and workspace source contracts", () => {
  const page = read("app/drug-intelligence/network/compare/page.tsx");
  const workspace = read("components/drug_intelligence/drug_link_compare_workspace.tsx");
  const slot = read("components/drug_intelligence/drug_link_compare_slot.tsx");
  const result = read("components/drug_intelligence/drug_link_compare_result.tsx");
  const network = read("app/drug-intelligence/network/page.tsx");
  const shell = read("components/layout/app_shell.tsx");
  const picker = read("components/drug_intelligence/drug_network_entity_picker.tsx");

  assert.match(page, /DrugLinkCompareWorkspace/);
  assert.match(workspace, /drug\.read/);
  assert.match(workspace, /DrugNetworkEntityPicker/);
  assert.match(workspace, /LINK_COMPARE_PICKER_TYPES/);
  assert.match(workspace, /di\.linkCompare\.analyze/);
  assert.match(workspace, /disabled=\{isAnalyzeDisabled/);
  assert.match(workspace, /md:grid-cols-2/);
  assert.doesNotMatch(workspace, /slotKey=\"C\"|key: \"C\"|cType|cId/);
  assert.doesNotMatch(workspace, /onDrop|onDragOver|draggable/);
  assert.doesNotMatch(workspace, /openai|useChat|llm/i);
  assert.match(slot, /di\.linkCompare\.chooseEntity/);
  assert.match(slot, /di\.linkCompare\.change/);
  assert.match(slot, /di\.linkCompare\.remove/);
  assert.match(result, /di\.linkCompare\.resultTitle/);
  assert.match(result, /di\.linkCompare\.viewInNetwork/);
  assert.match(result, /di\.linkCompare\.otherSharedData/);
  assert.match(result, /linkCompareCaseHref/);
  assert.match(result, /linkCompareNetworkFocusHref/);
  assert.match(result, /link-compare-loading/);
  assert.match(result, /link-compare-error-/);
  assert.match(result, /onRetry=\{kind === \"retryable\"/);
  assert.match(result, /supportingSharedCases/);
  assert.match(result, /link-compare-path-case/);
  assert.doesNotMatch(result, /เป็นเจ้าของ/);
  assert.doesNotMatch(result, /PERSON_VEHICLE\}/);
  assert.doesNotMatch(result, /text-critical|text-danger/);
  assert.match(result, /relationshipWordingKey/);
  assert.match(workspace, /buildLinkCompareHref/);
  assert.match(workspace, /compareHref=\{compareHref\}/);
  assert.match(network, /link-compare-entry/);
  assert.match(network, /di\.linkCompare\.title/);
  assert.match(network, /isLinkCompareReturnTo/);
  assert.match(network, /link-compare-return/);
  assert.match(network, /di\.network\.resetToFocus/);
  assert.match(network, /handleBackToStart/);
  assert.doesNotMatch(shell, /network\/compare/);
  assert.match(picker, /guided-entity-picker/);
  assert.match(workspace, /allowedTypes=\{\[\.\.\.LINK_COMPARE_PICKER_TYPES\]\}/);
});

test("client calls the existing compare API and does not write intelligence", () => {
  const client = read("lib/drug_intelligence/drug_intelligence_client.ts");
  const hooks = read("lib/drug_intelligence/drug_intelligence_hooks.ts");
  assert.match(client, /\/drug-intelligence\/network\/compare/);
  assert.match(client, /getLinkCompare/);
  assert.doesNotMatch(client, /requestPost<.*>\(\"\/drug-intelligence\/network\/compare\"/);
  assert.match(hooks, /useDrugLinkCompare/);
  assert.match(hooks, /enabled: Boolean\(actorId\) && Boolean\(query\)/);
});

test("Link Compare Network href carries canonical compare returnTo without labels", () => {
  const state = { A: personA, B: vehicleB };
  const compareHref = buildLinkCompareHref(state);
  assert.equal(
    compareHref,
    "/drug-intelligence/network/compare?aType=PERSON&aId=p-kittisak&bType=VEHICLE&bId=v-9009"
  );
  assert.doesNotMatch(compareHref, /กิตติศักดิ์|TEST-9009|aLabel|bLabel|label=/);
  assert.equal(new URLSearchParams(compareHref.split("?")[1] ?? "").get("returnTo"), null);

  const networkHref = linkCompareNetworkFocusHref("PERSON", personA.entityId, compareHref);
  assert.match(networkHref, /^\/drug-intelligence\/network\?/);
  assert.match(networkHref, /focusType=PERSON/);
  assert.match(networkHref, /focusId=p-kittisak/);
  const restored = getSafeReturnTo(new URLSearchParams(networkHref.split("?")[1] ?? ""));
  assert.equal(restored, compareHref);
  const slots = parseLinkCompareReturnTo(restored);
  assert.equal(slots?.A?.entityType, "PERSON");
  assert.equal(slots?.A?.entityId, personA.entityId);
  assert.equal(slots?.B?.entityType, "VEHICLE");
  assert.equal(slots?.B?.entityId, vehicleB.entityId);
  assert.equal(slots?.A?.label, "");
});

test("unsafe returnTo is rejected and never attached to Network", () => {
  assert.equal(getSafeReturnTo(new URLSearchParams({ returnTo: "https://evil.example" })), null);
  assert.equal(getSafeReturnTo(new URLSearchParams({ returnTo: "//evil.example/drug-intelligence/network/compare" })), null);
  assert.equal(parseLinkCompareReturnTo("https://evil.example/drug-intelligence/network/compare"), null);
  assert.equal(isLinkCompareReturnTo("https://evil.example/drug-intelligence/network/compare"), false);
  const unchanged = withReturnTo("/drug-intelligence/network?focusType=PERSON&focusId=p1", "https://evil.example");
  assert.equal(unchanged, "/drug-intelligence/network?focusType=PERSON&focusId=p1");
  assert.equal(linkCompareNetworkFocusHref("PERSON", "p1", "https://evil.example"), "/drug-intelligence/network?focusType=PERSON&focusId=p1");
});

test("Network contextual return uses Link Compare label only for compare returnTo", () => {
  const compare = buildLinkCompareHref({ A: personA, B: vehicleB });
  assert.equal(isLinkCompareReturnTo(compare), true);
  assert.equal(isNetworkReturnTo(compare), false);
  assert.equal(returnToBackLabelKey(compare), "di.linkCompare.backToCompare");
  assert.equal(translate("di.linkCompare.backToCompare", "th"), "← กลับไปเปรียบเทียบความเชื่อมโยง");
  assert.equal(entityDetailBackLabelKey(compare), "di.linkCompare.backToCompare");

  const plainNetwork = "/drug-intelligence/network?focusType=PERSON&focusId=p-kittisak";
  assert.equal(isLinkCompareReturnTo(plainNetwork), false);
  assert.equal(isNetworkReturnTo(plainNetwork), true);
  assert.equal(returnToBackLabelKey(plainNetwork), "di.rel.backToNetwork");
  assert.equal(getSafeReturnTo(new URLSearchParams({ focusType: "PERSON", focusId: "p-kittisak" })), null);
  assert.notEqual(returnToBackLabelKey(plainNetwork), "di.linkCompare.backToCompare");
});

test("Network same-route patches preserve Link Compare returnTo", () => {
  const compare = buildLinkCompareHref({ A: personA, B: vehicleB });
  const current = new URLSearchParams({
    focusType: "PERSON",
    focusId: personA.entityId,
    returnTo: compare,
  });
  const after = applyNetworkSearchParamPatch(current, { focusType: "VEHICLE", focusId: vehicleB.entityId });
  assert.equal(after.get("returnTo"), compare);
  assert.equal(after.get("focusType"), "VEHICLE");
  const restored = parseLinkCompareReturnTo(after.get("returnTo"));
  assert.equal(restored?.A?.entityId, personA.entityId);
  assert.equal(restored?.B?.entityId, vehicleB.entityId);
});

test("DIRECT compact result keeps headline and supporting junction case", () => {
  assert.equal(translate("di.linkCompare.resultTitle", "th"), "ผลการเปรียบเทียบ");
  assert.equal(translate(connectionHeadlineKey("DIRECT"), "th"), "พบความเชื่อมโยงโดยตรง");
  const extra = supportingSharedCases(
    [{ caseId: "c3", caseNumber: "DI-TEST-003", label: "DI-TEST-003" }],
    {
      steps: [
        { node: { type: "PERSON", id: personA.entityId } },
        { node: { type: "VEHICLE", id: vehicleB.entityId } },
      ],
    }
  );
  assert.equal(extra.length, 1);
  assert.equal(extra[0]?.caseNumber, "DI-TEST-003");
  assert.equal(sharedJunctionHeading(1, (key) => translate(key, "th")), "จุดเชื่อมที่พบ");
  const result = read("components/drug_intelligence/drug_link_compare_result.tsx");
  assert.match(result, /connectionHeadlineKey\(\"DIRECT\"\)/);
  assert.match(result, /di\.linkCompare\.openCase/);
  assert.doesNotMatch(result, /ทั้งสองจุด|highlight both|multi-focus/i);
});

test("INDIRECT keeps the intermediate CASE prominent and does not duplicate it below", () => {
  const path = {
    steps: [
      { node: { type: "VEHICLE", id: vehicleB.entityId } },
      { node: { type: "CASE", id: "c3" } },
      { node: { type: "PHONE", id: phoneC.entityId } },
    ],
  };
  const extra = supportingSharedCases([{ caseId: "c3", caseNumber: "DI-TEST-003", label: "DI-TEST-003" }], path);
  assert.deepEqual(extra, []);
  const withMore = supportingSharedCases(
    [
      { caseId: "c3", caseNumber: "DI-TEST-003", label: "DI-TEST-003" },
      { caseId: "c4", caseNumber: "DI-TEST-004", label: "DI-TEST-004" },
      { caseId: "c5", caseNumber: "DI-TEST-005", label: "DI-TEST-005" },
    ],
    path
  );
  assert.deepEqual(
    withMore.map((row) => row.caseNumber),
    ["DI-TEST-004", "DI-TEST-005"]
  );
  assert.equal(sharedJunctionHeading(3, (key) => translate(key, "th")), "จุดเชื่อมที่พบ 3 คดี");
  assert.equal(translate("di.network.relCaseVehicle", "th"), "พบยานพาหนะในคดี");
  assert.equal(translate("di.network.relCasePhone", "th"), "พบเบอร์โทรศัพท์ในคดี");
  const result = read("components/drug_intelligence/drug_link_compare_result.tsx");
  assert.match(result, /isPathCase && isIndirect/);
  assert.match(result, /link-compare-path-case/);
});

test("NONE_KNOWN wording is unchanged and is not styled as an error", () => {
  assert.equal(translate("di.linkCompare.noneKnown", "th"), "ยังไม่พบความเชื่อมโยงจากข้อมูลที่มีในระบบ");
  assert.doesNotMatch(translate("di.linkCompare.noneKnown", "th"), /ไม่เกี่ยวข้องกัน/);
  const result = read("components/drug_intelligence/drug_link_compare_result.tsx");
  assert.match(result, /isNone \? \"text-foreground\" : \"text-accent\"/);
  assert.match(result, /connectionHeadlineKey\(pair\.connectionKind\)/);
  assert.doesNotMatch(result, />\{\s*pair\.connectionKind\s*\}</);
  assert.doesNotMatch(result, /เจ้าของ/);
  const dict = read("lib/i18n/dictionary.ts");
  const compareBlock = dict.slice(dict.indexOf('"di.linkCompare.title"'));
  assert.doesNotMatch(compareBlock, /เจ้าของ/);
});

test("Investigation Trail reset remains a graph control, not the only way back from Compare", () => {
  const network = read("app/drug-intelligence/network/page.tsx");
  const trail = read("lib/drug_intelligence/drug_network_investigation_trail.ts");
  assert.match(network, /function handleBackToStart/);
  assert.match(network, /di\.network\.resetToFocus/);
  assert.match(network, /isLinkCompareReturnTo\(returnTo\) \? \"link-compare-return\"/);
  assert.doesNotMatch(trail, /network\/compare/);
  const resetBody = network.slice(network.indexOf("function handleBackToStart"), network.indexOf("function exitPathView"));
  assert.doesNotMatch(resetBody, /network\/compare|LINK_COMPARE_PATH/);
});
