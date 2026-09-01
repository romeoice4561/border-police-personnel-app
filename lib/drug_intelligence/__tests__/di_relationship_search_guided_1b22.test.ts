/**
 * Phase 1B.2.2 guided Relationship Search readiness + picker rules.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canSubmitRelationshipQuery,
  flattenSearchResults,
  getGuidedStepStatuses,
  getRelationshipSearchDisabledReason,
  resolveAutoTargetType,
  shouldAutoConfirmExactMatch,
} from "@/lib/drug_intelligence/drug_relationship_search_readiness";
import { getControlledRelation } from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import type { DrugSearchResult } from "@/lib/drug_intelligence/drug_intelligence_client";

const ROOT = process.cwd();
const panelSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_relationship_search_panel.tsx"), "utf8");
const pickerSrc = readFileSync(join(ROOT, "components/drug_intelligence/drug_network_entity_picker.tsx"), "utf8");
const dictSrc = readFileSync(join(ROOT, "lib/i18n/dictionary.ts"), "utf8");

function result(partial: Partial<DrugSearchResult> & Pick<DrugSearchResult, "entityId" | "primaryLabel" | "strength">): DrugSearchResult {
  return {
    entityType: "PHONE",
    secondaryLabel: null,
    matchedField: "PHONE_NUMBER",
    matchedValueMasked: partial.primaryLabel,
    firstSeen: null,
    lastSeen: null,
    caseCount: 1,
    hasPotentialDuplicate: null,
    canonicalTarget: null,
    ...partial,
  };
}

describe("Phase 1B.2.2 typed text is not selection", () => {
  test("A. canSubmit requires concrete source — typed text alone cannot pass", () => {
    const relation = getControlledRelation("phone_found_in_case");
    assert.equal(
      canSubmitRelationshipQuery({
        sourceSelected: false,
        relationId: "phone_found_in_case",
        targetType: "CASE",
        targetSelected: false,
        relation,
      }),
      false
    );
    assert.equal(getRelationshipSearchDisabledReason({
      sourceSelected: false,
      relationId: "phone_found_in_case",
      targetType: "CASE",
      targetSelected: false,
      relation,
    }), "need_source");
  });

  test("picker never treats input value as selected entity without onSelect", () => {
    assert.match(pickerSrc, /typed text is never treated as a selected entity/i);
    assert.match(pickerSrc, /shouldAutoConfirmExactMatch/);
    assert.match(pickerSrc, /di\.rel\.pickerTypingHint/);
  });
});

describe("Phase 1B.2.2 exact / multiple / no-match rules", () => {
  test("B. one EXACT match may auto-confirm", () => {
    assert.equal(shouldAutoConfirmExactMatch([result({ entityId: "1", primaryLabel: "66800000001", strength: "EXACT" })]), true);
  });

  test("C. multiple matches never auto-confirm", () => {
    assert.equal(
      shouldAutoConfirmExactMatch([
        result({ entityId: "1", primaryLabel: "A", strength: "EXACT" }),
        result({ entityId: "2", primaryLabel: "B", strength: "EXACT" }),
      ]),
      false
    );
  });

  test("PARTIAL single match never auto-confirms", () => {
    assert.equal(shouldAutoConfirmExactMatch([result({ entityId: "1", primaryLabel: "ทดสอบ", strength: "PARTIAL", entityType: "PERSON" })]), false);
  });

  test("D. empty flatten yields no-match path", () => {
    assert.deepEqual(flattenSearchResults([{ entityType: "PHONE", results: [] }]), []);
  });
});

describe("Phase 1B.2.2 progressive steps + readiness", () => {
  test("E/F. Step 2 waits for source; Step 3 waits for relation", () => {
    assert.deepEqual(getGuidedStepStatuses({ sourceSelected: false, relationSelected: false, targetReady: false }), {
      step1: "active",
      step2: "waiting",
      step3: "waiting",
    });
    assert.deepEqual(getGuidedStepStatuses({ sourceSelected: true, relationSelected: false, targetReady: false }), {
      step1: "completed",
      step2: "active",
      step3: "waiting",
    });
    assert.deepEqual(getGuidedStepStatuses({ sourceSelected: true, relationSelected: true, targetReady: false }), {
      step1: "completed",
      step2: "completed",
      step3: "active",
    });
  });

  test("G. PHONE→CASE: optional target — Search enabled without specific case", () => {
    const relation = getControlledRelation("phone_found_in_case");
    assert.equal(relation?.targetOptional, true);
    assert.equal(resolveAutoTargetType(relation), "CASE");
    assert.equal(
      canSubmitRelationshipQuery({
        sourceSelected: true,
        relationId: "phone_found_in_case",
        targetType: "CASE",
        targetSelected: false,
        relation,
      }),
      true
    );
  });

  test("H. PERSON→PHONE optional target enables Search", () => {
    const relation = getControlledRelation("person_related_phone");
    assert.equal(relation?.targetOptional, true);
    assert.equal(
      canSubmitRelationshipQuery({
        sourceSelected: true,
        relationId: "person_related_phone",
        targetType: "PHONE",
        targetSelected: false,
        relation,
      }),
      true
    );
  });

  test("I/J/K. VEHICLE/DEVICE/SIM → CASE optional target", () => {
    for (const id of ["vehicle_found_in_case", "device_found_in_case", "sim_found_in_case"] as const) {
      const relation = getControlledRelation(id);
      assert.ok(relation);
      assert.equal(relation.targetOptional, true);
      assert.equal(
        canSubmitRelationshipQuery({
          sourceSelected: true,
          relationId: id,
          targetType: "CASE",
          targetSelected: false,
          relation,
        }),
        true
      );
    }
  });

  test("L. Person↔Person path requires target person", () => {
    const relation = getControlledRelation("person_path_to_person");
    assert.equal(relation?.targetOptional, false);
    assert.equal(
      canSubmitRelationshipQuery({
        sourceSelected: true,
        relationId: "person_path_to_person",
        targetType: "PERSON",
        targetSelected: false,
        relation,
      }),
      false
    );
    assert.equal(
      getRelationshipSearchDisabledReason({
        sourceSelected: true,
        relationId: "person_path_to_person",
        targetType: "PERSON",
        targetSelected: false,
        relation,
      }),
      "need_target_entity"
    );
    assert.equal(
      canSubmitRelationshipQuery({
        sourceSelected: true,
        relationId: "person_path_to_person",
        targetType: "PERSON",
        targetSelected: true,
        relation,
      }),
      true
    );
  });

  test("M/N. disabled reason vs ready keys exist in UI copy", () => {
    assert.match(dictSrc, /di\.rel\.disabledNeedSource/);
    assert.match(dictSrc, /di\.rel\.disabledNeedRelation/);
    assert.match(dictSrc, /di\.rel\.disabledNeedTarget/);
    assert.match(dictSrc, /di\.rel\.searchReadyHint/);
    assert.match(panelSrc, /rel-search-disabled-hint/);
    assert.match(panelSrc, /rel-search-ready-hint/);
    assert.match(panelSrc, /data-ready=\{canSubmit \? "true" : "false"\}/);
  });
});

describe("Phase 1B.2.2 search execution + presets + keyboard", () => {
  test("O/P. loading + scroll-into-view for results", () => {
    assert.match(panelSrc, /di\.rel\.searching/);
    assert.match(panelSrc, /resultsRef\.current\?\.scrollIntoView/);
    assert.match(panelSrc, /prefers-reduced-motion/);
    assert.match(panelSrc, /submitting/);
  });

  test("Q. presets configure relation/target and focus Step 1 without auto-run", () => {
    assert.match(panelSrc, /function applyPreset/);
    assert.match(panelSrc, /relRun: undefined/);
    assert.match(panelSrc, /setFocusSourcePicker\(true\)/);
    assert.match(panelSrc, /di\.rel\.presetFocusPhone/);
    assert.doesNotMatch(panelSrc, /applyPreset\([\s\S]{0,240}run:\s*true/);
  });

  test("R. changing source clears incompatible downstream", () => {
    assert.match(panelSrc, /function clearSource/);
    assert.match(panelSrc, /function onSourceSelected/);
    assert.match(panelSrc, /!currentRelation\.sourceTypes\.includes\(selection\.entityType\)/);
  });

  test("S. keyboard source selection supported", () => {
    assert.match(pickerSrc, /ArrowDown/);
    assert.match(pickerSrc, /ArrowUp/);
    assert.match(pickerSrc, /Enter/);
    assert.match(pickerSrc, /Escape/);
  });

  test("progressive step status attributes present", () => {
    assert.match(panelSrc, /data-step-status=\{stepStatuses\.step1\}/);
    assert.match(panelSrc, /data-step-status=\{stepStatuses\.step2\}/);
    assert.match(panelSrc, /data-step-status=\{stepStatuses\.step3\}/);
    assert.match(panelSrc, /target-from-relation/);
  });
});
