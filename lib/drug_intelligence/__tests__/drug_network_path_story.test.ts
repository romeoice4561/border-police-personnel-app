/**
 * DI-8.6 — Network Inspector "Investigation Story" narrative generation
 * (final refinement: PREVIOUS→CURRENT natural Thai sentences).
 * Presentation only — built purely from DI-8.4's NetworkPathExplanation /
 * NetworkExplainedPath output (same fixture pattern as
 * drug_network_path_explanation.test.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import { explainFocusToSelectedPaths } from "@/lib/drug_intelligence/drug_network_path_explanation";
import {
  buildNetworkPathStory,
  pathDescriptorFromIntermediates,
} from "@/lib/drug_intelligence/drug_network_path_story";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dictionarySource = readFileSync(path.join(dir, "..", "..", "i18n", "dictionary.ts"), "utf8");

function node(
  id: string,
  type: DrugGraphNeighborhoodResponse["nodes"][number]["type"],
  label: string,
): DrugGraphNeighborhoodResponse["nodes"][number] {
  return {
    id,
    type,
    label,
    secondaryLabel: null,
    maskedLabel: null,
    metadata: { type } as DrugGraphNeighborhoodResponse["nodes"][number]["metadata"],
    firstSeenAt: null,
    lastSeenAt: null,
    caseCount: 1,
    riskIndicators: [],
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  relationshipType: DrugGraphNeighborhoodResponse["edges"][number]["relationshipType"],
  sourceCaseIds: string[] = [],
): DrugGraphNeighborhoodResponse["edges"][number] {
  return {
    id,
    source,
    target,
    relationshipType,
    edgeKind: relationshipType.startsWith("SHARED_") ? "INFERRED" : "DIRECT",
    evidenceCount: 1,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCaseIds,
    explanation: { kind: "DIRECT_LINK" },
  };
}

const th = (key: string) => {
  const match = dictionarySource.match(new RegExp(`"${key.replace(/\./g, "\\.")}":\\s*tr\\(\\s*"([^"]+)"`));
  return match?.[1] ?? key;
};

/** A: Person → Case → Device. */
function personCaseDeviceNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      node("c1", "CASE", "DI-TEST-001"),
      node("d1", "DEVICE", "Samsung Galaxy A54"),
    ],
    edges: [
      edge("pc1", "p1", "c1", "PERSON_CASE", ["c1"]),
      edge("cd1", "c1", "d1", "CASE_DEVICE", ["c1"]),
    ],
    truncated: false,
  };
}

/** B: Person A → Case → Person B → Device. */
function personCasePersonDeviceNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "pA" },
    nodes: [
      node("pA", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      node("cX", "CASE", "DI-TEST-001"),
      node("pB", "PERSON", "นายธนกร ทดสอบระบบ"),
      node("dY", "DEVICE", "Samsung Galaxy A54"),
    ],
    edges: [
      edge("e1", "pA", "cX", "PERSON_CASE", ["cX"]),
      edge("e2", "cX", "pB", "PERSON_CASE", ["cX"]),
      edge("e3", "pB", "dY", "PERSON_DEVICE", ["cX"]),
    ],
    truncated: false,
  };
}

/** C: Person → Case → Phone → Case → Device (the critical acceptance long-path shape, Section 7). */
function personCasePhoneCaseDeviceNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"),
      node("c2", "CASE", "DI-TEST-002"),
      node("ph1", "PHONE", "090-000-1001"),
      node("c1", "CASE", "DI-TEST-001"),
      node("d1", "DEVICE", "Samsung Galaxy A54"),
    ],
    edges: [
      edge("e1", "p1", "c2", "PERSON_CASE", ["c2"]),
      edge("e2", "c2", "ph1", "CASE_PHONE", ["c2"]),
      edge("e3", "ph1", "c1", "CASE_PHONE", ["c1"]),
      edge("e4", "c1", "d1", "CASE_DEVICE", ["c1"]),
    ],
    truncated: false,
  };
}

/** Person → Phone (direct, 1 hop). */
function personPhoneNeighborhood(): DrugGraphNeighborhoodResponse {
  return {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [node("p1", "PERSON", "นาย ก"), node("ph1", "PHONE", "081-111-1111")],
    edges: [edge("pp1", "p1", "ph1", "PERSON_PHONE", ["c9"])],
    truncated: false,
  };
}

