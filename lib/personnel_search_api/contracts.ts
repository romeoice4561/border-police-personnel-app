/**
 * HTTP-facing contracts for POST /api/personnel-search (Phase 51.1).
 */
import type { PersonnelSearchResult } from "@/lib/personnel_search/contracts";
import type { DisclosureLevel, SearchClient, SearchIntent } from "@/lib/personnel_search/types";
import type { PersonnelSearchApiErrorCode } from "@/lib/personnel_search_api/errors";

/** Clients allowed on the HTTP boundary (mapped to gateway SearchClient). */
export const API_SEARCH_CLIENTS = ["web", "telegram", "line", "internal"] as const;
export type ApiSearchClient = (typeof API_SEARCH_CLIENTS)[number];

export interface PersonnelSearchApiUnitScope {
  regionCode?: string;
  divisionCode?: string;
  companyCode?: string;
}

export interface PersonnelSearchApiRequestBody {
  query: string;
  disclosureLevel?: DisclosureLevel;
  /** Advisory only — never elevates permissions or forces unsafe results. */
  intentHint?: SearchIntent;
  unitScope?: PersonnelSearchApiUnitScope;
  cursor?: string;
  limit?: number;
  client?: ApiSearchClient;
}

export interface PersonnelSearchApiSuccessMeta {
  generatedAt: string;
  client: SearchClient;
  disclosureLevel: DisclosureLevel;
  nextCursor: string | null;
  resultCount: number;
  totalCount: number;
}

export type PersonnelSearchApiResponse =
  | {
      ok: true;
      requestId: string;
      result: PersonnelSearchResult;
      meta: PersonnelSearchApiSuccessMeta;
    }
  | {
      ok: false;
      requestId: string;
      error: {
        code: PersonnelSearchApiErrorCode;
        message: string;
        field?: string;
      };
    };

export const MAX_QUERY_LENGTH = 200;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 25;
export const APPROVED_ACTION_PATH_PREFIXES = [
  "/officers/",
  "/commander-promotion",
  "/commander-search",
  "/commander-intelligence",
  "/dashboard",
  "/search",
  "/drug-intelligence/",
] as const;
