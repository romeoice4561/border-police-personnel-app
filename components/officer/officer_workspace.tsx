/**
 * OfficerWorkspace (Phase 23A — Officer Profile Workspace, Section 7).
 *
 * The client component the Server Component page renders — owns the single
 * global Edit Mode (Section 7: "ทั้งหน้า ใช้ปุ่มเดียว แก้ไขข้อมูล / เมื่อกด Save
 * ทุกข้อมูล Save พร้อมกันครั้งเดียว") via useOfficerWorkspace, and switches
 * every editable section between its read-only display component and its
 * editor when `editing` is true. Basic Information/Career/Contact share one
 * ProfileEditor since they're all flat Officer-row fields; Career Timeline,
 * Education, and Training each keep their own editor (independent row
 * arrays, replace-all on save).
 *
 * A save error surfaces inline (never silently swallowed); after a
 * successful save, `router.refresh()` re-fetches the Server Component's
 * data so the read-only views reflect what was just written.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { officerFullName } from "@/lib/ui/officer_summary";
import { useOfficerWorkspace } from "@/components/officer/use_officer_workspace";
import { ProfileHeader } from "@/components/officer/profile_header";
import { ProfileEditor, PersonalInformationEditor } from "@/components/officer/profile_editor";
import { BasicInformationSection } from "@/components/officer/basic_information_section";
import { CareerSection } from "@/components/officer/career_section";
import { CurrentOrganizationSection } from "@/components/officer/current_organization_section";
import { ContactSection } from "@/components/officer/contact_section";
import { PersonalInformationSection } from "@/components/officer/personal_information_section";
import { CareerTimelineSection } from "@/components/officer/career_timeline_section";
import { CareerTimelineEditor } from "@/components/officer/career_timeline_editor";
import { EducationSection } from "@/components/officer/education_section";
import { EducationEditor } from "@/components/officer/education_editor";
import { TrainingSection } from "@/components/officer/training_section";
import { TrainingEditor } from "@/components/officer/training_editor";
import { SalaryHistorySection } from "@/components/officer/salary_history_section";
import { SalaryHistoryEditor } from "@/components/officer/salary_history_editor";
import { AchievementsSection } from "@/components/officer/achievements_section";
import { DocumentsSection } from "@/components/officer/documents_section";
import { NotesSection } from "@/components/officer/notes_section";
import { PhotoGallery } from "@/components/officer/photo_gallery";
import { OfficerQualityCard } from "@/components/officer/officer_quality_card";
import { ProfileCompletenessCard } from "@/components/officer/profile_completeness_card";
import { ProfileActionsCard } from "@/components/officer/profile_actions_card";
import { Button } from "@/components/ui/button";
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
import type { OrgTree } from "@/lib/organization/org_tree";

export interface OfficerWorkspaceProps {
  officer: OfficerWithRelations;
  /** Distinct unit names across all officers, for the Unit combobox's suggestions. */
  knownUnits: readonly string[];
  /** Trusted portrait (from a matched ProfilePhoto), resolved server-side. */
  portrait: ResolvedOfficerPortrait;
  /**
   * Phase 27: the raw org-tree snapshot, fetched server-side. Wrapped into an
   * OrganizationEngine HERE (client-side) rather than accepted as an
   * OrganizationEngine prop directly — a class instance can't cross the
   * Server -> Client Component boundary (RSC only serializes plain data).
   */
  orgTree: OrgTree;
}

