/**
 * Drill-down descriptors for Workforce Intelligence (Phase 52.1).
 * Approved relative routes only — no hostnames, no internal org IDs.
 */

import type { WorkforceDrilldownDescriptor, WorkforceDrilldownTarget } from "@/lib/commander_workforce/types";

const APPROVED_PREFIXES = ["/commander-search", "/commander-promotion", "/officers/"] as const;

export function isApprovedWorkforceHref(href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("://")) return false;
  return APPROVED_PREFIXES.some((p) => href === p || href.startsWith(p));
}

function serializeQuery(filters: Record<string, string | string[] | number | boolean>): string {
  const params = new URLSearchParams();
  const keys = Object.keys(filters).sort();
  for (const key of keys) {
    const value = filters[key];
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of [...value].map(String).sort()) params.append(key, item);
    } else if (typeof value === "boolean") {
      if (value) params.set(key, "true");
    } else {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function buildWorkforceDrilldown(args: {
  id: string;
  target?: WorkforceDrilldownTarget;
  label: string;
  filters?: Record<string, string | string[] | number | boolean>;
}): WorkforceDrilldownDescriptor {
  const target = args.target ?? "commander-search";
  const filters = args.filters ?? {};
  let relativeHref: string | undefined;
  if (target === "commander-search") {
    relativeHref = `/commander-search${serializeQuery(filters)}`;
  } else if (target === "commander-promotion") {
    relativeHref = `/commander-promotion${serializeQuery(filters)}`;
  } else {
    relativeHref = `/commander-search${serializeQuery(filters)}`;
  }
  if (relativeHref && !isApprovedWorkforceHref(relativeHref)) {
    relativeHref = undefined;
  }
  return {
    id: args.id,
    target,
    label: args.label,
    filters,
    relativeHref,
  };
}
