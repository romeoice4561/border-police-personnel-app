/**
 * Phase 1C — Progressive Relationship Investigation (source-contract tests).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INVESTIGATION_TRAIL_MAX_EXPANSIONS,
  canExpandInvestigationTrail,
  clearInvestigationTrailStorage,
  emptyInvestigationTrail,
  ensureTrailOrigin,
  isInvestigationTrailActive,
  popInvestigationStep,
  pushInvestigationExpansion,
  sanitizeInvestigationReturnPath,
} from "@/lib/drug_intelligence/drug_relationship_investigation_trail";
import { relationsForSourceType } from "@/lib/drug_intelligence/drug_relationship_query_catalog";

const ROOT = process.cwd();
const panelSrc = readFileSync(
  join(ROOT, "components/drug_intelligence/drug_relationship_search_panel.tsx"),
  "utf8"
);
const resultsSrc = readFileSync(
  join(ROOT, "components/drug_intelligence/drug_relationship_search_results.tsx"),
  "utf8"
);
const trailUiSrc = readFileSync(
  join(ROOT, "components/drug_intelligence/drug_relationship_investigation_trail.tsx"),
  "utf8"
);
const trailLibSrc = readFileSync(
  join(ROOT, "lib/drug_intelligence/drug_relationship_investigation_trail.ts"),
  "utf8"
);
const catalogSrc = readFileSync(
  join(ROOT, "lib/drug_intelligence/drug_relationship_query_catalog.ts"),
  "utf8"
);
const dictSrc = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");

describe("Phase 1C trail model", () => {
  test("A. max expansions bounded and explicit", () => {
    assert.equal(INVESTIGATION_TRAIL_MAX_EXPANSIONS, 3);
    assert.match(trailLibSrc, /INVESTIGATION_TRAIL_MAX_EXPANSIONS = 3/);
  });

  test("B/C. Expand push adds step and becomes next source payload", () => {
    let trail = emptyInvestigationTrail();
    trail = ensureTrailOrigin(trail, {
      entity: { entityType: "PERSON", entityId: "p1", label: "นาย ก" },
      returnPath:
        "/drug-intelligence/search?mode=relationship&relSourceType=PERSON&relSourceId=p1&relationId=person_found_in_case&relTargetType=CASE&relRun=1#relationship-results",
      queryContext: { matchedField: "IDENTIFIER", matchedValueMasked: "••••0001" },
    });
    const pushed = pushInvestigationExpansion(trail, {
      source: { entityType: "PERSON", entityId: "p1", label: "นาย ก" },
      relationId: "person_found_in_case",
      targetType: "CASE",
      result: { entityType: "CASE", entityId: "c1", label: "QA-001" },
      edgeKind: "DIRECT",
      evidenceSummary: "พบชื่อในข้อมูลผู้เกี่ยวข้อง",
      returnPath:
        "/drug-intelligence/search?mode=relationship&relSourceType=PERSON&relSourceId=p1&relationId=person_found_in_case&relTargetType=CASE&relRun=1#relationship-results",
    });
    assert.ok(pushed);
    assert.equal(pushed!.steps.length, 1);
    assert.equal(pushed!.steps[0]!.result.entityId, "c1");
    assert.equal(pushed!.steps[0]!.edgeKind, "DIRECT");
  });

  test("D. next relation options remain catalog-driven for CASE source", () => {
    const relations = relationsForSourceType("CASE");
    assert.ok(relations.some((r) => r.id === "case_has_phone"));
    assert.ok(relations.every((r) => r.sourceTypes.includes("CASE")));
  });

  test("E. Expand does not auto-run next query (clears relRun)", () => {
    assert.match(panelSrc, /function onExpand/);
    assert.match(panelSrc, /function onExpand[\s\S]*?pushRelationshipParams\(\{[\s\S]*?relRun: undefined/);
    assert.match(panelSrc, /function onExpand[\s\S]*?focusStep2Soon\(\)/);
    assert.doesNotMatch(panelSrc, /function onExpand[\s\S]*?pushRelationshipParams\(\{[\s\S]*?run:\s*true/);
  });

  test("F. second expansion creates trail of length 2", () => {
    let trail = emptyInvestigationTrail();
    trail = ensureTrailOrigin(trail, {
      entity: { entityType: "PERSON", entityId: "p1", label: "P" },
      returnPath: "/drug-intelligence/search?mode=relationship&relRun=1",
      queryContext: null,
    });
    trail = pushInvestigationExpansion(trail, {
      source: { entityType: "PERSON", entityId: "p1", label: "P" },
      relationId: "person_found_in_case",
      targetType: "CASE",
      result: { entityType: "CASE", entityId: "c1", label: "QA-001" },
      edgeKind: "DIRECT",
      returnPath: "/a",
    })!;
    trail = pushInvestigationExpansion(trail, {
      source: { entityType: "CASE", entityId: "c1", label: "QA-001" },
      relationId: "case_has_phone",
      targetType: "PHONE",
      result: { entityType: "PHONE", entityId: "ph1", label: "08X" },
      edgeKind: "DIRECT",
      returnPath: "/b",
    })!;
    assert.equal(trail.steps.length, 2);
    assert.equal(trail.steps[1]!.result.entityType, "PHONE");
  });

  test("G. third expansion allowed; fourth blocked", () => {
    let trail = emptyInvestigationTrail();
    for (let i = 0; i < 3; i++) {
      const next = pushInvestigationExpansion(trail, {
        source: { entityType: "PERSON", entityId: "p1", label: "P" },
        relationId: "person_found_in_case",
        targetType: "CASE",
        result: { entityType: "CASE", entityId: `c${i}`, label: `C${i}` },
        edgeKind: "DIRECT",
        returnPath: `/r${i}`,
      });
      assert.ok(next);
      trail = next!;
    }
    assert.equal(trail.steps.length, 3);
    assert.equal(canExpandInvestigationTrail(trail), false);
    assert.equal(
      pushInvestigationExpansion(trail, {
        source: { entityType: "CASE", entityId: "c2", label: "C2" },
        relationId: "case_has_phone",
        targetType: "PHONE",
        result: { entityType: "PHONE", entityId: "ph", label: "ph" },
        edgeKind: "DIRECT",
        returnPath: "/r3",
      }),
      null
    );
  });

  test("H. trail identifies current entity via last result", () => {
    assert.match(trailUiSrc, /currentInvestigationEntity|trail-breadcrumb/);
    assert.match(trailUiSrc, /data-testid="investigation-trail"/);
  });

  test("I. Back one step restores prior returnPath", () => {
    let trail = emptyInvestigationTrail();
    trail = ensureTrailOrigin(trail, {
      entity: { entityType: "PERSON", entityId: "p1", label: "P" },
      returnPath: "/origin",
      queryContext: null,
    });
    trail = pushInvestigationExpansion(trail, {
      source: { entityType: "PERSON", entityId: "p1", label: "P" },
      relationId: "person_found_in_case",
      targetType: "CASE",
      result: { entityType: "CASE", entityId: "c1", label: "QA-001" },
      edgeKind: "DIRECT",
      returnPath: "/step1",
    })!;
    const popped = popInvestigationStep(trail);
    assert.equal(popped.restoredReturnPath, "/step1");
    assert.equal(popped.trail.steps.length, 0);
    assert.match(panelSrc, /function backOneInvestigationStep/);
    assert.match(panelSrc, /popInvestigationStep/);
  });

  test("J/K/X. Clear All / New Search clear trail + session", () => {
    assert.match(panelSrc, /function resetAll[\s\S]*emptyInvestigationTrail\(\)/);
    assert.match(panelSrc, /function resetAll[\s\S]*clearInvestigationTrailStorage\(\)/);
    assert.match(panelSrc, /function startNewSearch\(\) \{\s*resetAll\(\)/);
    assert.equal(typeof clearInvestigationTrailStorage, "function");
    assert.equal(isInvestigationTrailActive(emptyInvestigationTrail()), false);
  });
});

describe("Phase 1C UI / navigation / semantics contracts", () => {
  test("L–O. returnTo still used for Detail/Network/Timeline/Map", () => {
    assert.match(resultsSrc, /withReturnTo\(item\.actions\.detailPath/);
    assert.match(resultsSrc, /withReturnTo\(`\$\{item\.actions\.networkPath/);
    assert.match(resultsSrc, /withReturnTo\(item\.actions\.timelinePath/);
    assert.match(resultsSrc, /withReturnTo\(item\.actions\.mapPath/);
  });

  test("P. Quick Search hidden during progressive trail / answer flow", () => {
    assert.match(panelSrc, /const showQuickSearch = !showAnswerFirst && !trailActive/);
    assert.match(panelSrc, /showQuickSearch \? quickSearchSection/);
    const answerBranch = panelSrc.match(/\{showAnswerFirst \? \(([\s\S]*?)\) : \(/)?.[1] ?? "";
    assert.ok(!answerBranch.includes("quickSearchSection"));
  });

  test("Q. visual entity mapping used in trail UI", () => {
    assert.match(trailUiSrc, /DrugEntityIconMark/);
  });

  test("R–T. FACT / INFERRED / PATH preserved on expand payload", () => {
    assert.match(resultsSrc, /edgeKind: item\.edgeKind/);
    assert.match(resultsSrc, /evidenceSummary: evidence/);
    assert.match(catalogSrc, /edgeKind:\s*"DIRECT"/);
    assert.match(catalogSrc, /edgeKind:\s*"INFERRED"/);
    assert.match(catalogSrc, /queryMode:\s*"PATH"/);
  });

  test("U. query conditions never written as fact; trail is QUERY CONTEXT", () => {
    assert.match(trailLibSrc, /QUERY CONTEXT/);
    assert.match(dictSrc, /di\.rel\.trailHint":\s*tr\(/);
    assert.match(dictSrc, /ไม่ใช่ข้อเท็จจริงใหม่ในระบบ/);
    assert.doesNotMatch(panelSrc, /\bprisma\./);
  });

  test("V. unsupported CDR relationship absent from usable catalog", () => {
    assert.match(catalogSrc, /"CDR"/);
    assert.match(catalogSrc, /"PHONE_CALLED"/);
    // Forbidden vocabulary list documents bans — no relation id uses them.
    assert.doesNotMatch(catalogSrc, /id:\s*"(cdr|phone_called|phone_call)[^"]*"/i);
    assert.doesNotMatch(panelSrc, /relationId:\s*"(cdr|phone_called)/i);
    assert.doesNotMatch(trailLibSrc, /\bCDR\b|PHONE_CALLED/);
  });

  test("W. sanitize strips raw q/queryText from trail return paths", () => {
    const dirty =
      "/drug-intelligence/search?mode=relationship&q=9999999990001&queryText=secret&relRun=1#relationship-results";
    const clean = sanitizeInvestigationReturnPath(dirty);
    assert.doesNotMatch(clean, /9999999990001|queryText=secret|(\?|&)q=/);
    assert.match(clean, /relRun=1/);
  });

  test("Y. mobile trail stacks (flex-col on small screens)", () => {
    assert.match(trailUiSrc, /flex flex-col gap-2 sm:flex-row/);
  });

  test("Z. no factual writes in trail module", () => {
    assert.doesNotMatch(trailLibSrc, /\bprisma\./);
    assert.doesNotMatch(trailLibSrc, /INSERT|UPDATE|createMany/i);
  });

  test("Network handoff from trail uses focus + depth=2 + returnTo", () => {
    assert.match(trailUiSrc, /depth=2/);
    assert.match(trailUiSrc, /withReturnTo/);
    assert.match(trailUiSrc, /di\.rel\.trailOpenNetwork/);
  });

  test("Expand disabled at limit", () => {
    assert.match(resultsSrc, /expandDisabled/);
    assert.match(panelSrc, /expandDisabled=\{!expandAllowed\}/);
    assert.match(dictSrc, /di\.rel\.trailLimitReached"/);
  });
});
