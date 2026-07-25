/**
 * Entity Resolution contracts (Phase 51.1A).
 * Clients consume ResolvedEntity; only repositories use internal numeric FKs.
 */
import type {
  EntityMatchConfidence,
  OrganizationEntityType,
  PersonnelEntityType,
} from "@/lib/personnel_entities/types";

/**
 * Canonical resolved entity — the only shape Search Gateway should consume
 * for organization / named-entity matching.
 */
export interface ResolvedEntity {
  type: PersonnelEntityType;
  /**
   * Opaque canonical key, e.g. "company:57" (internal) or "officer:ภาค4/20".
   * Not for end-user display.
   */
  canonicalId: string;
  /** Human / public code when applicable (e.g. "414", "41", "4"). */
  publicCode: string | null;
  displayName: string;
  aliases: readonly string[];
  confidence: EntityMatchConfidence;
  matchedText: string;
  /** Query text with the matched span removed (trimmed). */
  remainingQuery: string;
  /**
   * Internal numeric FK for in-memory CommanderQueryOfficer matching only.
   * Never serialize to Telegram / LINE / public clients.
   */
  internalNumericId?: number;
}

export interface EntityClarification {
  reasonTh: string;
  reasonEn: string;
  suggestionsTh: string[];
  candidates: ResolvedEntity[];
}

/**
 * Optional conversation / session scope (contracts only — not persisted in 51.1A).
 * Example: prior unit "414" scopes a later "พร้อมเลื่อน" query.
 */
export interface PersonnelSearchConversationContext {
  organization?: {
    type: OrganizationEntityType;
    publicCode: string;
    displayName: string;
    /** Opaque canonical id (e.g. company:57). */
    canonicalId: string;
  };
  /** ISO timestamp of last context update — unused until persistence exists. */
  updatedAtIso?: string;
}

export interface EntityResolutionResult {
  /** Most specific organization entity (company > division > region). */
  primaryOrganization: ResolvedEntity | null;
  entities: ResolvedEntity[];
  clarification: EntityClarification | null;
  /** Effective conversation context after this resolution (still not persisted). */
  conversationContext: PersonnelSearchConversationContext | null;
}

/** Catalog entry for one organization node. */
export interface OrgEntityRecord {
  type: OrganizationEntityType;
  internalId: number;
  publicCode: string;
  displayName: string;
  aliases: readonly string[];
  parentInternalId?: number | null;
}