export function OfficerWorkspace({ officer, knownUnits, portrait, orgTree }: OfficerWorkspaceProps) {
  const router = useRouter();
  const organizationEngine = useMemo(() => organizationEngineFromTree(orgTree), [orgTree]);
  const workspace = useOfficerWorkspace(officer, organizationEngine);
  const { editing, startEditing, cancel, save, isSaving, saveError } = workspace;

  // Incremented after Upload / Replace / Delete / history "Set as Current" so
  // PhotoGallery's useEffect re-fetches portrait history without a page reload.
  const [galleryKey, setGalleryKey] = useState(0);
  const handlePortraitChanged = useCallback(() => setGalleryKey((k) => k + 1), []);

  async function handleSave() {
    // Phase 26A stabilization (bug #4/#5): a rejected save (validation
    // failure, network error, ...) previously propagated as an unhandled
    // promise rejection out of this onClick handler — `saveError` from
    // useOfficerWorkspace already surfaces the message inline below, so the
    // rejection is caught here and swallowed (not re-thrown, not logged
    // again) rather than escaping the event handler. router.refresh() only
    // runs after a genuinely successful save.
    try {
      await save();
      router.refresh();
    } catch {
      // saveError (from useSaveOfficerProfile's useMutation) already holds
      // this failure and is rendered below — nothing further to do here.
    }
  }

  return (
    <div className="space-y-8">
      <ProfileHeader officer={officer} portrait={portrait} organizationEngine={organizationEngine} onPortraitChanged={handlePortraitChanged} />

      {editing ? (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">โหมดแก้ไขข้อมูล — แก้ไขได้ทุกส่วน แล้วกด &quot;บันทึก&quot; เพื่อบันทึกพร้อมกันทั้งหมด</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={isSaving}>
              ยกเลิก
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              บันทึก
            </Button>
          </div>
        </div>
      ) : null}

      {saveError ? (
        <div className="flex items-center gap-2 rounded-xl border border-serious/40 bg-serious/5 px-4 py-3 text-sm text-serious" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          บันทึกไม่สำเร็จ: {saveError.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Phase 26D Part 1: Basic Information -> Career -> Current
              Organization -> Contact -> Personal Information, in that
              reading order — Career Timeline immediately follows Personal
              Information (below, outside this grid). */}
          {editing ? (
            <>
              <ProfileEditor profile={workspace.profile} onChange={workspace.setProfile} knownUnits={knownUnits} organizationEngine={organizationEngine} />
              <PersonalInformationEditor profile={workspace.profile} onChange={workspace.setProfile} />
            </>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <BasicInformationSection officer={officer} />
                <CareerSection officer={officer} />
              </div>
              <CurrentOrganizationSection officer={officer} organizationEngine={organizationEngine} />
              <ContactSection officer={officer} />
              <PersonalInformationSection officer={officer} />
            </>
          )}
        </div>

        <div className="space-y-6">
          <ProfileCompletenessCard officer={officer} />
          <ProfileActionsCard editing={editing} onEditProfile={startEditing} />
        </div>
      </div>

      {/* Phase 28A: Salary History — an independent, reusable Career
          Intelligence module (future 2-step eligibility/promotion
          readiness/merit reports read from it, but it is not merged into
          Career Timeline, which stays focused on assignment history only).
          Immediately follows Personal Information above. */}
      {editing ? (
        <SalaryHistoryEditor rows={workspace.salaryHistory} onChange={workspace.setSalaryHistory} />
      ) : (
        <SalaryHistorySection salaryHistory={officer.salaryHistory} />
      )}

      {/* Phase 26B Part 6 Part V / Phase 26D Part 1: Career Timeline spans
          the FULL content width (outside the 2/3+1/3 grid) — it's the
          widest, most information-dense section on the page — and now
          immediately follows Salary History above. */}
      {editing ? (
        <CareerTimelineEditor rows={workspace.timeline} onChange={workspace.setTimeline} organizationEngine={organizationEngine} />
      ) : (
        <CareerTimelineSection timeline={officer.timeline} organizationEngine={organizationEngine} />
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {editing ? (
          <>
            <TrainingEditor rows={workspace.training} onChange={workspace.setTraining} />
            <EducationEditor rows={workspace.education} onChange={workspace.setEducation} />
          </>
        ) : (
          <>
            <TrainingSection training={officer.training} />
            <EducationSection education={officer.education} />
          </>
        )}
      </div>

      <AchievementsSection />

      {/* Phase 31D.1: supporting evidence is grouped as Media after the core
          career/qualification/achievement record. Existing gallery and
          document components keep their props and behaviour unchanged. */}
      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Media</h2>
        </div>

        <div className="rounded-2xl border border-border bg-neutral-bg p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">คลังภาพ (Photo Gallery)</h3>
          <PhotoGallery officerId={officer.officerId} name={officerFullName(officer)} officialPortraitId={officer.officialPortraitId} refreshKey={galleryKey} />
        </div>

        <div className="border-t border-border pt-4">
          <DocumentsSection officerId={officer.officerId} documents={officer.documents} />
        </div>
      </section>

      <OfficerQualityCard officer={officer} />

      <NotesSection />
    </div>
  );
}
