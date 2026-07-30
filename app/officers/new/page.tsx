/**
 * Create Personnel (Manual Personnel Entry — Phase XX / XX.1, Admin Only).
 *
 * Renders the canonical OfficerWorkspace in create mode so Manual Entry looks
 * and behaves like the real Drive/AI officer profile. Nested editors, master
 * data, portrait deferral, and duplicate checks reuse existing pipelines —
 * no second profile layout.
 *
 * Server Component: loads known units, org tree, and skill catalog the same
 * way `/officers/[id]` does, then hands an empty Manual Entry draft to the
 * client workspace.
 */

import { getSkillCatalog } from "@/lib/server/officer_service";
import { getKnownUnits } from "@/lib/server/unit_service";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { composeOfficerIntelligenceViewModel } from "@/lib/officer_intelligence/view_model";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import {
  createEmptyManualOfficerDraft,
  PLACEHOLDER_PORTRAIT,
} from "@/lib/manual_entry/create_officer_draft";
import { CreateOfficerPageClient } from "@/components/officer/create_officer_page_client";

export const metadata = {
  title: "เพิ่มกำลังพล · Create Personnel",
};

export default async function CreateOfficerPage() {
  const [knownUnits, organizationEngine, skillCatalog] = await Promise.all([
    getKnownUnits(),
    loadOrganizationEngine(),
    getSkillCatalog(),
  ]);

  const officer = createEmptyManualOfficerDraft();
  const orgLabels = organizationEngine.resolveLabels({
    headquartersId: officer.headquartersId,
    regionId: officer.regionId,
    battalionId: officer.battalionId,
    companyId: officer.companyId,
  });
  const officerIntelligence = composeOfficerIntelligenceViewModel(
    officer,
    { company: orgLabels.company },
    null,
    new Date()
  );
  const documentIntelligence = composeOfficerDocumentIntelligence({
    officerId: officer.officerId,
    officerPk: officer.id,
    documents: officer.documents,
  });

  return (
    <CreateOfficerPageClient
      officer={officer}
      knownUnits={knownUnits}
      orgTree={organizationEngine.getOrganizationTree()}
      portrait={PLACEHOLDER_PORTRAIT}
      intelligence={null}
      officerIntelligence={officerIntelligence}
      documentIntelligence={documentIntelligence}
      skillCatalog={skillCatalog}
    />
  );
}
