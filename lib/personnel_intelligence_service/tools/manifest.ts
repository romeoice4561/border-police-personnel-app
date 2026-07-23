/**
 * Serializable tool manifest for Phase 50 model/tool registration (Phase 49.6).
 * Excludes handlers, auth functions, and service internals.
 */
import { listIntelligenceToolDefinitions } from "@/lib/personnel_intelligence_service/tools/registry";
import type { IntelligenceToolManifestEntry } from "@/lib/personnel_intelligence_service/tools/types";

export function getIntelligenceToolManifest(): readonly IntelligenceToolManifestEntry[] {
  return listIntelligenceToolDefinitions().map((def) => ({
    name: def.name,
    version: def.version,
    category: def.category,
    title: { th: def.title.th, en: def.title.en },
    description: { th: def.description.th, en: def.description.en },
    capability: def.capability,
    readOnly: true as const,
    riskLevel: def.riskLevel,
    inputDescription: def.inputSchema.fields.map((f) => ({ ...f })),
    exampleInputs: def.exampleInputs.map((example) =>
      example && typeof example === "object" ? { ...(example as object) } : example
    ),
  }));
}
