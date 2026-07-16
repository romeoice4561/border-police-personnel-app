/**
 * OfficerRestrictedProfile (Phase 47 — officer-viewing-a-colleague view;
 * Phase 47.1 — visibility rules aligned with the final product spec).
 *
 * The LIMITED profile an Officer sees when opening another officer's profile
 * (reached from Search). Per the Phase 47.1 spec, visible:
 *   • Profile Photo  • Rank  • Name  • Position  • Unit
 *   • Career Timeline  • Training summary  • Skills
 *   • Personnel Capability Summary (AI Summary)
 *
 * Everything private is intentionally ABSENT here (not merely hidden with CSS):
 * national ID, address, phone, family, salary, internal/sensitive documents,
 * notes, and every other personal-information field — none are rendered, so
 * nothing sensitive reaches the client for this viewer. This is a READ-ONLY
 * presentation component; it has no edit path and performs no mutation.
 *
 * It reuses the existing read-only display components (OfficerPhoto,
 * CareerTimelineSection, TrainingSection, SkillsSection,
 * OfficerIntelligenceCard) exactly as the full workspace does — no business
 * logic is duplicated or modified. The full-profile OfficerWorkspace is
 * unaffected and still used for admin / commander / self.
 */
"use client";

import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import type { OfficerIntelligenceCard as OfficerIntelligenceCardData } from "@/lib/intelligence";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";
import { officerFullName } from "@/lib/ui/officer_summary";
import { OfficerPhoto } from "@/components/officer/officer_photo";
import { CareerTimelineSection } from "@/components/officer/career_timeline_section";
import { TrainingSection } from "@/components/officer/training_section";
import { SkillsSection } from "@/components/officer/skills_section";
import { OfficerIntelligenceCard } from "@/components/intelligence/officer_intelligence_card";
import { Briefcase, Building2, ShieldAlert } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";

export interface OfficerRestrictedProfileProps {
  officer: OfficerWithRelations;
  portrait: ResolvedOfficerPortrait;
  intelligence: OfficerIntelligenceCardData | null;
  organizationEngine: OrganizationEngine;
}

export function OfficerRestrictedProfile({ officer, portrait, intelligence, organizationEngine }: OfficerRestrictedProfileProps) {
  const { t } = useT();
  const name = officerFullName(officer);

  const orgLabels = organizationEngine.resolveLabels({
    headquartersId: officer.headquartersId ?? null,
    regionId: officer.regionId ?? null,
    battalionId: officer.battalionId ?? null,
    companyId: officer.companyId ?? null,
  });
  const unit = [orgLabels.company, orgLabels.battalion, orgLabels.borderPatrolDivision, orgLabels.headquarters]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="space-y-6">
      {/* Identity header — photo, rank, name, position, unit only. */}
      <header className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0">
            <OfficerPhoto thumbnailUrl={portrait.thumbnailUrl} name={name} size={112} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{officer.rank || "—"}</p>
            <h1 title={name} className="wrap-break-word text-2xl leading-tight font-semibold text-foreground">
              {name}
            </h1>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">{t("officer.position")}</dt>
                  <dd className="wrap-break-word text-sm text-foreground">{officer.currentPosition || "—"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">{t("officer.unit")}</dt>
                  <dd className="wrap-break-word text-sm text-foreground">{unit || t("officer.notAssigned")}</dd>
                </div>
              </div>
            </dl>
          </div>
        </div>
      </header>

      {/* Phase 47.1 — Career Timeline, Training summary, and Skills are visible
          to an officer viewing a colleague (professional record), reusing the
          exact same read-only sections the full workspace renders. */}
      <CareerTimelineSection timeline={officer.timeline} organizationEngine={organizationEngine} />
      <TrainingSection training={officer.training} />
      <SkillsSection skills={officer.skills} />

      {/* Personnel Capability Summary (AI Summary). */}
      {intelligence ? <OfficerIntelligenceCard card={intelligence} /> : null}

      {/* Restricted-view notice — explains that private sections (personal ID,
          address, phone, family, salary, internal documents) are hidden. */}
      <p className="flex items-center gap-2 rounded-xl border border-border bg-neutral-bg/50 px-4 py-3 text-xs text-muted">
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("auth.restrictedProfileNotice")}
      </p>
    </div>
  );
}
