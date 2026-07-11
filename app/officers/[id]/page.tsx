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

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOfficerProfile } from "@/lib/server/officer_service";
import { getKnownUnits } from "@/lib/server/unit_service";
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
import { resolveOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { officerFullName } from "@/lib/ui/officer_summary";
import { OfficerWorkspace } from "@/components/officer/officer_workspace";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officer = await getOfficerProfile(decodeURIComponent(id));
  return { title: officer ? `${officerFullName(officer)} · Officer` : "Officer not found" };
}

export default async function OfficerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officerId = decodeURIComponent(id);
  const [officer, knownUnits, organizationEngine, portrait] = await Promise.all([
    getOfficerProfile(officerId),
    getKnownUnits(),
    loadOrganizationEngine(),
    resolveOfficerPortrait(officerId),
  ]);

  if (!officer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/officers">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to officers
        </Link>
      </Button>

      {/* OrganizationEngine is a class instance and cannot cross the Server
          -> Client Component boundary (RSC only serializes plain objects).
          Hand off the plain OrgTree snapshot instead — OfficerWorkspace
          (client) wraps it in organizationEngineFromTree() itself, exactly
          like the client-fetch path (useOrganizationEngine) already does. */}
      <OfficerWorkspace officer={officer} knownUnits={knownUnits} orgTree={organizationEngine.getOrganizationTree()} portrait={portrait} />
    </div>
  );
}