test("A: Person -> Case -> Device produces a natural sentence per transition, referencing both previous and current entity", () => {
  const explanation = explainFocusToSelectedPaths(personCaseDeviceNeighborhood(), "d1");
  assert.ok(explanation);
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);

  assert.equal(story.steps.length, 3);
  assert.equal(story.steps[0]!.kind, "origin");
  assert.equal(story.steps[0]!.entityLabel, "นายกิตติศักดิ์ ทดสอบระบบ");
  assert.equal(story.steps[0]!.sentence, null);

  assert.equal(story.steps[1]!.kind, "transition");
  assert.equal(story.steps[1]!.entityLabel, "DI-TEST-001");
  assert.equal(story.steps[1]!.sentence, "นายกิตติศักดิ์ ทดสอบระบบ ปรากฏเป็นผู้เกี่ยวข้องในคดี DI-TEST-001");

  assert.equal(story.steps[2]!.kind, "transition");
  assert.equal(story.steps[2]!.entityLabel, "Samsung Galaxy A54");
  assert.equal(story.steps[2]!.sentence, "ในคดี DI-TEST-001 พบอุปกรณ์ Samsung Galaxy A54");

  assert.equal(story.conclusion.isDirect, false);
  assert.equal(story.conclusion.hopCount, 2);
  assert.match(story.conclusion.leadText, /ไม่ได้เชื่อมโยงกับ.*โดยตรง/);
  assert.match(story.conclusion.hopsText ?? "", /2 ขั้น/);
  assert.deepEqual(story.conclusion.pathLabels, ["นายกิตติศักดิ์ ทดสอบระบบ", "DI-TEST-001", "Samsung Galaxy A54"]);
  assert.match(story.primaryQuestionText, /Samsung Galaxy A54/);
});

test("B: Person A -> Case -> Person B -> Device tells the FULL story via sentences — no step skipped", () => {
  const explanation = explainFocusToSelectedPaths(personCasePersonDeviceNeighborhood(), "dY");
  assert.ok(explanation);
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);

  assert.equal(story.steps.length, 4);
  assert.equal(story.steps[0]!.entityLabel, "นายกิตติศักดิ์ ทดสอบระบบ");
  assert.equal(story.steps[1]!.entityLabel, "DI-TEST-001");
  assert.equal(story.steps[1]!.sentence, "นายกิตติศักดิ์ ทดสอบระบบ ปรากฏเป็นผู้เกี่ยวข้องในคดี DI-TEST-001");
  assert.equal(story.steps[2]!.entityLabel, "นายธนกร ทดสอบระบบ");
  assert.equal(story.steps[2]!.sentence, "ในคดี DI-TEST-001 พบนายธนกร ทดสอบระบบ เป็นบุคคลที่เกี่ยวข้อง");
  assert.equal(story.steps[3]!.entityLabel, "Samsung Galaxy A54");
  assert.equal(story.steps[3]!.sentence, "นายธนกร ทดสอบระบบ มีข้อมูลการใช้อุปกรณ์ Samsung Galaxy A54");

  assert.equal(story.conclusion.hopCount, 3);
  assert.equal(story.conclusion.isDirect, false);
  assert.match(story.conclusion.hopsText ?? "", /3 ขั้น/);
  assert.doesNotMatch(story.conclusion.leadText, /เชื่อมโยงโดยตรงกับ/, "must never claim DIRECT for a 3-hop path");
});

test("C: Person -> Case -> Phone -> Case -> Device (critical long-path acceptance case) tells all 4 transitions", () => {
  const explanation = explainFocusToSelectedPaths(personCasePhoneCaseDeviceNeighborhood(), "d1");
  assert.ok(explanation);
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);

  assert.equal(story.steps.length, 5);
  assert.equal(story.steps[0]!.entityLabel, "นายกิตติศักดิ์ ทดสอบระบบ");
  assert.equal(story.steps[1]!.entityLabel, "DI-TEST-002");
  assert.equal(story.steps[1]!.sentence, "นายกิตติศักดิ์ ทดสอบระบบ ปรากฏเป็นผู้เกี่ยวข้องในคดี DI-TEST-002");
  assert.equal(story.steps[2]!.entityLabel, "090-000-1001");
  assert.equal(story.steps[2]!.sentence, "ในคดี DI-TEST-002 พบเบอร์โทรศัพท์ 090-000-1001");
  assert.equal(story.steps[3]!.entityLabel, "DI-TEST-001");
  assert.equal(story.steps[3]!.sentence, "เบอร์โทรศัพท์ 090-000-1001 ปรากฏเกี่ยวข้องกับคดี DI-TEST-001");
  assert.equal(story.steps[4]!.entityLabel, "Samsung Galaxy A54");
  assert.equal(story.steps[4]!.sentence, "ในคดี DI-TEST-001 พบอุปกรณ์ Samsung Galaxy A54");

  assert.equal(story.conclusion.hopCount, 4);
  assert.equal(story.conclusion.isDirect, false);
  assert.match(story.conclusion.hopsText ?? "", /4 ขั้น/);
  assert.deepEqual(story.conclusion.pathLabels, [
    "นายกิตติศักดิ์ ทดสอบระบบ",
    "DI-TEST-002",
    "090-000-1001",
    "DI-TEST-001",
    "Samsung Galaxy A54",
  ]);
});

