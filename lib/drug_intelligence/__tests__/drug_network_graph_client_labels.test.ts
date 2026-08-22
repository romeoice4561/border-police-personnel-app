/**
 * Tests for the DI-5.1 relationship-type filter grouping (Direct vs
 * Inferred) and the short-label completeness — the exact split the
 * relationship filter UI renders as two fieldsets.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES,
  DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES,
  DRUG_GRAPH_RELATIONSHIP_LABEL_KEY,
  DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY,
} from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";

const ALL_RELATIONSHIP_TYPES: DrugGraphRelationshipType[] = [
  "PERSON_CASE",
  "PERSON_PHONE",
  "PERSON_SIM",
  "PERSON_DEVICE",
  "PERSON_VEHICLE",
  "CASE_PHONE",
  "CASE_SIM",
  "CASE_DEVICE",
  "CASE_VEHICLE",
  "CASE_LOCATION",
  "SHARED_CASE",
  "SHARED_PHONE",
  "SHARED_SIM",
  "SHARED_DEVICE",
  "SHARED_VEHICLE",
];

test("every relationship type appears in exactly one of Direct/Inferred — no gaps, no overlap", () => {
  const combined = [...DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES, ...DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES];
  assert.deepEqual([...combined].sort(), [...ALL_RELATIONSHIP_TYPES].sort());
  const overlap = DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES.filter((t) => DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES.includes(t));
  assert.deepEqual(overlap, []);
});

test("CASE_LOCATION is Direct, never Inferred — location-sharing must never become an inferred Person-to-Person type", () => {
  assert.ok(DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES.includes("CASE_LOCATION"));
  assert.ok(!DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES.includes("CASE_LOCATION"));
});

test("no location-based inferred relationship type exists at all (e.g. no SHARED_LOCATION)", () => {
  assert.ok(!DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES.some((t) => t.includes("LOCATION")));
});

test("every relationship type has both a full label key and a short label key — no missing entry for the filter/canvas", () => {
  for (const type of ALL_RELATIONSHIP_TYPES) {
    assert.ok(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[type], `missing full label for ${type}`);
    assert.ok(DRUG_GRAPH_RELATIONSHIP_SHORT_LABEL_KEY[type], `missing short label for ${type}`);
  }
});

test("Inferred group contains exactly the 5 SHARED_* types", () => {
  assert.deepEqual(
    [...DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES].sort(),
    ["SHARED_CASE", "SHARED_DEVICE", "SHARED_PHONE", "SHARED_SIM", "SHARED_VEHICLE"].sort()
  );
});
