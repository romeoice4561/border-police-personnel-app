/**
 * Governed Intelligence Tool Registry & Execution Framework (Phase 49.6).
 *
 * Preserves Phase 49.5 exports: INTELLIGENCE_TOOL_NAMES, INTELLIGENCE_TOOL_DEFINITIONS.
 */
export * from "@/lib/personnel_intelligence_service/tools/types";
export * from "@/lib/personnel_intelligence_service/tools/errors";
export * from "@/lib/personnel_intelligence_service/tools/schemas";
export * from "@/lib/personnel_intelligence_service/tools/validator";
export * from "@/lib/personnel_intelligence_service/tools/permission_resolver";
export * from "@/lib/personnel_intelligence_service/tools/scope_resolver";
export * from "@/lib/personnel_intelligence_service/tools/output_validator";
export * from "@/lib/personnel_intelligence_service/tools/audit";
export * from "@/lib/personnel_intelligence_service/tools/result_count";
export * from "@/lib/personnel_intelligence_service/tools/registry";
export * from "@/lib/personnel_intelligence_service/tools/manifest";
export * from "@/lib/personnel_intelligence_service/tools/executor";
export { INTELLIGENCE_TOOL_DEFINITION_LIST } from "@/lib/personnel_intelligence_service/tools/definitions";
export {
  INTELLIGENCE_TOOL_DEFINITIONS,
  getIntelligenceToolContract,
} from "@/lib/personnel_intelligence_service/tools/compat_contracts";

/** @deprecated Prefer registry getIntelligenceToolDefinition for rich definitions. */
export { getIntelligenceToolContract as getLegacyIntelligenceToolDefinition } from "@/lib/personnel_intelligence_service/tools/compat_contracts";