// D. every rendered transition references both previous and current entities
test("D: every transition sentence textually contains both the previous and current entity labels", () => {
  const explanation = explainFocusToSelectedPaths(personCasePhoneCaseDeviceNeighborhood(), "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  for (let i = 1; i < story.steps.length; i += 1) {
    const step = story.steps[i]!;
    const prevLabel = story.steps[i - 1]!.entityLabel;
    assert.ok(step.sentence, `step ${i} must have a sentence`);
    assert.ok(step.sentence!.includes(prevLabel), `step ${i} sentence must mention the previous entity (${prevLabel})`);
    assert.ok(step.sentence!.includes(step.entityLabel), `step ${i} sentence must mention the current entity (${step.entityLabel})`);
  }
});

// E. no step is silently skipped
test("E: step count always equals path.steps length — no node dropped", () => {
  const explanation = explainFocusToSelectedPaths(personCasePhoneCaseDeviceNeighborhood(), "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  assert.equal(story.steps.length, explanation!.paths[0]!.steps.length);
});

// F. hopCount unchanged (still read straight from the path, never re-derived)
test("F: conclusion.hopCount equals the path's own hopCount value exactly", () => {
  const explanation = explainFocusToSelectedPaths(personCaseDeviceNeighborhood(), "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  assert.equal(story.conclusion.hopCount, explanation!.paths[0]!.hopCount);
});

// G. DIRECT conclusion only for actual hopCount === 1
test("G: DIRECT wording only used when hopCount === 1; a 2-hop path never uses the DIRECT template", () => {
  const direct = explainFocusToSelectedPaths(personPhoneNeighborhood(), "ph1");
  const directStory = buildNetworkPathStory(direct!, direct!.paths[0]!, th);
  assert.equal(directStory.conclusion.isDirect, true);
  assert.equal(directStory.conclusion.leadText, th("di.network.storyConclusionDirect").replace("{selected}", "081-111-1111").replace("{focus}", "นาย ก"));
  assert.equal(directStory.conclusion.hopsText, null);

  const indirect = explainFocusToSelectedPaths(personCaseDeviceNeighborhood(), "d1");
  const indirectStory = buildNetworkPathStory(indirect!, indirect!.paths[0]!, th);
  assert.equal(indirectStory.conclusion.isDirect, false);
  assert.notEqual(indirectStory.conclusion.leadText, th("di.network.storyConclusionDirect"));
});

// H. indirect paths explicitly negate direct relationship
test("H: indirect conclusion lead text always contains the explicit negation", () => {
  const explanation = explainFocusToSelectedPaths(personCaseDeviceNeighborhood(), "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  assert.match(story.conclusion.leadText, /ไม่ได้เชื่อมโยงกับ.*โดยตรง/);
});

// I. unknown/unmapped transition uses neutral fallback
test("I: a transition with no recorded relationship type (defensive edge case) uses the neutral fallback sentence, never a guess", () => {
  const explanation = explainFocusToSelectedPaths(personCaseDeviceNeighborhood(), "d1");
  assert.ok(explanation);
  const path = explanation!.paths[0]!;
  const patchedPath = {
    ...path,
    steps: path.steps.map((s, i) => (i === 1 ? { ...s, viaRelationshipType: null } : s)),
  };
  const story = buildNetworkPathStory(explanation!, patchedPath, th);
  assert.equal(story.steps[1]!.sentence, "นายกิตติศักดิ์ ทดสอบระบบ มีความเชื่อมโยงที่บันทึกในระบบกับ DI-TEST-001");
});

// J. no geographic proximity relationship inference — this module never reads coordinates at all.
test("J: the narrative module never reads latitude/longitude/coordinate fields — proximity can never become relationship evidence here", () => {
  const source = readFileSync(path.join(dir, "..", "drug_network_path_story.ts"), "utf8");
  assert.doesNotMatch(source, /\.(latitude|longitude|coordinates?)\b/);
  assert.doesNotMatch(source, /haversine|geoDistance|hotspot/i);
});

// K. evidence action remains tied to existing evidence
test("K: transition steps carry their edge's REAL supportingCaseIds for the per-step evidence disclosure — never synthetic", () => {
  const explanation = explainFocusToSelectedPaths(personCaseDeviceNeighborhood(), "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  assert.deepEqual(story.steps[1]!.evidenceCaseIds, ["c1"]);
  assert.deepEqual(story.steps[2]!.evidenceCaseIds, ["c1"]);
  assert.deepEqual(story.steps[0]!.evidenceCaseIds, [], "origin step has no incoming edge, so no evidence");
});

// L. no duplicate standalone relation quote when sentence already expresses it — the step type no longer has a
// separate relationLabelKey field at all; the sentence IS the single source of that information.
test("L: NetworkPathStoryStep no longer exposes a separate quoted relation label — only one sentence per step", () => {
  const explanation = explainFocusToSelectedPaths(personCaseDeviceNeighborhood(), "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  const step = story.steps[1]! as unknown as Record<string, unknown>;
  assert.equal(step["relationLabelKey"], undefined, "the old detached relation-label field must not exist on the new step shape");
});

// M. DI-8.4 path switching still changes story correctly
test("M: switching to a different (alternative) path produces a different story", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [
      node("p1", "PERSON", "นาย ก"),
      node("c1", "CASE", "คดี A"),
      node("ph1", "PHONE", "เบอร์ X"),
      node("p2", "PERSON", "นาย ข"),
    ],
    edges: [
      edge("pc1", "p1", "c1", "PERSON_CASE", ["c1"]),
      edge("cp2", "c1", "p2", "PERSON_CASE", ["c1"]),
      edge("pp1", "p1", "ph1", "PERSON_PHONE", ["c1"]),
      edge("php2", "ph1", "p2", "PERSON_PHONE", ["c1"]),
    ],
    truncated: false,
  };
  const explanation = explainFocusToSelectedPaths(neighborhood, "p2", { maxPaths: 2 });
  assert.ok(explanation);
  assert.ok(explanation!.paths.length >= 2, "fixture must produce at least 2 alternative paths");
  const story1 = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  const story2 = buildNetworkPathStory(explanation!, explanation!.paths[1]!, th);
  assert.notDeepEqual(story1.conclusion.pathLabels, story2.conclusion.pathLabels, "different paths must produce different stories");
});

// N/O — DI-8.4 camera/viewport and DI-8.3 relationship semantics are untouched by this presentation-only
// module (it imports nothing from drug_network_drawer_viewport.ts or the relationship search stack); asserted
// structurally via import-surface, not by re-running those suites here (they are covered by their own tests).
test("N/O: the narrative module imports only from drug_network_path_explanation / drug_intelligence_client / graph client labels — no viewport, camera, or relationship-search modules", () => {
  const source = readFileSync(path.join(dir, "..", "drug_network_path_story.ts"), "utf8");
  assert.doesNotMatch(source, /drug_network_drawer_viewport/);
  assert.doesNotMatch(source, /drug_relationship_search/);
  assert.doesNotMatch(source, /drug_network_graph_flow_adapter/);
});

test("narrative never converts a multi-hop PATH into a DIRECT conclusion (regression)", () => {
  const explanation = explainFocusToSelectedPaths(personCasePersonDeviceNeighborhood(), "dY");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  assert.equal(story.conclusion.isDirect, false);
  assert.notEqual(story.conclusion.leadText, th("di.network.storyConclusionDirect"));
});

test("path descriptor is derived only from actual intermediate entity types — direct path has no descriptor", () => {
  const explanation = explainFocusToSelectedPaths(personPhoneNeighborhood(), "ph1");
  const descriptor = pathDescriptorFromIntermediates(explanation!.paths[0]!, th);
  assert.equal(descriptor, null, "a 1-hop direct path has no intermediates to describe");
});

test("path descriptor names the real intermediate entity type(s), e.g. 'ผ่านคดี'", () => {
  const explanation = explainFocusToSelectedPaths(personCaseDeviceNeighborhood(), "d1");
  const descriptor = pathDescriptorFromIntermediates(explanation!.paths[0]!, th);
  assert.equal(descriptor, "ผ่านคดี");
});

test("path descriptor joins multiple distinct intermediate entity types, e.g. 'ผ่านคดีและบุคคล'", () => {
  const explanation = explainFocusToSelectedPaths(personCasePersonDeviceNeighborhood(), "dY");
  const descriptor = pathDescriptorFromIntermediates(explanation!.paths[0]!, th);
  assert.equal(descriptor, "ผ่านคดีและบุคคล");
});
