/**
 * DI-8.6 hotfix — per-step "ดูหลักฐานของขั้นนี้" actually selecting and
 * showing THAT transition's own evidence (previously a no-op after the
 * first click: the handler discarded the clicked step and only ever called
 * setEvidenceOpen(true), which never re-renders on a second click since
 * `true -> true` is not a state change).
 *
 * Static source-content checks (no component-render harness exists in this
 * repo — see the pure-logic test convention elsewhere in this directory),
 * asserting the actual shipped wiring rather than re-deriving it.
 *
 * Run:
 *   npx tsx --test lib/drug_intelligence/__tests__/drug_network_path_story_evidence_hotfix.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "path";
import type { DrugGraphNeighborhoodResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import { explainFocusToSelectedPaths } from "@/lib/drug_intelligence/drug_network_path_explanation";
import { buildNetworkPathStory } from "@/lib/drug_intelligence/drug_network_path_story";

const dir = path.dirname(fileURLToPath(import.meta.url));
const viewSource = readFileSync(
  path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_path_story_view.tsx"),
  "utf8",
);
const detailSource = readFileSync(
  path.join(dir, "..", "..", "..", "components", "drug_intelligence", "drug_network_node_detail.tsx"),
  "utf8",
);
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

/** Path 3 shape from the visual review: Person -> Case -> Phone -> Case -> Device (4 hops). */
function path3Neighborhood(): DrugGraphNeighborhoodResponse {
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

// A. evidence action has a real click handler
test("A: the step evidence button has a real onClick handler wired to onViewStepEvidence, not a bare styled span", () => {
  assert.match(viewSource, /<button\s+type="button"[\s\S]{0,80}onClick=\{\(\) => onViewStepEvidence\(step\)\}/);
  assert.doesNotMatch(viewSource, /<span[^>]*data-testid="network-path-story-step-evidence"/, "must be a real <button>, not a <span> styled to look clickable");
});

// B/C. clicking different steps changes which evidence is shown — verified via the story's own per-step data shape.
test("B/C: each transition step in a 4-hop path carries its OWN distinct evidenceCaseIds/order — the data needed to distinguish step 2 from step 3 from step 4", () => {
  const explanation = explainFocusToSelectedPaths(path3Neighborhood(), "d1");
  assert.ok(explanation);
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  assert.equal(story.steps.length, 5);
  const transitionSteps = story.steps.filter((s) => s.kind === "transition");
  assert.equal(transitionSteps.length, 4);
  const orders = transitionSteps.map((s) => s.order);
  assert.deepEqual(orders, [2, 3, 4, 5], "each step has its own distinct order number");
  // Steps 2 and 5 carry their own edge's case ids (c2, c1 respectively); every step is independently addressable.
  assert.deepEqual(transitionSteps[0]!.evidenceCaseIds, ["c2"]);
  assert.deepEqual(transitionSteps[3]!.evidenceCaseIds, ["c1"]);
});

test("the node-detail handler passes the FULL clicked step through, not just its case ids (the previous bug's root cause)", () => {
  assert.match(detailSource, /onViewStepEvidence=\{\(step\) => \{/);
  assert.match(detailSource, /setActiveEvidenceStep\(step\)/);
  // Regression guard: the old buggy handler shape must not reappear.
  assert.doesNotMatch(detailSource, /onViewStepEvidence=\{evidenceCaseIds\.length > 0 \? \(\) => setEvidenceOpen\(true\) : undefined\}/);
});

// D. existing evidence disclosure opens
test("D: clicking a step's evidence action also opens the existing evidence <details> disclosure (setEvidenceOpen(true))", () => {
  assert.match(detailSource, /onViewStepEvidence=\{\(step\) => \{\s*setActiveEvidenceStep\(step\);\s*setEvidenceOpen\(true\);/);
});

// E. active step gets visible feedback
test("E: the active step receives a visible highlight (border/background change) AND a text note, not color alone", () => {
  assert.match(viewSource, /isActiveEvidence \? "border-accent bg-accent\/10"/);
  assert.match(viewSource, /storyEvidenceActiveNote/);
  assert.match(detailSource, /storyEvidenceStepCaption/, "the evidence panel itself also captions which step is active");
});

// F. path switch clears/stabilizes active evidence selection
test("F: activeEvidenceStep resets on path signature change (node.id + activePath.signature), preventing a stale Path-1 selection while Path 3 is active", () => {
  assert.match(detailSource, /useEffect\(\(\) => \{\s*setActiveEvidenceStep\(null\);\s*\}, \[node\.id, activePathSignature\]\)/);
});

// G. no evidence exists -> no fabricated evidence
test("G: when the active step's own evidence AND the path-level evidence are both empty, the disclosure shows the honest empty-state string, never a fabricated list", () => {
  assert.match(detailSource, /storyEvidenceStepEmpty/);
  assert.match(detailSource, /idsToShow\.length === 0/);
});

test("step-scoped vs path-level evidence: the panel explicitly labels path-level evidence as path-level when a step has no evidence of its own", () => {
  assert.match(detailSource, /storyEvidencePathLevelNote/);
  assert.match(detailSource, /const stepScoped = activeEvidenceStep && activeEvidenceStep\.evidenceCaseIds\.length > 0/);
});

// H. DIRECT path still works (1 hop — origin + 1 transition step, evidence button present if that edge has case ids)
test("H: a DIRECT (1-hop) path produces exactly one transition step with its own evidenceCaseIds", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [node("p1", "PERSON", "นาย ก"), node("ph1", "PHONE", "081-111-1111")],
    edges: [edge("pp1", "p1", "ph1", "PERSON_PHONE", ["c9"])],
    truncated: false,
  };
  const explanation = explainFocusToSelectedPaths(neighborhood, "ph1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  const transitions = story.steps.filter((s) => s.kind === "transition");
  assert.equal(transitions.length, 1);
  assert.deepEqual(transitions[0]!.evidenceCaseIds, ["c9"]);
});

// I. 2-hop path works
test("I: a 2-hop path (Path 1 shape) produces 2 independently-addressable transition steps", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"), node("c1", "CASE", "DI-TEST-001"), node("d1", "DEVICE", "Samsung Galaxy A54")],
    edges: [edge("e1", "p1", "c1", "PERSON_CASE", ["c1"]), edge("e2", "c1", "d1", "CASE_DEVICE", ["c1"])],
    truncated: false,
  };
  const explanation = explainFocusToSelectedPaths(neighborhood, "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  const transitions = story.steps.filter((s) => s.kind === "transition");
  assert.equal(transitions.length, 2);
  assert.deepEqual(transitions.map((s) => s.order), [2, 3]);
});

// J. 3-hop path works (Path 2 shape)
test("J: a 3-hop path (Path 2 shape) produces 3 independently-addressable transition steps", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
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
  const explanation = explainFocusToSelectedPaths(neighborhood, "dY");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  const transitions = story.steps.filter((s) => s.kind === "transition");
  assert.equal(transitions.length, 3);
  assert.deepEqual(transitions.map((s) => s.order), [2, 3, 4]);
});

// K. 4-hop Path 3 works
test("K: the 4-hop Path 3 shape (Person -> Case -> Phone -> Case -> Device) produces 4 independently-addressable transition steps, each carrying its own real edge's supportingCaseIds — never someone else's", () => {
  const explanation = explainFocusToSelectedPaths(path3Neighborhood(), "d1");
  assert.ok(explanation);
  const rawSteps = explanation!.paths[0]!.steps;
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  const transitions = story.steps.filter((s) => s.kind === "transition");
  assert.equal(transitions.length, 4);
  assert.deepEqual(transitions.map((s) => s.order), [2, 3, 4, 5]);
  // Each story step's evidenceCaseIds must exactly equal that SAME transition's
  // own raw step.supportingCaseIds — the exact bug class this hotfix closes
  // (a step showing another step's evidence).
  for (let i = 0; i < transitions.length; i += 1) {
    assert.deepEqual(transitions[i]!.evidenceCaseIds, rawSteps[i + 1]!.supportingCaseIds, `step ${i + 2} must carry exactly its own edge's evidence`);
  }
});

// L. narrative text remains unchanged
test("L: the natural-language sentence generation is untouched by this hotfix — Path 1 sentence text still matches the approved wording", () => {
  const neighborhood: DrugGraphNeighborhoodResponse = {
    focus: { entityType: "PERSON", entityId: "p1" },
    nodes: [node("p1", "PERSON", "นายกิตติศักดิ์ ทดสอบระบบ"), node("c1", "CASE", "DI-TEST-001"), node("d1", "DEVICE", "Samsung Galaxy A54")],
    edges: [edge("e1", "p1", "c1", "PERSON_CASE", ["c1"]), edge("e2", "c1", "d1", "CASE_DEVICE", ["c1"])],
    truncated: false,
  };
  const explanation = explainFocusToSelectedPaths(neighborhood, "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  assert.equal(story.steps[1]!.sentence, "นายกิตติศักดิ์ ทดสอบระบบ ปรากฏเป็นผู้เกี่ยวข้องในคดี DI-TEST-001");
  assert.equal(story.steps[2]!.sentence, "ในคดี DI-TEST-001 พบอุปกรณ์ Samsung Galaxy A54");
});

// M. DIRECT/PATH semantics unchanged
test("M: isDirect/hopCount are still read straight from path.hopCount — this hotfix touches no classification logic", () => {
  const explanation = explainFocusToSelectedPaths(path3Neighborhood(), "d1");
  const story = buildNetworkPathStory(explanation!, explanation!.paths[0]!, th);
  assert.equal(story.conclusion.isDirect, false);
  assert.equal(story.conclusion.hopCount, 4);
  assert.equal(story.conclusion.hopCount, explanation!.paths[0]!.hopCount);
});

// N. graph path enumeration unchanged — this hotfix module imports nothing from the enumeration/viewport/camera layer.
test("N: the hotfix touches no path-enumeration, viewport, or camera code — verified by import surface", () => {
  const storySource = readFileSync(path.join(dir, "..", "drug_network_path_story.ts"), "utf8");
  assert.doesNotMatch(storySource, /enumerateUndirectedPaths/, "story module must not reimplement/call path enumeration itself");
  assert.doesNotMatch(detailSource, /drug_network_drawer_viewport.*enumerateUndirectedPaths/);
});

// Evidence follow/scroll — clicking a step's evidence action brings the evidence section into view,
// and repeated clicks on different steps re-trigger the follow (not just on the very first click).
test("O: clicking a step's evidence action scrolls/follows the evidence section into view, keyed on the active step itself (so switching Step 3 -> Step 4 re-triggers the follow)", () => {
  assert.match(detailSource, /evidenceSectionRef\.current\?\.scrollIntoView/);
  const effectBlock = detailSource.match(/useEffect\(\(\) => \{[\s\S]{0,300}?\}, \[activeEvidenceStep\]\);/);
  assert.ok(effectBlock, "an effect dependent on [activeEvidenceStep] must exist");
  assert.match(effectBlock![0], /if \(!activeEvidenceStep\) return;/);
  assert.match(effectBlock![0], /evidenceSectionRef\.current\?\.scrollIntoView/);
  assert.match(detailSource, /ref=\{evidenceSectionRef\}/, "the evidence <details> element must actually hold the ref the scroll effect targets");
});

test("evidence follow never fires merely from the reset-to-null on path/node switch (it is guarded by `if (!activeEvidenceStep) return`)", () => {
  const effectBlock = detailSource.match(/useEffect\(\(\) => \{[\s\S]{0,300}?\}, \[activeEvidenceStep\]\);/);
  assert.ok(effectBlock, "the guarded follow effect must exist");
  // The reset-to-null effect is a SEPARATE effect keyed on [node.id, activePathSignature], not [activeEvidenceStep].
  assert.doesNotMatch(effectBlock![0], /setActiveEvidenceStep\(null\)/, "the follow effect must not also be the reset effect");
});
