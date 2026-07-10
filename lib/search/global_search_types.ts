/**
 * Global Search — provider contract (Phase 26B Part B).
 *
 * A single free-text query box searches across many independent data
 * sources (Officer fields, Google Drive filenames, and future document
 * titles / GP7 numbers). Each source is a SearchProvider that takes the
 * normalized query and returns the officerIds it matched — the
 * GlobalSearchService (global_search_service.ts) merges/dedupes across all
 * registered providers and fetches the paginated Officer rows for the
 * union. Adding a new searchable entity later (e.g. document titles) means
 * writing one new provider and registering it — no change to the merge
 * logic or the existing per-field /search endpoint.
 *
 * Pure contract — no I/O here.
 */

export interface SearchProvider {
  /** Short identifier for logging/debugging — never shown to the end user. */
  readonly name: string;
  /** Returns every distinct officerId this provider's data source matched for the (already-normalized) query. */
  findMatchingOfficerIds(query: string): Promise<Set<string>>;
}
