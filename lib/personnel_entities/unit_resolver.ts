/**
 * Organization unit resolution — public codes / aliases → OrgEntityRecord.
 */
import { normalizeUnitQuery } from "@/lib/personnel_search/normalizer";
import type { OrgEntityRecord, ResolvedEntity } from "@/lib/personnel_entities/contracts";
import type { EntityMatchConfidence } from "@/lib/personnel_entities/types";
import {
  lookupOrgByAlias,
  lookupOrgByPublicCode,
  preferMostSpecificOrg,
  type OrgEntityCatalog,
} from "@/lib/personnel_entities/organization";

function toResolved(
  record: OrgEntityRecord,
  matchedText: string,
  remainingQuery: string,
  confidence: EntityMatchConfidence
): ResolvedEntity {
  return {
    type: record.type,
    canonicalId: `${record.type}:${record.internalId}`,
    publicCode: record.publicCode,
    displayName: record.displayName,
    aliases: record.aliases,
    confidence,
    matchedText,
    remainingQuery,
    internalNumericId: record.internalId,
  };
}

function stripMatchedSpan(query: string, matched: string): string {
  const q = query.replace(/\s+/g, " ").trim();
  const m = matched.replace(/\s+/g, " ").trim();
  if (!m) return q;
  const idx = q.toLowerCase().indexOf(m.toLowerCase());
  if (idx >= 0) {
    return `${q.slice(0, idx)} ${q.slice(idx + m.length)}`.replace(/\s+/g, " ").trim();
  }
  // Fallback: remove digit cluster / normalized unit token
  return q.replace(m, " ").replace(/\s+/g, " ").trim();
}

/**
 * Resolve organization entities from a human query.
 * Never treats public codes as internal FKs.
 */
export function resolveOrganizationEntities(
  query: string,
  catalog: OrgEntityCatalog
): { matches: ResolvedEntity[]; ambiguous: OrgEntityRecord[] } {
  const q = query.replace(/\s+/g, " ").trim();
  if (!q || catalog.records.length === 0) {
    return { matches: [], ambiguous: [] };
  }

  const matches: ResolvedEntity[] = [];
  const ambiguous: OrgEntityRecord[] = [];

  // 1) Structured unit parse (ร้อย414 / กก41 / ภาค4) → public code lookup
  const unitRef = normalizeUnitQuery(q);
  if (unitRef?.number != null) {
    const publicCode = String(unitRef.number);
    const record = lookupOrgByPublicCode(catalog, unitRef.level, publicCode);
    if (record) {
      matches.push(
        toResolved(record, q, stripMatchedSpan(q, String(unitRef.number)), "exact")
      );
      return { matches, ambiguous };
    }
  }

  // 2) Full-query alias index
  const aliasHits = preferMostSpecificOrg(lookupOrgByAlias(catalog, q));
  if (aliasHits.length === 1) {
    matches.push(toResolved(aliasHits[0], q, "", "alias"));
    return { matches, ambiguous };
  }
  if (aliasHits.length > 1) {
    return { matches: [], ambiguous: aliasHits };
  }

  // 3) Bare public-code tokens inside a longer query (e.g. "... ใน กก.ตชด.41")
  const tokenCandidates = extractOrgTokens(q);
  for (const token of tokenCandidates) {
    const unit = normalizeUnitQuery(token);
    if (unit?.number != null) {
      const record = lookupOrgByPublicCode(catalog, unit.level, String(unit.number));
      if (record) {
        matches.push(toResolved(record, token, stripMatchedSpan(q, token), "exact"));
        break;
      }
    }
    const hits = preferMostSpecificOrg(lookupOrgByAlias(catalog, token));
    if (hits.length === 1) {
      matches.push(toResolved(hits[0], token, stripMatchedSpan(q, token), "alias"));
      break;
    }
    if (hits.length > 1) {
      return { matches: [], ambiguous: hits };
    }
  }

  return { matches, ambiguous };
}

function extractOrgTokens(query: string): string[] {
  const tokens: string[] = [];
  const patterns = [
    /กองร้อย\s*ตชด\.?\s*\d{3,4}/gi,
    /ร้อย\s*ตชด\.?\s*\d{3,4}/gi,
    /ตชด\.?\s*\d{3,4}/gi,
    /ร้อย\s*\d{3,4}/gi,
    /กองร้อย\s*\d{3,4}/gi,
    /กก\.?\s*ตชด\.?\s*\d{1,3}/gi,
    /กองกำกับ(?:การ)?\s*\d{1,3}/gi,
    /กก\.?\s*\d{1,3}/gi,
    /ภาค\s*\d{1,2}/gi,
    /region\s*\d{1,2}/gi,
    /\b\d{3,4}\b/g,
    /\b\d{1,2}\b/g,
  ];
  for (const re of patterns) {
    const found = query.match(re);
    if (found) tokens.push(...found);
  }
  return [...new Set(tokens.map((t) => t.trim()).filter(Boolean))];
}
