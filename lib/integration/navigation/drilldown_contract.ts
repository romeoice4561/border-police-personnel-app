/**
 * Drill-down / query builders (Phase 49A — §9).
 *
 * Centralizes every URL query-string builder/parser for document
 * intelligence — no component may hand-build a `?documentReadiness=...`
 * string. Mirrors lib/commander_query/search_params.ts's existing
 * `filtersFromSearchParams()` convention exactly (a typed allowlist check,
 * silently dropping unrecognized/malformed values rather than crashing).
 *
 * Serialization rule: only NON-DEFAULT/NON-EMPTY values are written to the
 * query string — a `false` boolean filter or an unset enum is OMITTED
 * entirely, never written as `=false`/`=undefined`, so URLs stay minimal
 * and existing unrelated params are never disturbed.
 *
 * Pure — no I/O, no React, no Next.js router.
 */
import type { DocumentIntelligenceFilters, CommanderExpiryFilterStatus } from "@/lib/integration/navigation/document_filter_types";
import { DOCUMENT_READINESS_VALUES, DOCUMENT_COMPLETENESS_VALUES, DOCUMENT_EXPIRY_FILTER_VALUES } from "@/lib/integration/navigation/document_filter_types";
import type { ReadinessLevel } from "@/lib/intelligence/document_readiness";
import type { CompletenessLevel } from "@/lib/integration/documents/document_intelligence_contract";

const BOOLEAN_TRUE = "1";

/**
 * Serializes only the document-intelligence filter fields into a plain
 * string→string record — omits every default/empty value. Does NOT know
 * about the other, pre-existing CommanderQueryFilters fields (promotion,
 * training, etc.) — callers merge this with any other query params they
 * already have (see mergeSearchParams below), so unrelated filters are
 * always preserved, never overwritten.
 */
export function serializeCommanderDocumentFilters(filters: DocumentIntelligenceFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.documentReadiness) params.documentReadiness = filters.documentReadiness;
  if (filters.documentCompleteness) params.documentCompleteness = filters.documentCompleteness;
  if (filters.expiryStatus) params.expiryStatus = filters.expiryStatus;
  if (filters.pendingOcrReview) params.pendingOcrReview = BOOLEAN_TRUE;
  if (filters.unsupportedDocument) params.unsupportedDocument = BOOLEAN_TRUE;
  if (filters.missingRequiredDocument) params.missingRequiredDocument = BOOLEAN_TRUE;
  if (filters.qualityWarning) params.qualityWarning = BOOLEAN_TRUE;
  return params;
}

/**
 * Parses ONLY the document-intelligence filter keys out of an arbitrary
 * URLSearchParams-like record — unrecognized/malformed values are silently
 * dropped (never crash the page), matching filtersFromSearchParams()'s
 * existing convention exactly. Other, non-document filter keys in `params`
 * are ignored here (not an error) — the caller's own
 * filtersFromSearchParams() handles those independently and merges results.
 */
export function parseCommanderDocumentFilters(params: Record<string, string | string[] | undefined>): DocumentIntelligenceFilters {
  const filters: DocumentIntelligenceFilters = {};

  const readiness = params.documentReadiness;
  if (typeof readiness === "string" && (DOCUMENT_READINESS_VALUES as readonly string[]).includes(readiness)) {
    filters.documentReadiness = readiness as ReadinessLevel;
  }

  const completeness = params.documentCompleteness;
  if (typeof completeness === "string" && (DOCUMENT_COMPLETENESS_VALUES as readonly string[]).includes(completeness)) {
    filters.documentCompleteness = completeness as CompletenessLevel;
  }

  const expiry = params.expiryStatus;
  if (typeof expiry === "string" && (DOCUMENT_EXPIRY_FILTER_VALUES as readonly string[]).includes(expiry)) {
    filters.expiryStatus = expiry as CommanderExpiryFilterStatus;
  }

  if (params.pendingOcrReview === BOOLEAN_TRUE) filters.pendingOcrReview = true;
  if (params.unsupportedDocument === BOOLEAN_TRUE) filters.unsupportedDocument = true;
  if (params.missingRequiredDocument === BOOLEAN_TRUE) filters.missingRequiredDocument = true;
  if (params.qualityWarning === BOOLEAN_TRUE) filters.qualityWarning = true;

  return filters;
}

/**
 * Builds a full Commander Search drill-down URL from document-intelligence
 * filters — e.g. `/commander-search?documentReadiness=BLOCKED`. `extraParams`
 * lets a caller preserve/add OTHER existing query params (e.g. an
 * officerId scoping param) without this function needing to know their
 * shape — merged in verbatim, document filters always win on key collision
 * (there are none today since the key sets are disjoint).
 */
export function buildCommanderDocumentFilterUrl(filters: DocumentIntelligenceFilters, extraParams: Record<string, string> = {}): string {
  const params = { ...extraParams, ...serializeCommanderDocumentFilters(filters) };
  const query = new URLSearchParams(params).toString();
  return query ? `/commander-search?${query}` : "/commander-search";
}

/** Builds the URL to a specific officer's profile page. */
export function buildOfficerProfileUrl(officerId: string): string {
  return `/officers/${encodeURIComponent(officerId)}`;
}

/** Builds the URL to a specific officer's profile, with a query hint (`section=epf`) that the profile page's client script can use to scroll to the e-PF section — the profile page does not currently expose a hash/anchor for this, so this is an additive, backward-compatible query param (ignored by the page today unless the page is updated to read it, per §7's "clicking the card opens or scrolls to the e-PF section" requirement, implemented as a client-side scroll-into-view keyed off this param). */
export function buildOfficerEpfUrl(officerId: string): string {
  return `${buildOfficerProfileUrl(officerId)}?section=epf`;
}

/** Builds the URL to a specific document's review context — the officer's profile, scrolled to e-PF, since there is no standalone per-document review route today (the e-PF drawer is the only document-detail surface). */
export function buildDocumentReviewUrl(officerId: string): string {
  return buildOfficerEpfUrl(officerId);
}
