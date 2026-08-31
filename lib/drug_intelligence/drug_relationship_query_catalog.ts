/**
 * Controlled Relationship Search catalog (Intelligence Search Center Phase 1B).
 *
 * Single source of truth for which source → relation → target combinations
 * officers may ask. Every entry maps to an evidence-backed graph relationship
 * (junction DIRECT or SHARED_* INFERRED) or to Find Connection (PATH).
 *
 * QUERY CONDITION ≠ FACT: selecting a catalog entry never writes intelligence.
 * Vocabulary must not overclaim (no โทรหา / เจ้าของ / conspiracy wording).
 */

import type { DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_network_graph_types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export type DrugRelationshipEdgeKind = "DIRECT" | "INFERRED";

export type DrugRelationshipQueryMode = "NEIGHBORHOOD" | "PATH";

/** Searchable MVP source types (LOCATION is target-only via case relations). */
export type DrugRelationshipSearchableEntityType = Exclude<DrugGraphNodeType, "LOCATION">;

export interface DrugControlledRelationDefinition {
  /** Stable controlled id — API + URL only accept these. */
  id: string;
  sourceTypes: DrugGraphNodeType[];
  targetTypes: DrugGraphNodeType[];
  /** Graph relationshipType for NEIGHBORHOOD queries; null for PATH mode. */
  graphRelationshipType: DrugGraphRelationshipType | null;
  edgeKind: DrugRelationshipEdgeKind | "PATH";
  queryMode: DrugRelationshipQueryMode;
  /** Neighborhood hop depth required to surface this relation. */
  neighborhoodDepth: 1 | 2;
  /** Target entity id may be omitted ("เกี่ยวข้องกับอะไรบ้าง"). */
  targetOptional: boolean;
  /** Exposed in MVP UI / API. */
  mvpAvailable: boolean;
  /** i18n key for officer-facing relation wording (must not overclaim). */
  labelKey: TranslationKey;
  /** Short evidence semantics note for tests / docs (English). */
  evidenceSemantics: string;
}

/**
 * Authoritative MVP catalog. Reverse lookups are explicit entries so the
 * contextual picker never invents invalid pairs.
 */
export const DRUG_CONTROLLED_RELATIONS: readonly DrugControlledRelationDefinition[] = [
  // ── PERSON → * (DIRECT) ───────────────────────────────────────────────
  {
    id: "person_found_in_case",
    sourceTypes: ["PERSON"],
    targetTypes: ["CASE"],
    graphRelationshipType: "PERSON_CASE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personFoundInCase",
    evidenceSemantics: "DrugCasePerson junction — person recorded on case",
  },
  {
    id: "person_related_phone",
    sourceTypes: ["PERSON"],
    targetTypes: ["PHONE"],
    graphRelationshipType: "PERSON_PHONE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personRelatedPhone",
    evidenceSemantics: "Person–phone case link / DrugCasePhone with personId",
  },
  {
    id: "person_related_sim",
    sourceTypes: ["PERSON"],
    targetTypes: ["SIM"],
    graphRelationshipType: "PERSON_SIM",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personRelatedSim",
    evidenceSemantics: "Person–SIM case link",
  },
  {
    id: "person_related_device",
    sourceTypes: ["PERSON"],
    targetTypes: ["DEVICE"],
    graphRelationshipType: "PERSON_DEVICE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personRelatedDevice",
    evidenceSemantics: "DrugPersonDevice junction — recorded device use, not ownership claim",
  },
  {
    id: "person_related_vehicle",
    sourceTypes: ["PERSON"],
    targetTypes: ["VEHICLE"],
    graphRelationshipType: "PERSON_VEHICLE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personRelatedVehicle",
    evidenceSemantics: "DrugPersonVehicle junction — recorded vehicle association, not ownership claim",
  },

  // ── CASE → entity (DIRECT) ────────────────────────────────────────────
  {
    id: "case_has_person",
    sourceTypes: ["CASE"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "PERSON_CASE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.caseHasPerson",
    evidenceSemantics: "DrugCasePerson junction",
  },
  {
    id: "case_has_phone",
    sourceTypes: ["CASE"],
    targetTypes: ["PHONE"],
    graphRelationshipType: "CASE_PHONE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.caseHasPhone",
    evidenceSemantics: "DrugCasePhone junction",
  },
  {
    id: "case_has_sim",
    sourceTypes: ["CASE"],
    targetTypes: ["SIM"],
    graphRelationshipType: "CASE_SIM",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.caseHasSim",
    evidenceSemantics: "DrugCaseSim junction",
  },
  {
    id: "case_has_device",
    sourceTypes: ["CASE"],
    targetTypes: ["DEVICE"],
    graphRelationshipType: "CASE_DEVICE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.caseHasDevice",
    evidenceSemantics: "DrugCaseDevice junction",
  },
  {
    id: "case_has_vehicle",
    sourceTypes: ["CASE"],
    targetTypes: ["VEHICLE"],
    graphRelationshipType: "CASE_VEHICLE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.caseHasVehicle",
    evidenceSemantics: "DrugCaseVehicle junction",
  },
  {
    id: "case_has_location",
    sourceTypes: ["CASE"],
    targetTypes: ["LOCATION"],
    graphRelationshipType: "CASE_LOCATION",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.caseHasLocation",
    evidenceSemantics: "DrugCaseLocation junction",
  },

  // ── Entity → CASE (DIRECT reverse) ────────────────────────────────────
  {
    id: "phone_found_in_case",
    sourceTypes: ["PHONE"],
    targetTypes: ["CASE"],
    graphRelationshipType: "CASE_PHONE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.phoneFoundInCase",
    evidenceSemantics: "DrugCasePhone junction",
  },
  {
    id: "sim_found_in_case",
    sourceTypes: ["SIM"],
    targetTypes: ["CASE"],
    graphRelationshipType: "CASE_SIM",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.simFoundInCase",
    evidenceSemantics: "DrugCaseSim junction",
  },
  {
    id: "device_found_in_case",
    sourceTypes: ["DEVICE"],
    targetTypes: ["CASE"],
    graphRelationshipType: "CASE_DEVICE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.deviceFoundInCase",
    evidenceSemantics: "DrugCaseDevice junction",
  },
  {
    id: "vehicle_found_in_case",
    sourceTypes: ["VEHICLE"],
    targetTypes: ["CASE"],
    graphRelationshipType: "CASE_VEHICLE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.vehicleFoundInCase",
    evidenceSemantics: "DrugCaseVehicle junction",
  },

  // ── Entity → PERSON (DIRECT reverse) ──────────────────────────────────
  {
    id: "phone_related_person",
    sourceTypes: ["PHONE"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "PERSON_PHONE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.phoneRelatedPerson",
    evidenceSemantics: "Person–phone case link",
  },
  {
    id: "sim_related_person",
    sourceTypes: ["SIM"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "PERSON_SIM",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.simRelatedPerson",
    evidenceSemantics: "Person–SIM case link",
  },
  {
    id: "device_related_person",
    sourceTypes: ["DEVICE"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "PERSON_DEVICE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.deviceRelatedPerson",
    evidenceSemantics: "DrugPersonDevice junction",
  },
  {
    id: "vehicle_related_person",
    sourceTypes: ["VEHICLE"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "PERSON_VEHICLE",
    edgeKind: "DIRECT",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 1,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.vehicleRelatedPerson",
    evidenceSemantics: "DrugPersonVehicle junction",
  },

  // ── PERSON ↔ PERSON INFERRED (SHARED_*) ───────────────────────────────
  {
    id: "person_shared_case",
    sourceTypes: ["PERSON"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "SHARED_CASE",
    edgeKind: "INFERRED",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 2,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personSharedCase",
    evidenceSemantics: "Inferred: persons appear on overlapping cases in neighborhood",
  },
  {
    id: "person_shared_phone",
    sourceTypes: ["PERSON"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "SHARED_PHONE",
    edgeKind: "INFERRED",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 2,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personSharedPhone",
    evidenceSemantics: "Inferred: persons share a recorded phone in neighborhood",
  },
  {
    id: "person_shared_sim",
    sourceTypes: ["PERSON"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "SHARED_SIM",
    edgeKind: "INFERRED",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 2,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personSharedSim",
    evidenceSemantics: "Inferred: persons share a recorded SIM in neighborhood",
  },
  {
    id: "person_shared_device",
    sourceTypes: ["PERSON"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "SHARED_DEVICE",
    edgeKind: "INFERRED",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 2,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personSharedDevice",
    evidenceSemantics: "Inferred: persons share a recorded device in neighborhood",
  },
  {
    id: "person_shared_vehicle",
    sourceTypes: ["PERSON"],
    targetTypes: ["PERSON"],
    graphRelationshipType: "SHARED_VEHICLE",
    edgeKind: "INFERRED",
    queryMode: "NEIGHBORHOOD",
    neighborhoodDepth: 2,
    targetOptional: true,
    mvpAvailable: true,
    labelKey: "di.rel.personSharedVehicle",
    evidenceSemantics: "Inferred: persons share a recorded vehicle in neighborhood",
  },

  // ── Find Connection (DIRECT path only) ────────────────────────────────
  {
    id: "person_path_to_person",
    sourceTypes: ["PERSON"],
    targetTypes: ["PERSON"],
    graphRelationshipType: null,
    edgeKind: "PATH",
    queryMode: "PATH",
    neighborhoodDepth: 1,
    targetOptional: false,
    mvpAvailable: true,
    labelKey: "di.rel.personPathToPerson",
    evidenceSemantics: "Bounded DIRECT BFS path via DrugNetworkGraphService.findPaths",
  },
] as const;

export type DrugControlledRelationId = (typeof DRUG_CONTROLLED_RELATIONS)[number]["id"];

const BY_ID = new Map<string, DrugControlledRelationDefinition>(DRUG_CONTROLLED_RELATIONS.map((r) => [r.id, r]));

/** Phrases that must never appear in catalog label keys' Thai/EN copy (enforced by tests against dictionary). */
export const DRUG_RELATIONSHIP_FORBIDDEN_VOCABULARY = [
  "โทรหา",
  "เจ้าของ",
  "owns",
  "called",
  "CDR",
  "PHONE_CALLED",
  "เครือข่ายผู้ร่วมขบวนการ",
  "criminal conspiracy",
] as const;

/** Presets that ship in MVP — each maps to a catalog id + preferred source type. */
export interface DrugRelationshipSearchPreset {
  id: string;
  labelKey: TranslationKey;
  relationId: DrugControlledRelationId;
  sourceType: DrugRelationshipSearchableEntityType;
  /** When true, UI requires a target entity (path / A↔B). */
  requiresTarget: boolean;
}

export const DRUG_RELATIONSHIP_SEARCH_PRESETS: readonly DrugRelationshipSearchPreset[] = [
  { id: "preset_phone_cases", labelKey: "di.rel.presetPhoneCases", relationId: "phone_found_in_case", sourceType: "PHONE", requiresTarget: false },
  { id: "preset_person_phones", labelKey: "di.rel.presetPersonPhones", relationId: "person_related_phone", sourceType: "PERSON", requiresTarget: false },
  { id: "preset_vehicle_cases", labelKey: "di.rel.presetVehicleCases", relationId: "vehicle_found_in_case", sourceType: "VEHICLE", requiresTarget: false },
  { id: "preset_device_cases", labelKey: "di.rel.presetDeviceCases", relationId: "device_found_in_case", sourceType: "DEVICE", requiresTarget: false },
  { id: "preset_sim_cases", labelKey: "di.rel.presetSimCases", relationId: "sim_found_in_case", sourceType: "SIM", requiresTarget: false },
  { id: "preset_person_path", labelKey: "di.rel.presetPersonPath", relationId: "person_path_to_person", sourceType: "PERSON", requiresTarget: true },
];

export function getControlledRelation(id: string): DrugControlledRelationDefinition | null {
  return BY_ID.get(id) ?? null;
}

export function listMvpControlledRelations(): DrugControlledRelationDefinition[] {
  return DRUG_CONTROLLED_RELATIONS.filter((r) => r.mvpAvailable);
}

export function relationsForSourceType(sourceType: DrugGraphNodeType): DrugControlledRelationDefinition[] {
  return listMvpControlledRelations().filter((r) => r.sourceTypes.includes(sourceType));
}

export function isValidRelationCombination(params: {
  relationId: string;
  sourceType: DrugGraphNodeType;
  targetType: DrugGraphNodeType;
  targetEntityId?: string | null;
}): { ok: true; relation: DrugControlledRelationDefinition } | { ok: false; reason: string } {
  const relation = getControlledRelation(params.relationId);
  if (!relation || !relation.mvpAvailable) {
    return { ok: false, reason: "Unknown or unavailable relation" };
  }
  if (!relation.sourceTypes.includes(params.sourceType)) {
    return { ok: false, reason: "Source type incompatible with relation" };
  }
  if (!relation.targetTypes.includes(params.targetType)) {
    return { ok: false, reason: "Target type incompatible with relation" };
  }
  if (!relation.targetOptional && !params.targetEntityId) {
    return { ok: false, reason: "Target entity required for this relation" };
  }
  return { ok: true, relation };
}

/** All DIRECT graph types that appear in the catalog (for integrity tests). */
export const CATALOG_DIRECT_GRAPH_TYPES: DrugGraphRelationshipType[] = [
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
];

export const CATALOG_INFERRED_GRAPH_TYPES: DrugGraphRelationshipType[] = [
  "SHARED_CASE",
  "SHARED_PHONE",
  "SHARED_SIM",
  "SHARED_DEVICE",
  "SHARED_VEHICLE",
];
