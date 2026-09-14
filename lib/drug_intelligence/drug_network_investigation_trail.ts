/**
 * Client/URL-only investigation navigation trail for Network expand.
 * This is how the officer moved between graphs — not graph evidence.
 * No DB, API, or session storage.
 */

import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";

export const NETWORK_TRAIL_MAX_PREVIOUS = 3;
export const NETWORK_TRAIL_FROM_PARAM = "from";
export const NETWORK_TRAIL_LABELS_PARAM = "fromLabels";
export const NETWORK_TRAIL_LABEL_MAX_LENGTH = 80;

const NODE_TYPES = new Set<DrugGraphNodeType>([
  "PERSON",
  "PHONE",
  "SIM",
  "DEVICE",
  "VEHICLE",
  "CASE",
  "LOCATION",
]);

const SAFE_ENTITY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export interface NetworkTrailStep {
  type: DrugGraphNodeType;
  id: string;
  label: string;
}

export function isNetworkTrailNodeType(value: string | null | undefined): value is DrugGraphNodeType {
  return Boolean(value && NODE_TYPES.has(value as DrugGraphNodeType));
}

export function isNetworkTrailEntityId(value: string | null | undefined): value is string {
  return Boolean(value && SAFE_ENTITY_ID.test(value));
}

export function sanitizeNetworkTrailLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NETWORK_TRAIL_LABEL_MAX_LENGTH);
}

function parseStep(raw: string): Omit<NetworkTrailStep, "label"> | null {
  const separator = raw.indexOf(":");
  if (separator <= 0) return null;
  const type = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  if (!isNetworkTrailNodeType(type) || !isNetworkTrailEntityId(id)) return null;
  return { type, id };
}

export function parseNetworkInvestigationTrail(searchParams: URLSearchParams): NetworkTrailStep[] {
  const rawFrom = searchParams.get(NETWORK_TRAIL_FROM_PARAM);
  if (!rawFrom) return [];
  const tokens = rawFrom.split(",").filter(Boolean);
  if (tokens.length === 0 || tokens.length > NETWORK_TRAIL_MAX_PREVIOUS) return [];
  const steps: NetworkTrailStep[] = [];
  const labels = (searchParams.get(NETWORK_TRAIL_LABELS_PARAM) ?? "").split("|");
  for (let index = 0; index < tokens.length; index += 1) {
    const parsed = parseStep(tokens[index]!);
    if (!parsed) return [];
    if (steps.some((step) => step.id === parsed.id)) return [];
    steps.push({
      ...parsed,
      label: sanitizeNetworkTrailLabel(decodeTrailLabel(labels[index])),
    });
  }
  return steps;
}

function decodeTrailLabel(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function serializeNetworkInvestigationTrail(steps: NetworkTrailStep[]): {
  from: string | undefined;
  fromLabels: string | undefined;
} {
  const bounded = steps.slice(0, NETWORK_TRAIL_MAX_PREVIOUS);
  if (bounded.length === 0) return { from: undefined, fromLabels: undefined };
  return {
    from: bounded.map((step) => `${step.type}:${step.id}`).join(","),
    fromLabels: bounded.map((step) => encodeURIComponent(sanitizeNetworkTrailLabel(step.label))).join("|"),
  };
}

export function networkTrailUrlPatch(steps: NetworkTrailStep[]): Record<string, string | undefined> {
  const serialized = serializeNetworkInvestigationTrail(steps);
  return {
    [NETWORK_TRAIL_FROM_PARAM]: serialized.from,
    [NETWORK_TRAIL_LABELS_PARAM]: serialized.fromLabels,
  };
}

export function clearNetworkTrailUrlPatch(): Record<string, undefined> {
  return {
    [NETWORK_TRAIL_FROM_PARAM]: undefined,
    [NETWORK_TRAIL_LABELS_PARAM]: undefined,
  };
}

export function appendNetworkTrailStep(
  previous: NetworkTrailStep[],
  leaving: NetworkTrailStep
): NetworkTrailStep[] {
  if (!isNetworkTrailNodeType(leaving.type) || !isNetworkTrailEntityId(leaving.id)) return previous;
  if (previous.some((step) => step.id === leaving.id)) return previous;
  const next = [...previous, { ...leaving, label: sanitizeNetworkTrailLabel(leaving.label) }];
  if (next.length <= NETWORK_TRAIL_MAX_PREVIOUS) return next;
  return [next[0]!, ...next.slice(next.length - (NETWORK_TRAIL_MAX_PREVIOUS - 1))];
}

export function networkTrailOrigin(previous: NetworkTrailStep[]): NetworkTrailStep | null {
  return previous[0] ?? null;
}

export function shouldShowNetworkTrail(args: {
  previous: NetworkTrailStep[];
  currentFocusId: string | null | undefined;
  boardId?: string | null;
}): boolean {
  if (args.boardId) return false;
  if (args.previous.length === 0 || !args.currentFocusId) return false;
  return args.previous[0]!.id !== args.currentFocusId;
}

export function buildNetworkTrailReturnFocus(previous: NetworkTrailStep[]): {
  focusType: DrugGraphNodeType;
  focusId: string;
} | null {
  const origin = networkTrailOrigin(previous);
  if (!origin) return null;
  return { focusType: origin.type, focusId: origin.id };
}
