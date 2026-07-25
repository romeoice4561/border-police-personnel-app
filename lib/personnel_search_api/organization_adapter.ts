/**
 * Loads OrgTree once per API request for Entity Resolution (Phase 51.1A).
 */
import "server-only";

import type { OrgTree } from "@/lib/organization/org_tree";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";

export type OrganizationTreeLoader = () => Promise<OrgTree>;

export async function loadPersonnelSearchOrganizationTree(): Promise<OrgTree> {
  const engine = await loadOrganizationEngine();
  return engine.getOrganizationTree();
}
