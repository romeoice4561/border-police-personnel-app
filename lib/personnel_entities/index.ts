/**
 * Personnel Entity Resolution Layer (Phase 51.1A).
 */
export * from "@/lib/personnel_entities/types";
export * from "@/lib/personnel_entities/contracts";
export * from "@/lib/personnel_entities/aliases";
export * from "@/lib/personnel_entities/organization";
export * from "@/lib/personnel_entities/unit_resolver";
export * from "@/lib/personnel_entities/person_resolver";
export * from "@/lib/personnel_entities/academy_resolver";
export * from "@/lib/personnel_entities/nickname_resolver";
export * from "@/lib/personnel_entities/context";
export * from "@/lib/personnel_entities/suggestions";
export {
  resolvePersonnelEntities,
  buildOrgEntityCatalog,
  type ResolvePersonnelEntitiesOptions,
} from "@/lib/personnel_entities/resolver";
