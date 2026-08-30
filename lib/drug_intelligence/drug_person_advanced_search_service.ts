/**
 * DrugPersonAdvancedSearchService (Phase DI-7.4).
 *
 * Multi-criteria person search: text (name/alias/identifier/phone),
 * demographic filters, network filters, and case-history filters — all
 * combined via ID intersection so each filter narrows the candidate set
 * rather than being ORed together. Designed for an analyst who has a
 * partial description (approximate age, network role, province) and needs to
 * find matching records. Join data is loaded ONCE up front (not per-person)
 * to avoid the N+1 pattern flagged in DrugPersonDirectoryService.
 *
 * Read-only — no writes, no audit side-effects.
 */

import type {
  DatabaseClient,
  DrugPerson,
  DrugPersonAlias,
  DrugPersonIdentifier,
  DrugPersonNetworkRole,
  DrugPersonNetworkMembership,
  DrugNetworkGroup,
  DrugCasePerson,
  DrugCase,
  DrugCasePhone,
  DrugPhoneNumber,
} from "@/lib/database/database_types";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { DrugPersonRepository } from "@/lib/database/repositories/drug_person_repository";
import { maskIdentifierValue, maskPhoneNumber } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";

// ── Public interfaces ──────────────────────────────────────────────────────

export interface DrugPersonSearchMatchedField {
  field: "NAME" | "NICKNAME" | "ALIAS" | "IDENTIFIER" | "PHONE";
  matchType: "EXACT" | "PREFIX" | "PARTIAL";
  /** Sensitive values (identifier, phone) are always masked here; name/alias shown as-is. */
  maskedValue: string;
}

export interface DrugPersonAdvancedSearchQuery {
  // Text search (name, nickname, alias, identifier, phone)
  query?: string;

  // Basic person filters
  sex?: string;
  nationality?: string;
  ageMin?: number;
  ageMax?: number;

  // Network filters
  networkGroupIds?: string[];
  networkRoles?: string[];
  networkRoleSources?: string[];
  verificationStatuses?: string[];

  // Case history
  caseRoles?: string[];
  minCaseCount?: number;
  dateFrom?: Date;
  dateTo?: Date;
  province?: string;
  battalionId?: number;
  companyId?: number;

  // Pagination + sort
  sort?: "RELEVANCE" | "NAME_ASC" | "CASE_COUNT_DESC" | "LAST_SEEN_DESC" | "AGE_ASC" | "AGE_DESC";
  page?: number;
  pageSize?: number;
}

export interface DrugPersonAdvancedSearchResult {
  id: string;
  primaryFullName: string;
  nickname: string | null;
  sex: string | null;
  nationality: string | null;
  dateOfBirth: Date | null;
  approximateAge: number | null;
  /** Calculated age: from dateOfBirth if available, else approximateAge, else null. */
  displayAge: number | null;
  /** True when displayAge is derived from approximateAge, not an exact DOB calculation. */
  isAgeApproximate: boolean;
  status: string;
  /** First two secondary (isPrimary=false) aliases. */
  aliases: string[];
  /** Count of all secondary aliases. */
  aliasCount: number;
  identifierPreview: { type: string; value: string } | null;
  caseCount: number;
  phoneCount: number;
  /** Up to 3 distinct role values from DrugPersonNetworkRole. */
  networkRoleSummary: string[];
  /** Up to 3 network groups this person belongs to, with resolved names. */
  networkGroups: { id: string; name: string }[];
  firstSeenAt: Date;
  lastSeenAt: Date;
  hasPotentialDuplicate: boolean;
  /**
   * When hasPotentialDuplicate is true, the ID of the FIRST candidate pair.
   * Use with the person's own id to build ?a=&b= for the DI-2 compare page.
   * Null when no pair is found (e.g. reviewed as NOT_SAME, or no matches).
   */
  potentialDuplicateCandidateId: string | null;
  matchedFields: DrugPersonSearchMatchedField[];
}

// ── Private helpers ────────────────────────────────────────────────────────

