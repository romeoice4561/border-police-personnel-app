/**
 * Tool input validation entrypoints (Phase 49.6).
 */
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";
import type { IntelligenceToolDefinition } from "@/lib/personnel_intelligence_service/tools/types";

/**
 * Validates raw input against a tool's inputSchema.parse.
 * Does not mutate the input object (parsers read only).
 */
export function validateIntelligenceToolInput(
  definition: IntelligenceToolDefinition,
  raw: unknown
): unknown {
  try {
    return definition.inputSchema.parse(raw);
  } catch (error) {
    if (error instanceof IntelligenceToolError) throw error;
    throw new IntelligenceToolError(
      "INVALID_TOOL_INPUT",
      error instanceof Error ? error.message : "Invalid tool input"
    );
  }
}
