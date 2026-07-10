/**
 * GlobalSearchService (Phase 26B Part B).
 *
 * One free-text query box, merged across:
 *   1. Officer's own fields (name/surname/phone/officerId/rank/position/
 *      region/unit + linked Region/Battalion/Company names) — via
 *      OfficerQueryRepository.globalSearch, a single indexed SQL query.
 *   2. Every registered SearchProvider (Drive filename today; future
 *      document titles / GP7 numbers plug in the same way) — each
 *      contributes a set of officerIds, unioned into the Officer query via
 *      `extraOfficerIds`.
 *
 * Adding a new searchable entity later means writing one new SearchProvider
 * and passing it into the `providers` array — no change to this service's
 * merge logic, and no change to the existing per-field /search endpoint
 * (officers.search), which this does not touch or replace.
 */

import type { OfficerQueryRepository, PaginatedOfficers, OfficerSortField } from "@/lib/database/repositories/officer_query_repository";
import type { SearchProvider } from "@/lib/search/global_search_types";

export interface GlobalSearchServiceDependencies {
  officers: OfficerQueryRepository;
  providers?: readonly SearchProvider[];
}

export interface GlobalSearchOptions {
  q: string;
  page: number;
  pageSize: number;
  sortBy: OfficerSortField;
  sortOrder: "asc" | "desc";
}

export class GlobalSearchService {
  private readonly officers: OfficerQueryRepository;
  private readonly providers: readonly SearchProvider[];

  constructor(dependencies: GlobalSearchServiceDependencies) {
    this.officers = dependencies.officers;
    this.providers = dependencies.providers ?? [];
  }

  async search(options: GlobalSearchOptions): Promise<PaginatedOfficers> {
    const q = options.q.trim();

    const providerResults = await Promise.all(this.providers.map((p) => p.findMatchingOfficerIds(q)));
    const extraOfficerIds = new Set<string>();
    for (const ids of providerResults) for (const id of ids) extraOfficerIds.add(id);

    return this.officers.globalSearch({
      q,
      extraOfficerIds: [...extraOfficerIds],
      page: options.page,
      pageSize: options.pageSize,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });
  }
}
