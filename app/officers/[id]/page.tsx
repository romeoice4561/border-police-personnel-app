/**
 * Officer Detail page (Phase 15A; Phase 21A editable-profile foundation).
 *
 * Server Component: awaits the [id] route param, reads the officer straight
 * from the persistence layer via getOfficerProfile (which reuses the existing
 * OfficerQueryRepository — no duplicated query, no business logic in React),
 * and composes the officer components. Renders the framework 404 for a
 * missing officer.
 *
 * Phase 21A reshapes this into a future-ready editable-profile layout:
 * enhanced portrait header, Profile Completeness, per-section cards (Basic
 * Information, Career, Education, Training, Awards, Contact, Documents,
 * Notes, Achievements) each with a disabled "Edit" affordance, an enhanced
 * Career Timeline, and a right-rail Actions card. Nothing is editable yet —
 * every action is disabled with a "future update" tooltip. No schema/API
 * change; purely a composition of presentational components over the same
 * `officer` data this page already fetched.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOfficerProfile } from "@/lib/server/officer_service";
import { officerFullName } from "@/lib/ui/officer_summary";
import { ProfileHeader } from "@/components/officer/profile_header";
import { ProfileCompletenessCard } from "@/components/officer/profile_completeness_card";
import { ProfileActionsCard } from "@/components/officer/profile_actions_card";
import { BasicInformationSection } from "@/components/officer/basic_information_section";
import { CareerSection } from "@/components/officer/career_section";
import { EducationSection } from "@/components/officer/education_section";
import { TrainingSection } from "@/components/officer/training_section";
import { AchievementsSection } from "@/components/officer/achievements_section";
import { ContactSection } from "@/components/officer/contact_section";
import { DocumentsSection } from "@/components/officer/documents_section";
import { NotesSection } from "@/components/officer/notes_section";
import { OfficerQualityCard } from "@/components/officer/officer_quality_card";
import { CareerTimelineSection } from "@/components/officer/career_timeline_section";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officer = await getOfficerProfile(decodeURIComponent(id));
  return { title: officer ? `${officerFullName(officer)} · Officer` : "Officer not found" };
}

export default async function OfficerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officer = await getOfficerProfile(decodeURIComponent(id));

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

      <ProfileHeader officer={officer} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <BasicInformationSection officer={officer} />
            <CareerSection officer={officer} />
          </div>

          <CareerTimelineSection timeline={officer.timeline} />

          <div className="grid gap-4 sm:grid-cols-2">
            <EducationSection />
            <TrainingSection />
          </div>

          <AchievementsSection />
          <ContactSection officer={officer} />
          <DocumentsSection />
          <NotesSection />

          <OfficerQualityCard officer={officer} />
        </div>

        <div className="space-y-4">
          <ProfileCompletenessCard officer={officer} />
          <ProfileActionsCard />
        </div>
      </div>
    </div>
  );
}
