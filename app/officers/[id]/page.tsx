/**
 * Officer Detail page (Phase 15A; Phase 21A editable-profile foundation;
 * Phase 23A Officer Profile Workspace).
 *
 * Server Component: awaits the [id] route param, reads the officer straight
 * from the persistence layer via getOfficerProfile (which reuses the existing
 * OfficerQueryRepository — no duplicated query, no business logic in React),
 * plus the distinct unit list (for the Unit combobox's suggestions), and
 * renders the framework 404 for a missing officer.
 *
 * All editable-profile UI (Edit Mode, per-section editors, batched Save) is
 * a client component (OfficerWorkspace) — this Server Component only fetches
 * and hands off data; `router.refresh()` inside the workspace re-runs this
 * fetch after a successful save.
 */

import { notFound } from "next/navigation";
import { getOfficerProfile, getSkillCatalog } from "@/lib/server/officer_service";
import { getKnownUnits } from "@/lib/server/unit_service";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { resolveOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { buildOfficerProfileIntelligence } from "@/lib/server/commander_intelligence_service";
import { composeOfficerIntelligenceViewModel } from "@/lib/officer_intelligence/view_model";
import { redactOfficerForClient } from "@/lib/officer_profile/officer_financial_redaction";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { officerFullName } from "@/lib/ui/officer_summary";
import { OfficerWorkspace } from "@/components/officer/officer_workspace";
import { OfficersBackLink } from "@/components/officer/officers_back_link";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officer = await getOfficerProfile(decodeURIComponent(id));
  return { title: officer ? `${officerFullName(officer)} · Officer` : "Officer not found" };
}

export default async function OfficerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officerId = decodeURIComponent(id);
  const [officer, knownUnits, organizationEngine, portrait, skillCatalog] = await Promise.all([
    getOfficerProfile(officerId),
    getKnownUnits(),
    loadOrganizationEngine(),
    resolveOfficerPortrait(officerId),
    getSkillCatalog(),
  ]);

  if (!officer) {
    notFound();
  }

  // Phase 44: composed here (not a second fetch) — reuses the SAME officer,
  // resolved portrait, and organization labels already loaded above, so the
  // Officer Intelligence View Model costs zero extra I/O.
  const orgLabels = organizationEngine.resolveLabels({
    headquartersId: officer.headquartersId,
    regionId: officer.regionId,
    battalionId: officer.battalionId,
    companyId: officer.companyId,
  });
  const officerIntelligence = composeOfficerIntelligenceViewModel(
    officer,
    { company: orgLabels.company },
    portrait.thumbnailUrl,
    new Date()
  );

  // Phase 49A: composed here too — reuses the SAME already-loaded
  // officer.documents, zero extra I/O. This is the canonical contract
  // (lib/integration/documents/document_intelligence_contract.ts) — the
  // exact same computation Commander Search/Dashboard use, so the Officer
  // Profile card and Commander Search table can never disagree.
  const documentIntelligence = composeOfficerDocumentIntelligence({
    officerId: officer.officerId,
    officerPk: officer.id,
    documents: officer.documents,
  });

  return (
    <div className="space-y-6">
      <OfficersBackLink />

      {/* OrganizationEngine is a class instance and cannot cross the Server
          -> Client Component boundary (RSC only serializes plain objects).
          Hand off the plain OrgTree snapshot instead — OfficerWorkspace
          (client) wraps it in organizationEngineFromTree() itself, exactly
          like the client-fetch path (useOrganizationEngine) already does. */}
      {/* Phase 45.1 hardening pass: redactOfficerForClient() masks
          bankAccountNumber BEFORE it crosses into the Client Component
          tree — this codebase has no server-verifiable session (see that
          function's doc comment), so the raw value must never enter the
          RSC payload for ANY viewer today, not even one whose local
          client-side session claims officers.viewFinancial. officerIntelligence
          above is composed from the UN-redacted `officer` (Intelligence
          calculations never touch bank fields, so this is safe and avoids
          a second, redundant fetch). */}
      <OfficerWorkspace
        officer={redactOfficerForClient(officer)}
        knownUnits={knownUnits}
        orgTree={organizationEngine.getOrganizationTree()}
        portrait={portrait}
        intelligence={buildOfficerProfileIntelligence(officer)}
        officerIntelligence={officerIntelligence}
        documentIntelligence={documentIntelligence}
        skillCatalog={skillCatalog}
      />
    </div>
  );
}