/** Groups an array by the result of a key-extractor function. */
function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = getKey(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Determines match type (EXACT, PREFIX, PARTIAL) for a value against a
 * lower-case query string. Returns null when there is no match.
 */
function matchType(value: string, lowerQuery: string): "EXACT" | "PREFIX" | "PARTIAL" | null {
  const v = value.toLowerCase();
  if (v === lowerQuery) return "EXACT";
  if (v.startsWith(lowerQuery)) return "PREFIX";
  if (v.includes(lowerQuery)) return "PARTIAL";
  return null;
}

/** Match-type to relevance tier (lower = better). */
const MATCH_TIER: Record<"EXACT" | "PREFIX" | "PARTIAL", number> = {
  EXACT: 0,
  PREFIX: 1,
  PARTIAL: 2,
};

/**
 * Calculates a person's display age. Exact when DOB is known; approximate
 * otherwise. Matches the spec's algorithm verbatim so age-range filtering
 * and the displayed age use the same value.
 */
function calculateDisplayAge(
  dateOfBirth: Date | null,
  approximateAge: number | null
): { age: number | null; isApproximate: boolean } {
  if (dateOfBirth) {
    const now = new Date();
    const age =
      now.getFullYear() -
      dateOfBirth.getFullYear() -
      (now < new Date(now.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate()) ? 1 : 0);
    return { age, isApproximate: false };
  }
  if (approximateAge !== null) return { age: approximateAge, isApproximate: true };
  return { age: null, isApproximate: false };
}

// ── Service ────────────────────────────────────────────────────────────────

export class DrugPersonAdvancedSearchService {
  private readonly matchingService: DrugPersonMatchingService;
  private readonly personRepo: DrugPersonRepository;

  constructor(private readonly db: DatabaseClient) {
    this.matchingService = new DrugPersonMatchingService(db);
    this.personRepo = new DrugPersonRepository(db);
  }

  async search(
    query: DrugPersonAdvancedSearchQuery,
    actorId?: string // reserved for future audit logging; not called in this read-only service
  ): Promise<{
    items: DrugPersonAdvancedSearchResult[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    void actorId; // reserved for future audit logging in this read-only service
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const sort = query.sort ?? "RELEVANCE";

    // ── Step 1: ACTIVE persons with DB-side sex filter when present (DI-9.4.3B)
    const personWhere: Record<string, unknown> = { status: "ACTIVE" };
    if (query.sex) personWhere.sex = query.sex;
    let candidates = (await this.db.drugPerson.findMany({ where: personWhere })) as DrugPerson[];

    // ── Step 2: remaining direct-column filters ─────────────────────────
    if (query.nationality) {
      const normNat = query.nationality.trim().toLowerCase();
      candidates = candidates.filter((p) => p.nationality?.toLowerCase().includes(normNat));
    }

    const hasAgeFilter = query.ageMin !== undefined || query.ageMax !== undefined;
    if (hasAgeFilter) {
      candidates = candidates.filter((p) => {
        const { age } = calculateDisplayAge(
          (p as { dateOfBirth: Date | null }).dateOfBirth,
          (p as { approximateAge: number | null }).approximateAge
        );
        if (age === null) return false;
        if (query.ageMin !== undefined && age < query.ageMin) return false;
        if (query.ageMax !== undefined && age > query.ageMax) return false;
        return true;
      });
    }

    // Optional text prefilter via DB contains → shrink candidate id set before join loads.
    const textQuery = query.query?.trim() ?? "";
    if (textQuery) {
      const matchedIds = new Set(await this.personRepo.findActiveIdsMatchingQuery(textQuery));
      // Also keep nickname matches (not covered by findActiveIdsMatchingQuery).
      for (const p of candidates) {
        const nick = (p as { nickname?: string | null }).nickname;
        if (nick && nick.toLowerCase().includes(textQuery.toLowerCase())) matchedIds.add(p.id);
      }
      candidates = candidates.filter((p) => matchedIds.has(p.id));
    }

    const candidateIds = candidates.map((p) => p.id);

    // ── Step 3: batch-load join data for CANDIDATES only (not whole tables)
    const empty = candidateIds.length === 0;
    const [
      allAliasRows,
      allIdentifierRows,
      allNetworkRoleRows,
      allMembershipRows,
      allCasePersonRows,
      allCasePhoneRows,
    ] = empty
      ? [[], [], [], [], [], []]
      : await Promise.all([
          this.db.drugPersonAlias.findMany({ where: { personId: { in: candidateIds } } }) as Promise<DrugPersonAlias[]>,
          this.db.drugPersonIdentifier.findMany({ where: { personId: { in: candidateIds } } }) as Promise<DrugPersonIdentifier[]>,
          this.db.drugPersonNetworkRole.findMany({ where: { personId: { in: candidateIds } } }) as Promise<DrugPersonNetworkRole[]>,
          this.db.drugPersonNetworkMembership.findMany({ where: { personId: { in: candidateIds } } }) as Promise<DrugPersonNetworkMembership[]>,
          this.db.drugCasePerson.findMany({ where: { personId: { in: candidateIds } } }) as Promise<DrugCasePerson[]>,
          this.db.drugCasePhone.findMany({ where: { personId: { in: candidateIds } } }) as Promise<DrugCasePhone[]>,
        ]);

    const caseIdsNeeded = [...new Set((allCasePersonRows as DrugCasePerson[]).map((r) => r.caseId))];
    const phoneIdsNeeded = [...new Set((allCasePhoneRows as DrugCasePhone[]).map((r) => r.phoneNumberId))];
    const [allCaseRows, allPhoneNumberRows] = empty
      ? [[], []]
      : await Promise.all([
          caseIdsNeeded.length
            ? (this.db.drugCase.findMany({ where: { id: { in: caseIdsNeeded } } }) as Promise<DrugCase[]>)
            : Promise.resolve([] as DrugCase[]),
          phoneIdsNeeded.length
            ? (this.db.drugPhoneNumber.findMany({ where: { id: { in: phoneIdsNeeded } } }) as Promise<DrugPhoneNumber[]>)
            : Promise.resolve([] as DrugPhoneNumber[]),
        ]);

    const aliasesByPerson = groupBy(allAliasRows, (a) => a.personId);
    const identifiersByPerson = groupBy(allIdentifierRows, (i) => i.personId);
    const networkRolesByPerson = groupBy(allNetworkRoleRows, (r) => r.personId);
    const membershipsByPerson = groupBy(allMembershipRows, (m) => m.personId);
    const casePersonsByPerson = groupBy(allCasePersonRows, (cp) => cp.personId);
    const casePhonesByPerson = groupBy(allCasePhoneRows, (cp) => cp.personId);
    const casesById = new Map(allCaseRows.map((c) => [c.id, c]));
    const phoneNumbersById = new Map(allPhoneNumberRows.map((p) => [p.id, p]));

    // Batch-load all DrugNetworkGroup rows once to resolve group names.
    const allGroupRows = (await this.db.drugNetworkGroup.findMany({})) as DrugNetworkGroup[];
    const groupNameMap = new Map(allGroupRows.map((g) => [g.id, g.name]));

    // ── Step 4: text query — filter candidates and track matchedFields ────
    const matchedFieldsMap = new Map<string, DrugPersonSearchMatchedField[]>();
    const matchTierMap = new Map<string, number>(); // 0=EXACT, 1=PREFIX, 2=PARTIAL, 3=FILTER_ONLY

    const normalizedQuery = query.query?.trim().toLowerCase() ?? "";
    const normalizedPhoneQuery = normalizedQuery ? normalizePhoneMatchingKey(query.query!.trim()) : "";

    if (normalizedQuery) {
      const textMatchedIds = new Set<string>();

      for (const person of candidates) {
        const matchedFields: DrugPersonSearchMatchedField[] = [];
        let bestTier = 3;

        // Primary name
        const nameHit = matchType(person.primaryFullName, normalizedQuery);
        if (nameHit) {
          matchedFields.push({ field: "NAME", matchType: nameHit, maskedValue: person.primaryFullName });
          bestTier = Math.min(bestTier, MATCH_TIER[nameHit]);
        }

        // Nickname
        const personNickname = (person as { nickname?: string | null }).nickname;
        if (personNickname) {
          const nickHit = matchType(personNickname, normalizedQuery);
          if (nickHit) {
            matchedFields.push({ field: "NICKNAME", matchType: nickHit, maskedValue: personNickname });
            bestTier = Math.min(bestTier, MATCH_TIER[nickHit]);
          }
        }

        // Aliases (only record the first matching alias to avoid duplicating)
        const aliases = aliasesByPerson.get(person.id) ?? [];
        for (const alias of aliases) {
          const aliasHit = matchType(alias.fullName, normalizedQuery);
          if (aliasHit) {
            matchedFields.push({ field: "ALIAS", matchType: aliasHit, maskedValue: alias.fullName });
            bestTier = Math.min(bestTier, MATCH_TIER[aliasHit]);
            break;
          }
        }

        // Identifiers (only first match)
        const identifiers = identifiersByPerson.get(person.id) ?? [];
        for (const identifier of identifiers) {
          const idHit = matchType(identifier.value, normalizedQuery);
          if (idHit) {
            matchedFields.push({ field: "IDENTIFIER", matchType: idHit, maskedValue: maskIdentifierValue(identifier.value) });
            bestTier = Math.min(bestTier, MATCH_TIER[idHit]);
            break;
          }
        }

        // Phone numbers (only first match)
        if (normalizedPhoneQuery) {
          const casePhones = casePhonesByPerson.get(person.id) ?? [];
          for (const link of casePhones) {
            const phone = phoneNumbersById.get(link.phoneNumberId);
            if (phone && phone.normalizedNumber.includes(normalizedPhoneQuery)) {
              matchedFields.push({ field: "PHONE", matchType: "PARTIAL", maskedValue: maskPhoneNumber(phone.normalizedNumber) });
              bestTier = Math.min(bestTier, MATCH_TIER["PARTIAL"]);
              break;
            }
          }
        }

        if (matchedFields.length > 0) {
          textMatchedIds.add(person.id);
          matchedFieldsMap.set(person.id, matchedFields);
          matchTierMap.set(person.id, bestTier);
        }
      }

      candidates = candidates.filter((p) => textMatchedIds.has(p.id));
    } else {
      // No text query: every candidate is a filter-only match
      for (const person of candidates) {
        matchedFieldsMap.set(person.id, []);
        matchTierMap.set(person.id, 3);
      }
    }

    // ── Step 5: join-based filters (ID intersection) ─────────────────────

    // Network group membership
    if (query.networkGroupIds && query.networkGroupIds.length > 0) {
      const groupIdSet = new Set(query.networkGroupIds);
      candidates = candidates.filter((p) => {
        const memberships = membershipsByPerson.get(p.id) ?? [];
        return memberships.some((m) => groupIdSet.has(m.networkGroupId));
      });
    }

    // Network role values
    if (query.networkRoles && query.networkRoles.length > 0) {
      const roleSet = new Set(query.networkRoles);
      candidates = candidates.filter((p) => {
        const roles = networkRolesByPerson.get(p.id) ?? [];
        return roles.some((r) => roleSet.has(r.role));
      });
    }

    // Network role sources
    if (query.networkRoleSources && query.networkRoleSources.length > 0) {
      const sourceSet = new Set(query.networkRoleSources);
      candidates = candidates.filter((p) => {
        const roles = networkRolesByPerson.get(p.id) ?? [];
        return roles.some((r) => {
          const src = (r as { source?: string | null }).source;
          return src != null && sourceSet.has(src);
        });
      });
    }

    // Network role verification statuses
    if (query.verificationStatuses && query.verificationStatuses.length > 0) {
      const statusSet = new Set(query.verificationStatuses);
      candidates = candidates.filter((p) => {
        const roles = networkRolesByPerson.get(p.id) ?? [];
        return roles.some((r) => statusSet.has(r.verificationStatus));
      });
    }

    // Case-history filters (applied together for efficiency)
    const hasCaseFilter =
      (query.caseRoles && query.caseRoles.length > 0) ||
      query.minCaseCount !== undefined ||
      query.dateFrom !== undefined ||
      query.dateTo !== undefined ||
      query.province !== undefined ||
      query.battalionId !== undefined ||
      query.companyId !== undefined;

    if (hasCaseFilter) {
      const caseRoleSet = query.caseRoles && query.caseRoles.length > 0 ? new Set(query.caseRoles) : null;
      const hasCasePropertyFilter =
        query.dateFrom !== undefined ||
        query.dateTo !== undefined ||
        query.province !== undefined ||
        query.battalionId !== undefined ||
        query.companyId !== undefined;
      const normProvince = query.province?.trim().toLowerCase();

      candidates = candidates.filter((p) => {
        const caseLinks = casePersonsByPerson.get(p.id) ?? [];

        // Apply role filter
        let filtered = caseRoleSet ? caseLinks.filter((cl) => caseRoleSet.has(cl.role)) : caseLinks;

        // Apply case property filters (province, battalion, company, date range)
        if (hasCasePropertyFilter) {
          filtered = filtered.filter((cl) => {
            const c = casesById.get(cl.caseId);
            if (!c) return false;
            const cCase = c as {
              province?: string | null;
              battalionId?: number | null;
              companyId?: number | null;
              arrestDate?: Date | null;
            };
            if (normProvince && cCase.province?.toLowerCase() !== normProvince) return false;
            if (query.battalionId !== undefined && cCase.battalionId !== query.battalionId) return false;
            if (query.companyId !== undefined && cCase.companyId !== query.companyId) return false;
            if (query.dateFrom && cCase.arrestDate && cCase.arrestDate < query.dateFrom) return false;
            if (query.dateTo && cCase.arrestDate && cCase.arrestDate > query.dateTo) return false;
            return true;
          });
        }

        // Minimum case count (at least 1 when any case filter is active)
        const required = query.minCaseCount ?? 1;
        return filtered.length >= required;
      });
    }

    // ── Step 6: potential duplicate detection (computed once per request) ─
    // Use findDuplicatePairFirstCandidateMap() so we get both the Set-like
    // membership (map.has) AND the first candidate ID for direct DI-2 links.
    const duplicatePairMap = await this.matchingService.findDuplicatePairFirstCandidateMap();

    // ── Step 7: build result objects ──────────────────────────────────────
    type ResultWithTier = DrugPersonAdvancedSearchResult & { _tier: number };

    const results: ResultWithTier[] = candidates.map((person) => {
      const typedPerson = person as DrugPerson & {
        nickname?: string | null;
        sex?: string | null;
        nationality?: string | null;
        dateOfBirth?: Date | null;
        approximateAge?: number | null;
      };

      const aliases = aliasesByPerson.get(person.id) ?? [];
      const identifiers = identifiersByPerson.get(person.id) ?? [];
      const networkRoles = networkRolesByPerson.get(person.id) ?? [];
      const memberships = membershipsByPerson.get(person.id) ?? [];
      const caseLinks = casePersonsByPerson.get(person.id) ?? [];
      const phoneLinks = casePhonesByPerson.get(person.id) ?? [];

      const secondaryAliases = aliases.filter((a) => !a.isPrimary);
      const { age: displayAge, isApproximate: isAgeApproximate } = calculateDisplayAge(
        typedPerson.dateOfBirth ?? null,
        typedPerson.approximateAge ?? null
      );

      const identifierPreview = identifiers.length > 0 ? { type: identifiers[0].type, value: identifiers[0].value } : null;

      const distinctRoles = [...new Set(networkRoles.map((r) => r.role))].slice(0, 3);
      const seenGroupIds = new Set<string>();
      const resolvedGroups: { id: string; name: string }[] = [];
      for (const m of memberships) {
        if (!seenGroupIds.has(m.networkGroupId)) {
          seenGroupIds.add(m.networkGroupId);
          resolvedGroups.push({ id: m.networkGroupId, name: groupNameMap.get(m.networkGroupId) ?? m.networkGroupId });
          if (resolvedGroups.length === 3) break;
        }
      }

      return {
        id: person.id,
        primaryFullName: person.primaryFullName,
        nickname: typedPerson.nickname ?? null,
        sex: typedPerson.sex ?? null,
        nationality: typedPerson.nationality ?? null,
        dateOfBirth: typedPerson.dateOfBirth ?? null,
        approximateAge: typedPerson.approximateAge ?? null,
        displayAge,
        isAgeApproximate,
        status: person.status,
        aliases: secondaryAliases.slice(0, 2).map((a) => a.fullName),
        aliasCount: secondaryAliases.length,
        identifierPreview,
        caseCount: caseLinks.length,
        phoneCount: phoneLinks.length,
        networkRoleSummary: distinctRoles,
        networkGroups: resolvedGroups,
        firstSeenAt: person.createdAt,
        lastSeenAt: person.updatedAt,
        hasPotentialDuplicate: duplicatePairMap.has(person.id),
        potentialDuplicateCandidateId: duplicatePairMap.get(person.id) ?? null,
        matchedFields: matchedFieldsMap.get(person.id) ?? [],
        _tier: matchTierMap.get(person.id) ?? 3,
      };
    });

    // ── Step 8: sort ──────────────────────────────────────────────────────
    results.sort((a, b) => {
      switch (sort) {
        case "RELEVANCE":
          if (a._tier !== b._tier) return a._tier - b._tier;
          if (b.caseCount !== a.caseCount) return b.caseCount - a.caseCount;
          return a.primaryFullName.localeCompare(b.primaryFullName, "th");

        case "NAME_ASC":
          return a.primaryFullName.localeCompare(b.primaryFullName, "th");

        case "CASE_COUNT_DESC":
          return b.caseCount - a.caseCount;

        case "LAST_SEEN_DESC":
          return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();

        case "AGE_ASC": {
          if (a.displayAge === null && b.displayAge === null) return 0;
          if (a.displayAge === null) return 1;
          if (b.displayAge === null) return -1;
          return a.displayAge - b.displayAge;
        }

        case "AGE_DESC": {
          if (a.displayAge === null && b.displayAge === null) return 0;
          if (a.displayAge === null) return 1;
          if (b.displayAge === null) return -1;
          return b.displayAge - a.displayAge;
        }

        default:
          return 0;
      }
    });

    // ── Step 9: paginate ──────────────────────────────────────────────────
    const total = results.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const pageItems = results.slice(start, start + pageSize);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const items: DrugPersonAdvancedSearchResult[] = pageItems.map(({ _tier: _t, ...rest }) => rest);

    return { items, page, pageSize, total, totalPages };
  }
}
