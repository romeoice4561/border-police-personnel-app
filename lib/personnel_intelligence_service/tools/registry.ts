/**
 * Immutable canonical Intelligence Tool registry (Phase 49.6).
 *
 * Metadata + handlers only — never stores personnel data, actors, or secrets.
 */
import { INTELLIGENCE_TOOL_DEFINITION_LIST } from "@/lib/personnel_intelligence_service/tools/definitions";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";
import {
  INTELLIGENCE_TOOL_NAMES,
  type IntelligenceToolDefinition,
  type IntelligenceToolName,
} from "@/lib/personnel_intelligence_service/tools/types";

function buildRegistry(): ReadonlyMap<IntelligenceToolName, IntelligenceToolDefinition> {
  const map = new Map<IntelligenceToolName, IntelligenceToolDefinition>();
  for (const def of INTELLIGENCE_TOOL_DEFINITION_LIST) {
    if (map.has(def.name)) {
      throw new Error(`Duplicate intelligence tool registration: ${def.name}`);
    }
    if (!def.readOnly) {
      throw new Error(`Intelligence tool must be read-only: ${def.name}`);
    }
    map.set(def.name, Object.freeze({ ...def, title: { ...def.title }, description: { ...def.description } }));
  }
  if (map.size !== INTELLIGENCE_TOOL_NAMES.length) {
    throw new Error(
      `Expected ${INTELLIGENCE_TOOL_NAMES.length} tools, registered ${map.size}`
    );
  }
  for (const name of INTELLIGENCE_TOOL_NAMES) {
    if (!map.has(name)) {
      throw new Error(`Missing canonical tool: ${name}`);
    }
  }
  return map;
}

const REGISTRY: ReadonlyMap<IntelligenceToolName, IntelligenceToolDefinition> = buildRegistry();

/**
 * Snapshot of the registry map (metadata + handlers).
 * Returns a copy so callers cannot mutate the canonical registry.
 */
export function getIntelligenceToolRegistry(): ReadonlyMap<IntelligenceToolName, IntelligenceToolDefinition> {
  return new Map(REGISTRY);
}

export function hasIntelligenceTool(name: string): name is IntelligenceToolName {
  return REGISTRY.has(name as IntelligenceToolName);
}

export function getIntelligenceToolDefinition(name: string): IntelligenceToolDefinition {
  const def = REGISTRY.get(name as IntelligenceToolName);
  if (!def) {
    throw new IntelligenceToolError("TOOL_NOT_FOUND", `Unknown intelligence tool: ${name}`);
  }
  return def;
}

export function listIntelligenceToolDefinitions(): readonly IntelligenceToolDefinition[] {
  return INTELLIGENCE_TOOL_NAMES.map((name) => REGISTRY.get(name)!);
}
