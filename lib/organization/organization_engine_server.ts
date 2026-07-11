/**
 * OrganizationEngine — server-only production entry points (Phase 27).
 *
 * Split out of organization_engine.ts specifically so importing the
 * client-safe OrganizationEngine/OrganizationNormalizer classes/types never
 * pulls the Prisma/pg runtime into a client bundle (Next.js bundles based on
 * import graph, not runtime usage — a single "use client"-adjacent import of
 * getOrgTree/getOrganizationContainer here would poison every client
 * component that imports OrganizationEngine's TYPES alone).
 *
 * Import this module ONLY from Server Components, API routes, and other
 * server-only code (scripts, import pipelines). Client components take an
 * already-built OrganizationEngine as a prop instead (see
 * organizationEngineFromTree in organization_engine.ts for how a client
 * component wraps a server-fetched OrgTree it received over the wire).
 */

import { EMPTY_ORG_TREE, type OrgTree } from "@/lib/organization/org_tree";
import { getOrgTree } from "@/lib/server/org_tree_service";
import { getOrganizationContainer } from "@/lib/organization/organization_container";
import {
  OrganizationEngine,
  OrganizationNormalizer,
  type NormalizedCode,
  type NormalizedUnit,
} from "@/lib/organization/organization_engine";

// ---------------------------------------------------------------------------
// Server-side loader (memoized) — builds the sync OrganizationEngine from the DB.
// ---------------------------------------------------------------------------

let cachedTree: OrgTree | undefined;
let cachedTreeAt = 0;
const TREE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — the hierarchy changes rarely; avoids an unbounded stale cache across a long-lived process.

/**
 * Loads (and memoizes, per-process) the OrgTree from the DB and wraps it in
 * an OrganizationEngine. Call this from a Server Component or API route —
 * never from client code (it does I/O). The result is cheap to pass down:
 * client components take the resulting OrganizationEngine/OrgTree as a prop,
 * exactly like OrgTree already flows through the app today.
 *
 * Memoization means adding/renaming a unit via the DB is visible to a NEW
 * server request within TREE_CACHE_TTL_MS, without any code change to any
 * consuming screen — satisfying "future administrative editing must
 * propagate to every screen automatically."
 */
export async function loadOrganizationEngine(options: { forceRefresh?: boolean } = {}): Promise<OrganizationEngine> {
  const stale = Date.now() - cachedTreeAt > TREE_CACHE_TTL_MS;
  if (!cachedTree || stale || options.forceRefresh) {
    cachedTree = await getOrgTree();
    cachedTreeAt = Date.now();
  }
  return new OrganizationEngine(cachedTree);
}

/** Test/dev escape hatch — clears the memoized tree so the next loadOrganizationEngine() call re-fetches. */
export function resetOrganizationEngineCache(): void {
  cachedTree = undefined;
  cachedTreeAt = 0;
}

/** organizationEngineFromTree, re-exported for server callers that already have a tree and don't need to fetch/memoize one. */
export function organizationEngineFromTree(tree: OrgTree = EMPTY_ORG_TREE): OrganizationEngine {
  return new OrganizationEngine(tree);
}

// ---------------------------------------------------------------------------
// Production OrganizationNormalizer singleton + convenience functions.
// ---------------------------------------------------------------------------

let cachedNormalizer: OrganizationNormalizer | undefined;

/** The production OrganizationNormalizer, backed by the real DB, cached per process. Server code only. */
export async function getOrganizationNormalizer(): Promise<OrganizationNormalizer> {
  if (!cachedNormalizer) {
    const container = await getOrganizationContainer();
    cachedNormalizer = new OrganizationNormalizer({ repository: container.repository, service: container.service });
  }
  return cachedNormalizer;
}

/** normalizeRegion using the production (real-DB) normalizer — the convenience entry point most server callers want. */
export async function normalizeRegion(raw: string): Promise<NormalizedCode | null> {
  return (await getOrganizationNormalizer()).normalizeRegion(raw);
}

/** normalizeBattalion using the production (real-DB) normalizer. */
export async function normalizeBattalion(raw: string): Promise<NormalizedCode | null> {
  return (await getOrganizationNormalizer()).normalizeBattalion(raw);
}

/** normalizeCompany using the production (real-DB) normalizer. */
export async function normalizeCompany(raw: string): Promise<NormalizedCode | null> {
  return (await getOrganizationNormalizer()).normalizeCompany(raw);
}

/** normalizeUnit using the production (real-DB) normalizer. */
export async function normalizeUnit(raw: string): Promise<NormalizedUnit | null> {
  return (await getOrganizationNormalizer()).normalizeUnit(raw);
}

/** validateOrganizationText using the production (real-DB) normalizer. */
export async function validateOrganizationText(raw: string): Promise<boolean> {
  return (await getOrganizationNormalizer()).validateOrganizationText(raw);
}
