/**
 * Phase 1C — Progressive Relationship Investigation Trail.
 *
 * In-session QUERY CONTEXT only (not factual storage).
 * Bounded expansion hops after the initial Relationship Search.
 * No raw sensitive query text in trail persistence or URL crumbs.
 */

import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { DrugSearchMatchedField } from "@/lib/drug_intelligence/drug_intelligence_client";

/** Max expansion hops after the initial completed query (Phase 1C MVP). */
export const INVESTIGATION_TRAIL_MAX_EXPANSIONS = 3;

export const INVESTIGATION_TRAIL_SESSION_KEY = "di.rel.investigationTrail.v1";

export type InvestigationTrailEdgeKind = "DIRECT" | "INFERRED" | "PATH";

export interface InvestigationTrailEntity {
  entityType: DrugGraphNodeType;
  entityId: string;
  label: string;
}

/** Safe presentation-only origin query context (already-masked values). */
export interface InvestigationTrailQueryContextSnapshot {
  matchedField?: DrugSearchMatchedField;
  matchedValueMasked?: string;
}

export interface InvestigationTrailOrigin {
  entity: InvestigationTrailEntity;
  /** Completed initial answer URL (ids/labels only — no raw query text). */
  returnPath: string;
  queryContext: InvestigationTrailQueryContextSnapshot | null;
}

export interface InvestigationTrailStep {
  stepNumber: number;
  source: InvestigationTrailEntity;
  relationId: string;
  targetType: DrugGraphNodeType;
  result: InvestigationTrailEntity;
  edgeKind: InvestigationTrailEdgeKind;
  /** Compact evidence summary already rendered for the officer (presentation). */
  evidenceSummary?: string;
  /** URL of the completed search that produced `result`. */
  returnPath: string;
}

export interface InvestigationTrailState {
  version: 1;
  origin: InvestigationTrailOrigin | null;
  steps: InvestigationTrailStep[];
}

export function emptyInvestigationTrail(): InvestigationTrailState {
  return { version: 1, origin: null, steps: [] };
}

export function canExpandInvestigationTrail(trail: InvestigationTrailState): boolean {
  return trail.steps.length < INVESTIGATION_TRAIL_MAX_EXPANSIONS;
}

export function investigationExpansionRemaining(trail: InvestigationTrailState): number {
  return Math.max(0, INVESTIGATION_TRAIL_MAX_EXPANSIONS - trail.steps.length);
}

export function isInvestigationTrailActive(trail: InvestigationTrailState): boolean {
  return Boolean(trail.origin) || trail.steps.length > 0;
}

/** Current focus entity: last expansion result, else origin. */
export function currentInvestigationEntity(
  trail: InvestigationTrailState
): InvestigationTrailEntity | null {
  if (trail.steps.length > 0) return trail.steps[trail.steps.length - 1]!.result;
  return trail.origin?.entity ?? null;
}

export function ensureTrailOrigin(
  trail: InvestigationTrailState,
  origin: InvestigationTrailOrigin
): InvestigationTrailState {
  if (trail.origin) return trail;
  return { ...trail, origin };
}

export function pushInvestigationExpansion(
  trail: InvestigationTrailState,
  step: Omit<InvestigationTrailStep, "stepNumber">
): InvestigationTrailState | null {
  if (!canExpandInvestigationTrail(trail)) return null;
  const nextStep: InvestigationTrailStep = {
    ...step,
    stepNumber: trail.steps.length + 1,
  };
  return { ...trail, steps: [...trail.steps, nextStep] };
}

export function popInvestigationStep(trail: InvestigationTrailState): {
  trail: InvestigationTrailState;
  restoredReturnPath: string | null;
} {
  if (trail.steps.length === 0) {
    return {
      trail,
      restoredReturnPath: trail.origin?.returnPath ?? null,
    };
  }
  const last = trail.steps[trail.steps.length - 1]!;
  return {
    trail: { ...trail, steps: trail.steps.slice(0, -1) },
    restoredReturnPath: last.returnPath,
  };
}

/** Strip any accidental raw query-like params from a stored return path. */
export function sanitizeInvestigationReturnPath(path: string): string {
  try {
    const hashIdx = path.indexOf("#");
    const hash = hashIdx >= 0 ? path.slice(hashIdx) : "";
    const withoutHash = hashIdx >= 0 ? path.slice(0, hashIdx) : path;
    const qIdx = withoutHash.indexOf("?");
    const base = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
    const params = new URLSearchParams(qIdx >= 0 ? withoutHash.slice(qIdx + 1) : "");
    // Never persist free-text search q= into trail crumbs.
    params.delete("q");
    params.delete("query");
    params.delete("queryText");
    const qs = params.toString();
    return `${base}${qs ? `?${qs}` : ""}${hash}`;
  } catch {
    return path;
  }
}

export function saveInvestigationTrail(trail: InvestigationTrailState): void {
  if (typeof window === "undefined") return;
  try {
    if (!isInvestigationTrailActive(trail)) {
      sessionStorage.removeItem(INVESTIGATION_TRAIL_SESSION_KEY);
      return;
    }
    sessionStorage.setItem(INVESTIGATION_TRAIL_SESSION_KEY, JSON.stringify(trail));
  } catch {
    // ignore quota / private mode
  }
}

export function loadInvestigationTrail(): InvestigationTrailState {
  if (typeof window === "undefined") return emptyInvestigationTrail();
  try {
    const raw = sessionStorage.getItem(INVESTIGATION_TRAIL_SESSION_KEY);
    if (!raw) return emptyInvestigationTrail();
    const parsed = JSON.parse(raw) as InvestigationTrailState;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.steps)) {
      return emptyInvestigationTrail();
    }
    if (parsed.steps.length > INVESTIGATION_TRAIL_MAX_EXPANSIONS) {
      return {
        ...parsed,
        steps: parsed.steps.slice(0, INVESTIGATION_TRAIL_MAX_EXPANSIONS),
      };
    }
    return parsed;
  } catch {
    return emptyInvestigationTrail();
  }
}

export function clearInvestigationTrailStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(INVESTIGATION_TRAIL_SESSION_KEY);
  } catch {
    // ignore
  }
}
