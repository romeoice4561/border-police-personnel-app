/**
 * Server-side organization tree access (Phase 26B Part C/D).
 *
 * The seam Server Components use to read the WHOLE Headquarters -> Region ->
 * Battalion -> Company hierarchy in one shot (a small, rarely-changing
 * dataset — ~30 + 4 + 16 + 72 rows), for the Timeline org-hierarchy
 * dropdowns and their client-side auto-fill (lib/organization/org_tree.ts).
 * Reuses the EXISTING Region/Battalion/Company tables (Phase 20A) — no
 * duplicated query, no parallel hierarchy.
 *
 * Mirrors lib/server/unit_service.ts's lazy-per-process client cache exactly.
 */

import { createDatabaseClient } from "@/lib/database/database";
import type { OrgTree } from "@/lib/organization/org_tree";

interface OrgTreeDbClient {
  headquarters: { findMany(args: { orderBy: Record<string, "asc">[] }): Promise<Array<{ id: number; code: string; nameTh: string }>> };
  region: {
    findMany(args: { orderBy: Record<string, "asc">[] }): Promise<Array<{ id: number; code: string; nameTh: string; headquartersId: number | null }>>;
  };
  battalion: { findMany(args: { orderBy: Record<string, "asc">[] }): Promise<Array<{ id: number; code: string; nameTh: string; regionId: number }>> };
  company: { findMany(args: { orderBy: Record<string, "asc">[] }): Promise<Array<{ id: number; code: string; nameTh: string; battalionId: number }>> };
}

let cachedClient: OrgTreeDbClient | undefined;

function client(): OrgTreeDbClient {
  if (!cachedClient) {
    cachedClient = createDatabaseClient() as unknown as OrgTreeDbClient;
  }
  return cachedClient;
}

/** Fetches the entire org hierarchy in 4 queries, for the Timeline org dropdowns' suggestions + client-side auto-fill. */
export async function getOrgTree(): Promise<OrgTree> {
  const db = client();
  const [headquarters, regions, battalions, companies] = await Promise.all([
    db.headquarters.findMany({ orderBy: [{ displayOrder: "asc" }] }),
    db.region.findMany({ orderBy: [{ displayOrder: "asc" }] }),
    db.battalion.findMany({ orderBy: [{ displayOrder: "asc" }] }),
    db.company.findMany({ orderBy: [{ displayOrder: "asc" }] }),
  ]);
  return {
    headquarters: headquarters.map((h) => ({ id: h.id, code: h.code, nameTh: h.nameTh })),
    regions: regions.map((r) => ({ id: r.id, code: r.code, nameTh: r.nameTh, headquartersId: r.headquartersId })),
    battalions: battalions.map((b) => ({ id: b.id, code: b.code, nameTh: b.nameTh, regionId: b.regionId })),
    companies: companies.map((c) => ({ id: c.id, code: c.code, nameTh: c.nameTh, battalionId: c.battalionId })),
  };
}
