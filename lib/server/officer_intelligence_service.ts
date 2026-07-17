/**
 * Officer Intelligence server entry point (Phase 44).
 *
 * Loads one officer + resolves their canonical Official Portrait (Phase 43
 * resolver) + organization labels, then composes the Officer Intelligence
 * View Model. Mirrors how lib/server/commander_dashboard_service.ts
 * composes the Dashboard view model from the same underlying pieces.
 */
import "server-only";
import { getOfficerProfile } from "@/lib/server/officer_service";
import { resolveOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { composeOfficerIntelligenceViewModel } from "@/lib/officer_intelligence/view_model";
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";

export async function getOfficerIntelligenceViewModel(officerId: string): Promise<OfficerIntelligenceViewModel | null> {
  const [officer, portrait, organizationEngine] = await Promise.all([
    getOfficerProfile(officerId),
    resolveOfficerPortrait(officerId),
    loadOrganizationEngine(),
  ]);
  if (!officer) return null;

  const orgLabels = organizationEngine.resolveLabels({
    headquartersId: officer.headquartersId,
    regionId: officer.regionId,
    battalionId: officer.battalionId,
    companyId: officer.companyId,
  });

  return composeOfficerIntelligenceViewModel(officer, { company: orgLabels.company }, portrait.thumbnailUrl, new Date());
}
