/**
 * Phase 49.5 legacy parameter-schema contracts derived from the registry.
 * Preserves INTELLIGENCE_TOOL_DEFINITIONS / getIntelligenceToolDefinition shape.
 */
import { EXECUTIVE_REPORT_TYPES } from "@/lib/commander_reports/types";
import { listIntelligenceToolDefinitions } from "@/lib/personnel_intelligence_service/tools/registry";
import type {
  IntelligenceToolContractDefinition,
  IntelligenceToolName,
  IntelligenceToolParameterSchema,
} from "@/lib/personnel_intelligence_service/tools/types";

function toParameterSchema(fields: IntelligenceToolContractDefinition["parameters"]): readonly IntelligenceToolParameterSchema[] {
  return fields;
}

function fieldsToParameters(
  fields: readonly { name: string; type: string; required?: boolean; description: string; enumValues?: readonly string[] }[]
): readonly IntelligenceToolParameterSchema[] {
  return fields
    .filter((f) => f.type !== "object")
    .map((f) => ({
      name: f.name,
      type: (f.type === "enum" || f.type === "string" || f.type === "number" || f.type === "boolean"
        ? f.type
        : "string") as IntelligenceToolParameterSchema["type"],
      ...(f.required ? { required: true } : {}),
      description: f.description,
      ...(f.enumValues ? { enumValues: f.enumValues } : {}),
    }));
}

/** Legacy Phase 49.5 tool contract list (parameter schemas for AI readiness). */
export const INTELLIGENCE_TOOL_DEFINITIONS: readonly IntelligenceToolContractDefinition[] =
  listIntelligenceToolDefinitions().map((def) => {
    let parameters = fieldsToParameters(def.inputSchema.fields);
    if (def.name === "get_report_projection") {
      parameters = toParameterSchema([
        {
          name: "type",
          type: "enum",
          required: true,
          enumValues: EXECUTIVE_REPORT_TYPES,
          description: "Executive report type id",
        },
        ...parameters.filter((p) => p.name !== "type" && p.name !== "reportType"),
      ]);
    }
    return {
      name: def.name,
      description: def.description.en,
      parameters,
    };
  });

/** @deprecated Prefer getIntelligenceToolDefinition from the registry for rich definitions. */
export function getIntelligenceToolContract(name: IntelligenceToolName): IntelligenceToolContractDefinition {
  const def = INTELLIGENCE_TOOL_DEFINITIONS.find((d) => d.name === name);
  if (!def) throw new Error(`Unknown intelligence tool: ${name}`);
  return def;
}

export type { IntelligenceToolContractDefinition, IntelligenceToolParameterSchema };
