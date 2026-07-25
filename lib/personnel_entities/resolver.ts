/**
 * Personnel Entity Resolver — public entry point (Phase 51.1A).
 *
 * Telegram / LINE / Web / Assistant → resolvePersonnelEntities → Gateway.
 */
import type {
  EntityResolutionResult,
  PersonnelSearchConversationContext,
  ResolvedEntity,
} from "@/lib/personnel_entities/contracts";
import { applyConversationContext, conversationFromOrganization } from "@/lib/personnel_entities/context";
import { resolveAcademyClassHint } from "@/lib/personnel_entities/academy_resolver";
import { resolveNicknameHint } from "@/lib/personnel_entities/nickname_resolver";
import { resolveOfficerIdHint } from "@/lib/personnel_entities/person_resolver";
import {
  buildOrgEntityCatalog,
  lookupOrgByPublicCode,
  type OrgEntityCatalog,
} from "@/lib/personnel_entities/organization";
import { resolveOrganizationEntities } from "@/lib/personnel_entities/unit_resolver";
import type { OrgTree } from "@/lib/organization/org_tree";
import type { OrganizationEntityType } from "@/lib/personnel_entities/types";
import type { OrgEntityRecord } from "@/lib/personnel_entities/contracts";

export interface ResolvePersonnelEntitiesOptions {
  organizationTree?: OrgTree | null;
  /** Pre-built catalog (tests / callers that already built one). */
  catalog?: OrgEntityCatalog;
  conversationContext?: PersonnelSearchConversationContext | null;
}

function recordToResolved(record: OrgEntityRecord): ResolvedEntity {
  return {
    type: record.type,
    canonicalId: `${record.type}:${record.internalId}`,
    publicCode: record.publicCode,
    displayName: record.displayName,
    aliases: record.aliases,
    confidence: "exact",
    matchedText: record.publicCode,
    remainingQuery: "",
    internalNumericId: record.internalId,
  };
}

function pickPrimaryOrganization(entities: ResolvedEntity[]): ResolvedEntity | null {
  const rank: Partial<Record<ResolvedEntity["type"], number>> = {
    company: 3,
    division: 2,
    region: 1,
  };
  let best: ResolvedEntity | null = null;
  let bestRank = 0;
  for (const entity of entities) {
    const r = rank[entity.type] ?? 0;
    if (r > bestRank) {
      best = entity;
      bestRank = r;
    }
  }
  return best;
}

/**
 * Resolve human language into canonical entities before Gateway search.
 * Does not perform officer ranking or permission filtering.
 */
export function resolvePersonnelEntities(
  query: string,
  options: ResolvePersonnelEntitiesOptions = {}
): EntityResolutionResult {
  const catalog = options.catalog ?? buildOrgEntityCatalog(options.organizationTree);
  const q = query.replace(/\s+/g, " ").trim();
  const entities: ResolvedEntity[] = [];

  const { matches: orgMatches, ambiguous } = resolveOrganizationEntities(q, catalog);

  if (ambiguous.length > 1) {
    const candidates = ambiguous.map(recordToResolved);
    return {
      primaryOrganization: null,
      entities: candidates,
      clarification: {
        reasonTh: `พบหน่วยงานหลายรายการที่ตรงกับ "${q}" — โปรดระบุให้ชัดเจน`,
        reasonEn: `Multiple organization matches for "${q}" — please refine`,
        suggestionsTh: candidates.map(
          (c, i) => `${i + 1}. ${c.displayName}${c.publicCode ? ` (${c.publicCode})` : ""}`
        ),
        candidates,
      },
      conversationContext: options.conversationContext ?? null,
    };
  }

  entities.push(...orgMatches);

  const officer = resolveOfficerIdHint(q);
  if (officer) entities.push(officer);

  const academy = resolveAcademyClassHint(q);
  if (academy) entities.push(academy);

  const nickname = resolveNicknameHint(q);
  if (nickname) entities.push(nickname);

  const primaryOrganization = pickPrimaryOrganization(entities);

  const base: EntityResolutionResult = {
    primaryOrganization,
    entities,
    clarification: null,
    conversationContext: conversationFromOrganization(primaryOrganization),
  };

  return applyConversationContext(base, options.conversationContext, (type, publicCode) => {
    const record = lookupOrgByPublicCode(catalog, type as OrganizationEntityType, publicCode);
    return record ? recordToResolved(record) : null;
  });
}

export { buildOrgEntityCatalog };
