/**
 * GET /api/organization/tree — the full Headquarters -> Border Patrol
 * Division (Region) -> Battalion -> Company hierarchy (Phase 26B Part 6 Part
 * S: the Filter Framework's shared source for Battalion/Company/Division
 * filter options across every page — Officers today, Gallery/Portrait
 * Cleanup/Review/Statistics reuse the same endpoint later, no duplicated
 * queries).
 *
 * Reuses the EXISTING getOrgTree() (lib/server/org_tree_service.ts,
 * Phase 26B Part C/D) — the same small, rarely-changing snapshot already
 * used by the officer detail Server Component. This route just exposes it
 * to CLIENT components (the Officers list page is "use client" and cannot
 * call a Server Component's data loader directly).
 */

import { getOrgTree } from "@/lib/server/org_tree_service";
import { guarded } from "@/lib/api/api_handlers";
import { jsonOk } from "@/lib/api/api_response";

export async function GET(): Promise<Response> {
  return guarded(async () => {
    const tree = await getOrgTree();
    return jsonOk(tree);
  });
}
