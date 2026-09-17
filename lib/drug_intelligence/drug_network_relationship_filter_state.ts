/**
 * Network relationship-type filter selection helpers.
 *
 * URL remains the durable store (`relationshipTypes=TYPE,TYPE`). This module
 * only normalizes multi-select — it does not change neighborhood AND/OR
 * semantics or invent relationship types.
 */
import {
  DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES,
  DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES,
} from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";

export const DRUG_GRAPH_FILTER_RELATIONSHIP_TYPES: readonly DrugGraphRelationshipType[] = [
  ...DRUG_GRAPH_DIRECT_RELATIONSHIP_TYPES,
  ...DRUG_GRAPH_INFERRED_RELATIONSHIP_TYPES,
];

const KNOWN_RELATIONSHIP_TYPES = new Set<string>(DRUG_GRAPH_FILTER_RELATIONSHIP_TYPES);

export function isDrugGraphRelationshipType(value: string): value is DrugGraphRelationshipType {
  return KNOWN_RELATIONSHIP_TYPES.has(value);
}

/** Catalog order, first-seen only. Unknown/blank tokens are dropped. */
export function parseRelationshipTypesParam(raw: string | null | undefined): DrugGraphRelationshipType[] | undefined {
  if (!raw || !raw.trim()) return undefined;
  const seen = new Set<DrugGraphRelationshipType>();
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (isDrugGraphRelationshipType(value)) seen.add(value);
  }
  if (seen.size === 0) return undefined;
  return DRUG_GRAPH_FILTER_RELATIONSHIP_TYPES.filter((type) => seen.has(type));
}

export function serializeRelationshipTypesParam(selected: readonly DrugGraphRelationshipType[] | undefined): string | undefined {
  const normalized = parseRelationshipTypesParam((selected ?? []).join(","));
  return normalized && normalized.length > 0 ? normalized.join(",") : undefined;
}

export function toggleRelationshipTypeSelection(
  selected: readonly DrugGraphRelationshipType[] | undefined,
  type: DrugGraphRelationshipType
): DrugGraphRelationshipType[] | undefined {
  const current = new Set(parseRelationshipTypesParam((selected ?? []).join(",")) ?? []);
  if (current.has(type)) current.delete(type);
  else current.add(type);
  return current.size > 0 ? DRUG_GRAPH_FILTER_RELATIONSHIP_TYPES.filter((item) => current.has(item)) : undefined;
}

export function removeRelationshipTypeSelection(
  selected: readonly DrugGraphRelationshipType[] | undefined,
  type: DrugGraphRelationshipType
): DrugGraphRelationshipType[] | undefined {
  const current = new Set(parseRelationshipTypesParam((selected ?? []).join(",")) ?? []);
  current.delete(type);
  return current.size > 0 ? DRUG_GRAPH_FILTER_RELATIONSHIP_TYPES.filter((item) => current.has(item)) : undefined;
}

/** Same handler the filter row, checkbox glyph, and label text all call. */
export function applyRelationshipFilterControlEvent(
  selected: readonly DrugGraphRelationshipType[] | undefined,
  event: { action: "toggle" | "remove" | "clear"; type?: DrugGraphRelationshipType }
): DrugGraphRelationshipType[] | undefined {
  if (event.action === "clear") return undefined;
  if (!event.type) return parseRelationshipTypesParam((selected ?? []).join(","));
  if (event.action === "remove") return removeRelationshipTypeSelection(selected, event.type);
  return toggleRelationshipTypeSelection(selected, event.type);
}

export function hasActiveNetworkFilterParams(input: {
  dateFrom?: string | null;
  dateTo?: string | null;
  relationshipTypes?: string | null;
  nodeTypes?: string | null;
  maxNodes?: string | null;
}): boolean {
  return Boolean(
    input.dateFrom?.trim() ||
      input.dateTo?.trim() ||
      input.relationshipTypes?.trim() ||
      input.nodeTypes?.trim() ||
      input.maxNodes?.trim()
  );
}

/**
 * Display state for Network filter controls.
 *
 * When a graph context exists (focus or saved board), it is the source of
 * truth — including empty selections. When it does not, URL values still
 * paint so a click is not immediately overwritten by a null context.
 */
export function resolveNetworkFilterDisplayState(input: {
  hasGraphContext: boolean;
  contextRelationshipTypes?: readonly DrugGraphRelationshipType[];
  contextDateFrom?: string;
  contextDateTo?: string;
  urlRelationshipTypes?: string | null;
  urlDateFrom?: string | null;
  urlDateTo?: string | null;
  formatDate: (value: string | undefined) => string;
}): {
  selectedRelationshipTypes: DrugGraphRelationshipType[] | undefined;
  dateFrom: string;
  dateTo: string;
} {
  const selectedRelationshipTypes = input.hasGraphContext
    ? parseRelationshipTypesParam((input.contextRelationshipTypes ?? []).join(","))
    : parseRelationshipTypesParam(input.urlRelationshipTypes);
  const dateFromSource = input.hasGraphContext
    ? input.contextDateFrom
    : (input.contextDateFrom ?? input.urlDateFrom ?? undefined);
  const dateToSource = input.hasGraphContext
    ? input.contextDateTo
    : (input.contextDateTo ?? input.urlDateTo ?? undefined);
  return {
    selectedRelationshipTypes,
    dateFrom: input.formatDate(dateFromSource),
    dateTo: input.formatDate(dateToSource),
  };
}

/** Graph-scoped filters that can hide every neighbor of a focused entity. */
export function hasActiveNetworkGraphFilters(input: {
  relationshipTypes?: readonly string[] | undefined;
  nodeTypes?: readonly string[] | undefined;
  dateFrom?: string | null;
  dateTo?: string | null;
}): boolean {
  return Boolean(
    (input.relationshipTypes && input.relationshipTypes.length > 0) ||
      (input.nodeTypes && input.nodeTypes.length > 0) ||
      input.dateFrom?.trim() ||
      input.dateTo?.trim()
  );
}

export type NetworkWorkspaceResultKind = "NO_FOCUS" | "FILTERED_EMPTY" | "EMPTY" | "HAS_GRAPH";

/**
 * Distinguishes "choose a starting entity" from "focus exists but filters
 * hid every connection". Neighborhood queries stay disabled until focus exists.
 */
export function resolveNetworkWorkspaceResultKind(input: {
  hasFocus: boolean;
  hasActiveFilters: boolean;
  nodeCount: number;
  edgeCount: number;
}): NetworkWorkspaceResultKind {
  if (!input.hasFocus) return "NO_FOCUS";
  const isolated = input.nodeCount <= 1 && input.edgeCount === 0;
  if (isolated && input.hasActiveFilters) return "FILTERED_EMPTY";
  if (isolated || input.nodeCount === 0) return "EMPTY";
  return "HAS_GRAPH";
}
