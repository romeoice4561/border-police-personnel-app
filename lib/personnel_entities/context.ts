/**
 * Conversation / search-context helpers (Phase 51.1A).
 * Contracts are reusable; persistence is intentionally out of scope.
 */
import type {
  EntityResolutionResult,
  PersonnelSearchConversationContext,
  ResolvedEntity,
} from "@/lib/personnel_entities/contracts";
import type { OrganizationEntityType } from "@/lib/personnel_entities/types";

export function conversationFromOrganization(
  entity: ResolvedEntity | null
): PersonnelSearchConversationContext | null {
  if (!entity) return null;
  if (entity.type !== "region" && entity.type !== "division" && entity.type !== "company") {
    return null;
  }
  if (!entity.publicCode) return null;
  return {
    organization: {
      type: entity.type as OrganizationEntityType,
      publicCode: entity.publicCode,
      displayName: entity.displayName,
      canonicalId: entity.canonicalId,
    },
  };
}

/**
 * When the current query has no organization entity, inherit prior conversation scope.
 * When it does, replace the context (never merge conflicting orgs).
 */
export function applyConversationContext(
  resolution: EntityResolutionResult,
  prior: PersonnelSearchConversationContext | null | undefined,
  catalogLookup: (type: OrganizationEntityType, publicCode: string) => ResolvedEntity | null
): EntityResolutionResult {
  if (resolution.primaryOrganization) {
    return {
      ...resolution,
      conversationContext: conversationFromOrganization(resolution.primaryOrganization),
    };
  }

  if (resolution.clarification) {
    return { ...resolution, conversationContext: prior ?? null };
  }

  const org = prior?.organization;
  if (!org) {
    return { ...resolution, conversationContext: prior ?? null };
  }

  const inherited = catalogLookup(org.type, org.publicCode);
  if (!inherited) {
    return { ...resolution, conversationContext: prior ?? null };
  }

  return {
    ...resolution,
    primaryOrganization: {
      ...inherited,
      confidence: "context",
      matchedText: org.publicCode,
      remainingQuery: resolution.entities[0]?.remainingQuery ?? "",
    },
    entities: [
      {
        ...inherited,
        confidence: "context",
        matchedText: org.publicCode,
        remainingQuery: "",
      },
      ...resolution.entities,
    ],
    conversationContext: prior ?? conversationFromOrganization(inherited),
  };
}
