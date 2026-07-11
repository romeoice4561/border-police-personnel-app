/**
 * List/search query-building helpers (Phase 14 UI).
 *
 * Pure functions that turn UI filter/search form state into the OfficerQuery /
 * SearchQuery objects the api_client sends. Kept here (not inline in pages) so
 * the mapping is testable and shared, with no business logic duplicated across
 * the officers and search pages.
 */

import type { OfficerQuery, SearchQuery } from "@/lib/ui/api_client";
import type { SearchFormValue } from "@/components/common/search_bar";

/**
 * Phase 26B Part 6 Part M: the Officers-list filter set. `region`/
 * `minQuality` (Part M: "are not useful") are REPLACED by structured
 * org-hierarchy ids + the new operational filters below — kept here as
 * dead-but-typed fields would be worse than just removing them, and no
 * other page reads OfficerListFilters (grep-confirmed: only officers/page.tsx).
 */
export interface OfficerListFilters {
  rank?: string;
  headquartersId?: number;
  regionId?: number;
  battalionId?: number;
  companyId?: number;
  verificationStatus?: string;
  hasPortrait?: boolean;
  hasPhone?: boolean;
}

/** Builds the /officers query from filters + paging + sort. Drops empty values. */
export function buildOfficerQuery(
  filters: OfficerListFilters,
  page: number,
  pageSize: number,
  sortBy: string,
  sortOrder: "asc" | "desc"
): OfficerQuery {
  const query: OfficerQuery = { page, pageSize, sortBy, sortOrder };
  if (filters.rank) query.rank = filters.rank;
  if (typeof filters.headquartersId === "number") query.headquartersId = filters.headquartersId;
  if (typeof filters.regionId === "number") query.regionId = filters.regionId;
  if (typeof filters.battalionId === "number") query.battalionId = filters.battalionId;
  if (typeof filters.companyId === "number") query.companyId = filters.companyId;
  if (filters.verificationStatus) query.verificationStatus = filters.verificationStatus;
  if (typeof filters.hasPortrait === "boolean") query.hasPortrait = filters.hasPortrait;
  if (typeof filters.hasPhone === "boolean") query.hasPhone = filters.hasPhone;
  return query;
}

/** True when a search form has at least one usable criterion (the API 400s on none). */
export function hasSearchCriteria(form: SearchFormValue): boolean {
  return Boolean(
    form.name.trim() ||
      form.rank.trim() ||
      form.unit.trim() ||
      form.phone.trim() ||
      form.position.trim() ||
      form.region.trim() ||
      form.minQuality.trim() ||
      form.minCareerYears.trim()
  );
}

/** Builds the /search query from the form + paging. Numeric fields are parsed; blanks dropped. */
export function buildSearchQuery(form: SearchFormValue, page: number, pageSize: number): SearchQuery {
  const query: SearchQuery = { page, pageSize, match: form.match };
  if (form.name.trim()) query.name = form.name.trim();
  if (form.rank.trim()) query.rank = form.rank.trim();
  if (form.unit.trim()) query.unit = form.unit.trim();
  if (form.phone.trim()) query.phone = form.phone.trim();
  if (form.position.trim()) query.position = form.position.trim();
  if (form.region.trim()) query.region = form.region.trim();

  const minQuality = Number.parseInt(form.minQuality, 10);
  if (Number.isFinite(minQuality)) query.minQuality = minQuality;
  const minCareerYears = Number.parseInt(form.minCareerYears, 10);
  if (Number.isFinite(minCareerYears)) query.minCareerYears = minCareerYears;

  return query;
}
