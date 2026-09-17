/**
 * Network relationship-type filter — checkbox UX + URL multi-select state.
 *
 * Run with:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_network_relationship_filter.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";

import { applyNetworkSearchParamPatch } from "@/lib/drug_intelligence/drug_network_route_navigation";
import { applyInvestigationBoardGraphContextPatch, buildInvestigationBoardGraphContext } from "@/lib/drug_intelligence/drug_investigation_board_workspace";
import {
  applyRelationshipFilterControlEvent,
  hasActiveNetworkFilterParams,
  hasActiveNetworkGraphFilters,
  parseRelationshipTypesParam,
  removeRelationshipTypeSelection,
  resolveNetworkFilterDisplayState,
  resolveNetworkWorkspaceResultKind,
  serializeRelationshipTypesParam,
  toggleRelationshipTypeSelection,
} from "@/lib/drug_intelligence/drug_network_relationship_filter_state";
import { formatThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function formatDate(value: string | undefined): string {
  return value ? formatThaiPersonnelDate(value) : "";
}

function clickRelationship(selected: ReturnType<typeof parseRelationshipTypesParam>, type: "PERSON_CASE" | "PERSON_PHONE" | "PERSON_SIM" | "SHARED_CASE") {
  return applyRelationshipFilterControlEvent(selected, { action: "toggle", type });
}

test("checkbox click calls selection update", () => {
  const updates: string[] = [];
  const onChange = (next: ReturnType<typeof parseRelationshipTypesParam>) => {
    updates.push(serializeRelationshipTypesParam(next) ?? "");
  };
  onChange(clickRelationship(undefined, "PERSON_CASE"));
  assert.deepEqual(updates, ["PERSON_CASE"]);
});

test("label/row click changes checked state through the same control event", () => {
  let selected = clickRelationship(undefined, "PERSON_CASE");
  assert.deepEqual(selected, ["PERSON_CASE"]);
  assert.equal(selected?.includes("PERSON_CASE"), true);
  selected = applyRelationshipFilterControlEvent(selected, { action: "toggle", type: "PERSON_CASE" });
  assert.equal(selected, undefined);
});

test("two checkbox clicks preserve multi-select", () => {
  const first = clickRelationship(undefined, "PERSON_CASE");
  const second = clickRelationship(first, "PERSON_PHONE");
  assert.deepEqual(second, ["PERSON_CASE", "PERSON_PHONE"]);
  assert.equal(second?.length, 2);
});

test("deselect works and chips reflect the remaining selection", () => {
  const selected = clickRelationship(clickRelationship(undefined, "PERSON_CASE"), "PERSON_PHONE");
  assert.equal(selected?.length, 2);
  const afterChip = applyRelationshipFilterControlEvent(selected, { action: "remove", type: "PERSON_CASE" });
  assert.deepEqual(afterChip, ["PERSON_PHONE"]);
  const cleared = applyRelationshipFilterControlEvent(afterChip, { action: "clear" });
  assert.equal(cleared, undefined);
});

test("clicking a relationship type adds it; clicking again removes it", () => {
  const afterCheck = toggleRelationshipTypeSelection(undefined, "PERSON_CASE");
  assert.deepEqual(afterCheck, ["PERSON_CASE"]);
  const afterUncheck = toggleRelationshipTypeSelection(afterCheck, "PERSON_CASE");
  assert.equal(afterUncheck, undefined);
});

test("second checkbox does not clear the first", () => {
  const one = toggleRelationshipTypeSelection(undefined, "PERSON_CASE");
  const two = toggleRelationshipTypeSelection(one, "PERSON_PHONE");
  const three = toggleRelationshipTypeSelection(two, "PERSON_SIM");
  assert.deepEqual(three, ["PERSON_CASE", "PERSON_PHONE", "PERSON_SIM"]);
});

test("selected count and chip removal affect only that condition", () => {
  const selected = toggleRelationshipTypeSelection(["PERSON_CASE", "PERSON_PHONE"], "PERSON_SIM");
  assert.equal(selected?.length, 3);
  const afterChip = removeRelationshipTypeSelection(selected, "PERSON_PHONE");
  assert.deepEqual(afterChip, ["PERSON_CASE", "PERSON_SIM"]);
  assert.equal(removeRelationshipTypeSelection(afterChip, "PERSON_CASE")?.includes("PERSON_SIM"), true);
});

test("clear relationship selections yields undefined without inventing types", () => {
  assert.equal(serializeRelationshipTypesParam(undefined), undefined);
  assert.equal(serializeRelationshipTypesParam([]), undefined);
});

test("URL serialization is multi-select, de-duplicated, and catalog-stable", () => {
  const parsed = parseRelationshipTypesParam("PERSON_SIM,PERSON_CASE,PERSON_CASE,UNKNOWN");
  assert.deepEqual(parsed, ["PERSON_CASE", "PERSON_SIM"]);
  assert.equal(serializeRelationshipTypesParam(parsed), "PERSON_CASE,PERSON_SIM");
  assert.equal(parseRelationshipTypesParam("PERSON_CASE,PERSON_CASE")?.length, 1);
  assert.equal(parseRelationshipTypesParam(""), undefined);
  assert.equal(parseRelationshipTypesParam("   "), undefined);
});

test("refresh reconstruction and Back/Forward use the same searchParams parser", () => {
  const current = new URLSearchParams("focusType=PERSON&focusId=abc&nodeTypes=CASE&relationshipTypes=PERSON_CASE");
  const afterSecond = applyNetworkSearchParamPatch(current, {
    relationshipTypes: serializeRelationshipTypesParam(toggleRelationshipTypeSelection(parseRelationshipTypesParam(current.get("relationshipTypes")), "PERSON_PHONE")),
  });
  assert.equal(afterSecond.get("relationshipTypes"), "PERSON_CASE,PERSON_PHONE");
  assert.equal(afterSecond.get("focusType"), "PERSON");
  assert.equal(afterSecond.get("focusId"), "abc");
  assert.equal(afterSecond.get("nodeTypes"), "CASE");

  const afterChip = applyNetworkSearchParamPatch(afterSecond, {
    relationshipTypes: serializeRelationshipTypesParam(removeRelationshipTypeSelection(parseRelationshipTypesParam(afterSecond.get("relationshipTypes")), "PERSON_CASE")),
  });
  assert.equal(afterChip.get("relationshipTypes"), "PERSON_PHONE");
  assert.equal(afterChip.get("nodeTypes"), "CASE");

  const afterClear = applyNetworkSearchParamPatch(afterChip, { relationshipTypes: undefined });
  assert.equal(afterClear.get("relationshipTypes"), null);
  assert.equal(afterClear.get("nodeTypes"), "CASE");
  assert.deepEqual(parseRelationshipTypesParam(afterSecond.get("relationshipTypes")), ["PERSON_CASE", "PERSON_PHONE"]);
});

test("unrelated filters are preserved when relationship types change", () => {
  const current = new URLSearchParams("focusType=CASE&focusId=case-1&dateFrom=2026-01-01&maxNodes=40&relationshipTypes=SHARED_CASE");
  const next = applyNetworkSearchParamPatch(current, {
    relationshipTypes: serializeRelationshipTypesParam(["SHARED_CASE", "PERSON_CASE"]),
  });
  assert.equal(next.get("dateFrom"), "2026-01-01");
  assert.equal(next.get("maxNodes"), "40");
  assert.equal(next.get("focusType"), "CASE");
  assert.equal(next.get("relationshipTypes"), "PERSON_CASE,SHARED_CASE");
});

test("date selection updates filter state and dateFrom/dateTo stay independent", () => {
  const current = new URLSearchParams("focusType=PERSON&focusId=abc&relationshipTypes=PERSON_CASE");
  const afterFrom = applyNetworkSearchParamPatch(current, { dateFrom: "01/09/2569" });
  assert.equal(afterFrom.get("dateFrom"), "01/09/2569");
  assert.equal(afterFrom.get("dateTo"), null);
  assert.equal(afterFrom.get("relationshipTypes"), "PERSON_CASE");

  const afterTo = applyNetworkSearchParamPatch(afterFrom, { dateTo: "17/09/2569" });
  assert.equal(afterTo.get("dateFrom"), "01/09/2569");
  assert.equal(afterTo.get("dateTo"), "17/09/2569");
  assert.equal(afterTo.get("focusId"), "abc");
});

test("URL hydration restores dates and relationship selections without a focus context", () => {
  const painted = resolveNetworkFilterDisplayState({
    hasGraphContext: false,
    urlRelationshipTypes: "PERSON_CASE,PERSON_PHONE,PERSON_CASE",
    urlDateFrom: "01/09/2569",
    urlDateTo: "17/09/2569",
    formatDate,
  });
  assert.deepEqual(painted.selectedRelationshipTypes, ["PERSON_CASE", "PERSON_PHONE"]);
  assert.equal(painted.dateFrom, "01/09/2569");
  assert.equal(painted.dateTo, "17/09/2569");
});

test("duplicate relationshipTypes still normalized after a click-style update", () => {
  const next = applyNetworkSearchParamPatch(
    new URLSearchParams("focusType=PERSON&focusId=abc&relationshipTypes=PERSON_CASE,PERSON_CASE"),
    {
      relationshipTypes: serializeRelationshipTypesParam(
        clickRelationship(parseRelationshipTypesParam("PERSON_CASE,PERSON_CASE"), "PERSON_PHONE")
      ),
    }
  );
  assert.equal(next.get("relationshipTypes"), "PERSON_CASE,PERSON_PHONE");
});

test("board graph-context patch uses the same parser (no duplicate / unknown values)", () => {
  const current = buildInvestigationBoardGraphContext({
    focusType: "PERSON",
    focusId: "p1",
    depth: 1,
    relationshipTypes: ["PERSON_CASE"],
  });
  const next = applyInvestigationBoardGraphContextPatch(current, {
    relationshipTypes: "PERSON_PHONE,PERSON_CASE,PERSON_CASE,NOT_A_TYPE",
  });
  assert.deepEqual(next.relationshipTypes, ["PERSON_CASE", "PERSON_PHONE"]);
  const cleared = applyInvestigationBoardGraphContextPatch(next, { relationshipTypes: undefined });
  assert.equal(cleared.relationshipTypes, undefined);
});

test("board date patch keeps dateFrom and dateTo independent", () => {
  const current = buildInvestigationBoardGraphContext({
    focusType: "PERSON",
    focusId: "p1",
    depth: 1,
  });
  const afterFrom = applyInvestigationBoardGraphContextPatch(current, { dateFrom: "01/09/2569" });
  const afterTo = applyInvestigationBoardGraphContextPatch(afterFrom, { dateTo: "17/09/2569" });
  assert.equal(afterTo.dateFrom, "2026-09-01");
  assert.equal(afterTo.dateTo, "2026-09-17");
  const clearedFrom = applyInvestigationBoardGraphContextPatch(afterTo, { dateFrom: undefined });
  assert.equal(clearedFrom.dateFrom, undefined);
  assert.equal(clearedFrom.dateTo, "2026-09-17");
});

test("active filter params reopen the panel after a same-route remount", () => {
  assert.equal(hasActiveNetworkFilterParams({}), false);
  assert.equal(hasActiveNetworkFilterParams({ relationshipTypes: "PERSON_CASE" }), true);
  assert.equal(hasActiveNetworkFilterParams({ dateFrom: "01/09/2569" }), true);
  assert.equal(hasActiveNetworkFilterParams({ dateTo: "17/09/2569" }), true);
});

test("filter UI uses a single enabled button checkbox with a non-stealing check glyph", () => {
  const filter = read("components/drug_intelligence/drug_network_relationship_filter.tsx");
  assert.match(filter, /role="checkbox"/);
  assert.match(filter, /aria-checked=\{checked\}/);
  assert.match(filter, /min-h-11/);
  assert.match(filter, /pointer-events-none/);
  assert.match(filter, /<Check/);
  assert.match(filter, /applyRelationshipFilterControlEvent/);
  assert.match(filter, /di\.network\.relationshipNoneSelected/);
  assert.match(filter, /di\.network\.relationshipSelectedCount/);
  assert.match(filter, /di\.network\.clearRelationshipFilters/);
  assert.match(filter, /relationship-chip-/);
  assert.match(filter, /grid-cols-1 gap-1.5 sm:grid-cols-2/);
  assert.doesNotMatch(filter, /className=\{?["'`].*appearance-none/);
  assert.doesNotMatch(filter, /type="checkbox"/);
  assert.doesNotMatch(filter, /type="radio"/);
  assert.doesNotMatch(filter, /#f97316|#ff6b00|orange-/);
});

test("Network page hydrates filter controls from URL when graph context is null", () => {
  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /parseRelationshipTypesParam\(urlRelationshipTypesParam\)/);
  assert.match(page, /serializeRelationshipTypesParam\(next\)/);
  assert.match(page, /resolveNetworkFilterDisplayState/);
  assert.match(page, /hasActiveNetworkFilterParams/);
  assert.match(page, /relationshipTypes: selectedRelationshipTypes/);
  assert.match(page, /id="drug-network-filter-date-from"/);
  assert.match(page, /id="drug-network-filter-date-to"/);
  assert.match(page, /data-testid="network-filter-date-from"/);
  assert.match(page, /data-testid="network-filter-date-to"/);
  assert.match(page, /commitOnBrowse=\{false\}/);
  assert.doesNotMatch(page, /urlRelationshipTypesParam \? \(urlRelationshipTypesParam\.split/);

  const picker = read("components/ui/thai_date_picker.tsx");
  assert.match(picker, /disabled=\{disabled\}/);
  assert.match(picker, /onClick=\{\(\) => setOpen\(\(current\) => !current\)\}/);
  assert.doesNotMatch(picker, /disabled=\{true\}/);

  const service = read("lib/drug_intelligence/drug_network_graph_service.ts");
  assert.match(service, /if \(request\.relationshipTypes && !request\.relationshipTypes\.includes\(raw\.edge\.relationshipType\)\) continue;/);

  const dict = read("lib/i18n/dictionary.ts");
  assert.match(dict, /"di\.network\.relPersonCase": tr\("พบในคดี"/);
  assert.match(dict, /"di\.network\.relPersonPhone": tr\("พบเกี่ยวข้องกับเบอร์โทรศัพท์"/);
  assert.match(dict, /"di\.network\.relationshipNoneSelected": tr\("ยังไม่ได้เลือกประเภทความเชื่อมโยง"/);
});

test("no focus disables the neighborhood query", () => {
  const hooks = read("lib/drug_intelligence/drug_intelligence_hooks.ts");
  assert.match(hooks, /enabled: Boolean\(actorId\) && query\.entityId\.length > 0/);
  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /entityId: focusId \?\? ""/);
});

test("no-focus instructional empty state is distinct from filtered-zero and unfiltered-empty", () => {
  assert.equal(
    resolveNetworkWorkspaceResultKind({ hasFocus: false, hasActiveFilters: true, nodeCount: 0, edgeCount: 0 }),
    "NO_FOCUS"
  );
  assert.equal(
    resolveNetworkWorkspaceResultKind({ hasFocus: true, hasActiveFilters: true, nodeCount: 1, edgeCount: 0 }),
    "FILTERED_EMPTY"
  );
  assert.equal(
    resolveNetworkWorkspaceResultKind({ hasFocus: true, hasActiveFilters: false, nodeCount: 1, edgeCount: 0 }),
    "EMPTY"
  );
  assert.equal(
    resolveNetworkWorkspaceResultKind({ hasFocus: true, hasActiveFilters: true, nodeCount: 3, edgeCount: 2 }),
    "HAS_GRAPH"
  );

  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /data-testid="network-no-focus-state"/);
  assert.match(page, /data-testid="network-filtered-empty-state"/);
  assert.match(page, /data-testid="network-empty-state"/);
  assert.match(page, /di\.network\.chooseOriginTitle/);
  assert.match(page, /di\.network\.chooseOriginBody/);
  assert.match(page, /di\.network\.filteredEmpty/);
  assert.match(page, /di\.network\.filteredEmptyHint/);
  assert.doesNotMatch(page, /EmptyState title=\{t\("di\.network\.noFocus"\)\}/);

  const dict = read("lib/i18n/dictionary.ts");
  assert.match(dict, /"di\.network\.chooseOriginTitle": tr\("เลือกจุดเริ่มต้นของผัง"/);
  assert.match(dict, /"di\.network\.filteredEmpty": tr\("ไม่พบความเชื่อมโยงตามตัวกรองที่เลือก"/);
  assert.notEqual(
    dict.match(/"di\.network\.chooseOriginTitle": tr\("([^"]+)"/)?.[1],
    dict.match(/"di\.network\.filteredEmpty": tr\("([^"]+)"/)?.[1]
  );
  assert.notEqual(
    dict.match(/"di\.network\.empty": tr\("([^"]+)"/)?.[1],
    dict.match(/"di\.network\.filteredEmpty": tr\("([^"]+)"/)?.[1]
  );
});

test("selecting a focus preserves date, relationship, depth, entity-type, and maxNodes filters", () => {
  const current = new URLSearchParams(
    "dateFrom=01/05/2569&dateTo=17/09/2569&relationshipTypes=PERSON_CASE,PERSON_PHONE&depth=2&nodeTypes=CASE,PHONE&maxNodes=40"
  );
  const afterFocus = applyNetworkSearchParamPatch(current, {
    focusType: "PERSON",
    focusId: "person-qa-1",
  });
  assert.equal(afterFocus.get("focusType"), "PERSON");
  assert.equal(afterFocus.get("focusId"), "person-qa-1");
  assert.equal(afterFocus.get("dateFrom"), "01/05/2569");
  assert.equal(afterFocus.get("dateTo"), "17/09/2569");
  assert.equal(afterFocus.get("relationshipTypes"), "PERSON_CASE,PERSON_PHONE");
  assert.equal(afterFocus.get("depth"), "2");
  assert.equal(afterFocus.get("nodeTypes"), "CASE,PHONE");
  assert.equal(afterFocus.get("maxNodes"), "40");
  assert.deepEqual(parseRelationshipTypesParam(afterFocus.get("relationshipTypes")), ["PERSON_CASE", "PERSON_PHONE"]);

  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /focusType: selection\.entityType/);
  assert.match(page, /focusId: selection\.entityId/);
  assert.doesNotMatch(page, /focusId: selection\.entityId,\s*depth: undefined/);
});

test("focus plus filters reach graph context and the neighborhood query", () => {
  assert.equal(hasActiveNetworkGraphFilters({ relationshipTypes: ["PERSON_CASE"], dateFrom: "01/05/2569" }), true);
  assert.equal(hasActiveNetworkGraphFilters({}), false);

  const page = read("app/drug-intelligence/network/page.tsx");
  assert.match(page, /relationshipTypes: selectedRelationshipTypes/);
  assert.match(page, /dateFrom: effectiveGraphContext\?\.dateFrom/);
  assert.match(page, /dateTo: effectiveGraphContext\?\.dateTo/);
  assert.match(page, /toGregorianDateInputValue\(thaiDate\)/);
  assert.match(page, /data-testid="network-focus-picker"/);
  assert.match(page, /di\.network\.searchOriginLabel/);
  assert.match(page, /di\.network\.filtersApplyAfterFocus/);
  assert.match(page, /<ReactFlow/);
});
