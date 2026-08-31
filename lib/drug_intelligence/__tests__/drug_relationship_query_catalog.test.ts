/**
 * Controlled relationship catalog integrity + vocabulary safeguards (Phase 1B).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { DICTIONARY } from "@/lib/i18n/dictionary";
import {
  CATALOG_DIRECT_GRAPH_TYPES,
  CATALOG_INFERRED_GRAPH_TYPES,
  DRUG_CONTROLLED_RELATIONS,
  DRUG_RELATIONSHIP_FORBIDDEN_VOCABULARY,
  DRUG_RELATIONSHIP_SEARCH_PRESETS,
  getControlledRelation,
  isValidRelationCombination,
  relationsForSourceType,
} from "@/lib/drug_intelligence/drug_relationship_query_catalog";

test("catalog: every relation has valid source/target types and mapping", () => {
  for (const relation of DRUG_CONTROLLED_RELATIONS) {
    assert.ok(relation.id.length > 0);
    assert.ok(relation.sourceTypes.length > 0);
    assert.ok(relation.targetTypes.length > 0);
    assert.ok(DICTIONARY[relation.labelKey], `missing dictionary key ${relation.labelKey}`);
    if (relation.queryMode === "NEIGHBORHOOD") {
      assert.ok(relation.graphRelationshipType, `${relation.id} must map a graph type`);
      if (relation.edgeKind === "DIRECT") {
        assert.ok(CATALOG_DIRECT_GRAPH_TYPES.includes(relation.graphRelationshipType));
      } else if (relation.edgeKind === "INFERRED") {
        assert.ok(CATALOG_INFERRED_GRAPH_TYPES.includes(relation.graphRelationshipType));
      }
    } else {
      assert.equal(relation.graphRelationshipType, null);
      assert.equal(relation.edgeKind, "PATH");
      assert.equal(relation.targetOptional, false);
    }
  }
});

test("catalog: phone-call / ownership relations are absent", () => {
  const ids = DRUG_CONTROLLED_RELATIONS.map((r) => r.id);
  assert.ok(!ids.includes("phone_called_phone"));
  assert.ok(!ids.some((id) => id.toLowerCase().includes("call")));
  assert.ok(!ids.some((id) => id.toLowerCase().includes("owner")));
  assert.ok(!DRUG_CONTROLLED_RELATIONS.some((r) => r.graphRelationshipType === ("PHONE_CALLED_PHONE" as never)));
});

test("catalog: invalid combinations are rejected", () => {
  const bad = isValidRelationCombination({
    relationId: "phone_found_in_case",
    sourceType: "VEHICLE",
    targetType: "CASE",
  });
  assert.equal(bad.ok, false);

  const good = isValidRelationCombination({
    relationId: "phone_found_in_case",
    sourceType: "PHONE",
    targetType: "CASE",
  });
  assert.equal(good.ok, true);

  const pathNeedsTarget = isValidRelationCombination({
    relationId: "person_path_to_person",
    sourceType: "PERSON",
    targetType: "PERSON",
  });
  assert.equal(pathNeedsTarget.ok, false);
});

test("catalog: PHONE contextual relations are constrained", () => {
  const phoneRels = relationsForSourceType("PHONE").map((r) => r.id);
  assert.ok(phoneRels.includes("phone_found_in_case"));
  assert.ok(phoneRels.includes("phone_related_person"));
  assert.ok(!phoneRels.includes("person_related_vehicle"));
  assert.ok(!phoneRels.includes("vehicle_found_in_case"));
});

test("catalog: reverse relations exist for core entity→case links", () => {
  assert.ok(getControlledRelation("phone_found_in_case"));
  assert.ok(getControlledRelation("case_has_phone"));
  assert.ok(getControlledRelation("person_related_phone"));
  assert.ok(getControlledRelation("phone_related_person"));
});

test("catalog: Thai/EN labels do not overclaim (no โทรหา / เจ้าของ / CDR)", () => {
  for (const relation of DRUG_CONTROLLED_RELATIONS) {
    const entry = DICTIONARY[relation.labelKey];
    const blob = `${entry.th} ${entry.en} ${relation.evidenceSemantics}`.toLowerCase();
    for (const forbidden of DRUG_RELATIONSHIP_FORBIDDEN_VOCABULARY) {
      assert.ok(!blob.includes(forbidden.toLowerCase()), `${relation.id} contains forbidden vocabulary "${forbidden}"`);
    }
  }
});

test("catalog: presets only reference MVP relations and evidence-safe targets", () => {
  for (const preset of DRUG_RELATIONSHIP_SEARCH_PRESETS) {
    const relation = getControlledRelation(preset.relationId);
    assert.ok(relation?.mvpAvailable);
    assert.ok(relation?.sourceTypes.includes(preset.sourceType));
    assert.equal(preset.requiresTarget, !relation!.targetOptional);
    assert.ok(!preset.id.includes("call"));
    assert.ok(!preset.id.includes("sim_device"));
  }
});

test("catalog: SIM↔DEVICE 'used with' wording is not exposed", () => {
  assert.equal(getControlledRelation("sim_used_with_device"), null);
  assert.ok(!DRUG_RELATIONSHIP_SEARCH_PRESETS.some((p) => p.id.includes("sim_device")));
});
