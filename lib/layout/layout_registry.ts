/**
 * LayoutRegistry
 *
 * In-memory registry of known templates: their identifiers, aliases,
 * versions, usage counts, and last-detected timestamps. This is the
 * authoritative lookup for "what templates does the system know about,"
 * consulted by TemplateDetector and FieldLocator.
 *
 * No persistence is implemented at this phase — see docs/LAYOUT_ENGINE.md
 * for the future persistence extension point (this registry is designed to
 * be backed by a real store later without changing its public interface).
 */

import type { LayoutCategory, TemplateDefinition, TemplateId } from "@/lib/layout/layout_types";

/** Contract for a template registry backend. Allows swapping in a persisted store later. */
export interface LayoutRegistryStore {
  get(templateId: TemplateId): TemplateDefinition | undefined;
  findByAlias(alias: string): TemplateDefinition | undefined;
  list(): TemplateDefinition[];
  register(definition: TemplateDefinition): void;
  recordDetection(templateId: TemplateId, detectedAt: string): void;
}

/**
 * In-memory implementation of the layout registry.
 *
 * Future extension point: back this with Supabase or another persistent
 * store in a later phase, behind the same `LayoutRegistryStore` interface.
 */
export class InMemoryLayoutRegistry implements LayoutRegistryStore {
  private readonly templates = new Map<TemplateId, TemplateDefinition>();
  private readonly aliasIndex = new Map<string, TemplateId>();

  get(templateId: TemplateId): TemplateDefinition | undefined {
    return this.templates.get(templateId);
  }

  findByAlias(alias: string): TemplateDefinition | undefined {
    const templateId = this.aliasIndex.get(alias);
    return templateId ? this.templates.get(templateId) : undefined;
  }

  list(): TemplateDefinition[] {
    return Array.from(this.templates.values());
  }

  register(definition: TemplateDefinition): void {
    this.templates.set(definition.template_id, definition);
    for (const alias of definition.aliases) {
      this.aliasIndex.set(alias, definition.template_id);
    }
  }

  recordDetection(templateId: TemplateId, detectedAt: string): void {
    const existing = this.templates.get(templateId);
    if (!existing) return;

    existing.usageCount += 1;
    existing.lastDetectedAt = detectedAt;
  }

  /** Returns all registered templates belonging to a given category. */
  listByCategory(category: LayoutCategory): TemplateDefinition[] {
    return this.list().filter((template) => template.category === category);
  }
}

/**
 * Seeds the registry with the baseline template set described in
 * docs/TEMPLATE_LIBRARY.md. Intended for local/dev bootstrapping only —
 * a future phase may load this from a persisted source instead.
 */
export function createDefaultLayoutRegistry(): InMemoryLayoutRegistry {
  const registry = new InMemoryLayoutRegistry();

  const seedTemplates: TemplateDefinition[] = [
    { template_id: "timeline_v1", category: "Timeline", version: "1", aliases: [], usageCount: 0 },
    { template_id: "timeline_v2", category: "Timeline", version: "2", aliases: [], usageCount: 0 },
    { template_id: "timeline_v3", category: "Timeline", version: "3", aliases: [], usageCount: 0 },
    { template_id: "profile_v1", category: "ProfileCard", version: "1", aliases: [], usageCount: 0 },
    { template_id: "history_v1", category: "HistoryCard", version: "1", aliases: [], usageCount: 0 },
    { template_id: "organization_v1", category: "OrganizationCard", version: "1", aliases: [], usageCount: 0 },
    { template_id: "unknown", category: "Unknown", version: "0", aliases: [], usageCount: 0 },
  ];

  for (const template of seedTemplates) {
    registry.register(template);
  }

  return registry;
}
