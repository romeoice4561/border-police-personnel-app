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

import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import { useOfficerWorkspace } from "@/components/officer/use_officer_workspace";
import { ProfileHeader } from "@/components/officer/profile_header";
import { ProfileEditor } from "@/components/officer/profile_editor";
import { BasicInformationSection } from "@/components/officer/basic_information_section";
import { CareerSection } from "@/components/officer/career_section";
import { ContactSection } from "@/components/officer/contact_section";
import { CareerTimelineSection } from "@/components/officer/career_timeline_section";
import { CareerTimelineEditor } from "@/components/officer/career_timeline_editor";
import { EducationSection } from "@/components/officer/education_section";
import { EducationEditor } from "@/components/officer/education_editor";
import { TrainingSection } from "@/components/officer/training_section";
import { TrainingEditor } from "@/components/officer/training_editor";
import { AchievementsSection } from "@/components/officer/achievements_section";
import { DocumentsSection } from "@/components/officer/documents_section";
import { NotesSection } from "@/components/officer/notes_section";
import { OfficerQualityCard } from "@/components/officer/officer_quality_card";
import { ProfileCompletenessCard } from "@/components/officer/profile_completeness_card";
import { ProfileActionsCard } from "@/components/officer/profile_actions_card";
import { Button } from "@/components/ui/button";

export interface OfficerWorkspaceProps {
  officer: OfficerWithRelations;
  /** Distinct unit names across all officers, for the Unit combobox's suggestions. */
  knownUnits: readonly string[];
  /** Trusted portrait (from a matched ProfilePhoto), resolved server-side. */
  portrait: ResolvedOfficerPortrait;
}

export function OfficerWorkspace({ officer, knownUnits, portrait }: OfficerWorkspaceProps) {
  const router = useRouter();
  const workspace = useOfficerWorkspace(officer);
  const { editing, startEditing, cancel, save, isSaving, saveError } = workspace;

  async function handleSave() {
    await save();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <ProfileHeader officer={officer} portrait={portrait} />

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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {editing ? (
            <ProfileEditor profile={workspace.profile} onChange={workspace.setProfile} knownUnits={knownUnits} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <BasicInformationSection officer={officer} />
                <CareerSection officer={officer} />
              </div>
              <ContactSection officer={officer} />
            </>
          )}

          {editing ? (
            <CareerTimelineEditor rows={workspace.timeline} onChange={workspace.setTimeline} knownUnits={knownUnits} />
          ) : (
            <CareerTimelineSection timeline={officer.timeline} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {editing ? (
              <>
                <EducationEditor rows={workspace.education} onChange={workspace.setEducation} />
                <TrainingEditor rows={workspace.training} onChange={workspace.setTraining} />
              </>
            ) : (
              <>
                <EducationSection education={officer.education} />
                <TrainingSection training={officer.training} />
              </>
            )}
          </div>

          <AchievementsSection />
          <DocumentsSection />
          <NotesSection />

          <OfficerQualityCard officer={officer} />
        </div>

        <div className="space-y-4">
          <ProfileCompletenessCard officer={officer} />
          <ProfileActionsCard editing={editing} onEditProfile={startEditing} />
        </div>
      </div>
    </div>
  );
}
