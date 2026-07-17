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
import type { OfficerIntelligenceCard as OfficerIntelligenceCardData } from "@/lib/intelligence";
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import { officerFullName, currentTimelineRow } from "@/lib/ui/officer_summary";
import { useOfficerWorkspace } from "@/components/officer/use_officer_workspace";
import { OfficerIntelligenceHeader } from "@/components/officer/officer_intelligence_header";
import { OfficerPromotionIntelligenceCard } from "@/components/officer/officer_promotion_intelligence_card";
import { OfficerPersonalTimelineCard } from "@/components/officer/officer_personal_timeline_card";
import { OfficerRetirementIntelligenceCard } from "@/components/officer/officer_retirement_intelligence_card";
import { OfficerCommanderActions } from "@/components/officer/officer_commander_actions";
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
import { SkillsSection } from "@/components/officer/skills_section";
import { SkillsEditor } from "@/components/officer/skills_editor";
import type { SkillCatalog } from "@/lib/capability/capability_types";
import { AchievementsSection } from "@/components/officer/achievements_section";
import { DocumentsSection } from "@/components/officer/documents_section";
import { NotesSection } from "@/components/officer/notes_section";
import { PhotoGallery } from "@/components/officer/photo_gallery";
import { OfficerQualityCard } from "@/components/officer/officer_quality_card";
import { ProfileCompletenessCard } from "@/components/officer/profile_completeness_card";
import { ProfileActionsCard } from "@/components/officer/profile_actions_card";
import { OfficerIntelligenceCard } from "@/components/intelligence/officer_intelligence_card";
import { OfficerRestrictedProfile } from "@/components/officer/officer_restricted_profile";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { AUTH_ENFORCED } from "@/lib/auth/auth_config";
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
import type { OrgTree } from "@/lib/organization/org_tree";

export interface OfficerWorkspaceProps {
  officer: OfficerWithRelations;
  /** Distinct unit names across all officers, for the Unit combobox's suggestions. */
  knownUnits: readonly string[];
  /** Trusted portrait (from a matched ProfilePhoto), resolved server-side. */
  portrait: ResolvedOfficerPortrait;
  /** Prepared by Commander Intelligence Engine on the server. */
  intelligence: OfficerIntelligenceCardData | null;
  /** Phase 44: the composed Officer Intelligence View Model (Age/Service/Promotion/Retirement/Commander/Profile-Quality) — the single source every Intelligence-driven section on this page reads from. */
  officerIntelligence: OfficerIntelligenceViewModel;
  /**
   * Phase 27: the raw org-tree snapshot, fetched server-side. Wrapped into an
   * OrganizationEngine HERE (client-side) rather than accepted as an
   * OrganizationEngine prop directly — a class instance can't cross the
   * Server -> Client Component boundary (RSC only serializes plain data).
   */
  orgTree: OrgTree;
  /** Phase 44: the active skill catalog (categories + skills + levels) for the skills accordion editor. */
  skillCatalog: SkillCatalog;
}

/**
 * Phase 47 — profile visibility gate (hook-safe).
 *
 * The EXPORTED OfficerWorkspace is a thin wrapper that calls exactly one hook
 * (useAuth) — always, unconditionally — then chooses ONE of two independent
 * child components. Each child owns its own complete, unconditional set of
 * hooks; because the choice happens at a component boundary (not by skipping a
 * hook inside a single component), React's hook order can never differ between
 * renders. This is the fix for "Rendered more hooks than during the previous
 * render": the full workspace below no longer contains any auth-derived early
 * return, so its hook list is identical on every render.
 *
 * RBAC: canViewFull is officers.view OR own-profile (by capability, never role
 * name), with the same AUTH_ENFORCED soft-guard bypass.
 *
 * Phase 47.1 — Edit access is a SEPARATE capability from view access, computed
 * here (ownership + officer.editOwn is available only where `user` is in
 * scope) and passed down as `canEdit`: officers.edit (admin, any officer) OR
 * (officer.editOwn AND isOwnProfile). Commander has neither permission, so
 * commander is view-only — matches "Commander is READ ONLY except review".
 * This ownership-scoped-permission pattern (`<feature>.editOwn` + `isOwnRecord`)
 * is the template for future self-service modules (documents, media, timeline,
 * training, awards).
 */
export function OfficerWorkspace(props: OfficerWorkspaceProps) {
  const { user, can } = useAuth();

  const { officer } = props;
  const isOwnProfile = user?.officerId != null && user.officerId === officer.officerId;
  const canViewFull = !AUTH_ENFORCED || can("officers.view") || isOwnProfile;
  const canEdit = !AUTH_ENFORCED || can("officers.edit") || (can("officer.editOwn") && isOwnProfile);

  // An officer viewing a COLLEAGUE → restricted view (identity + Capability
  // Summary only). Admin/commander/self (or soft-guard off) → full workspace.
  // Component-boundary switch: neither branch skips a hook.
  if (!canViewFull) {
    return (
      <OfficerRestrictedProfile
        officer={props.officer}
        portrait={props.portrait}
        intelligence={props.intelligence}
        organizationEngine={organizationEngineFromTree(props.orgTree)}
      />
    );
  }

  return <OfficerFullWorkspace {...props} canEdit={canEdit} />;
}

/**
 * The full editable Officer Profile Workspace. Rendered only when the viewer
 * may see the full profile. Every hook here is called unconditionally at the
 * top; there is no auth branch inside, so the hook order is stable across all
 * renders. `canEdit` (computed by the wrapper above) gates whether Edit Mode
 * can be entered at all — a commander viewing any profile, or an officer
 * viewing a colleague's (already excluded by canViewFull, but defense in
 * depth), never sees a working Edit control.
 */
function OfficerFullWorkspace({ officer, knownUnits, portrait, orgTree, intelligence, officerIntelligence, skillCatalog, canEdit }: OfficerWorkspaceProps & { canEdit: boolean }) {
  const router = useRouter();
  const organizationEngine = useMemo(() => organizationEngineFromTree(orgTree), [orgTree]);
  const workspace = useOfficerWorkspace(officer, organizationEngine);
  const { editing, startEditing, cancel, save, isSaving, saveError } = workspace;
  const { t } = useT();

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

  const officerCurrentTimelineRow = currentTimelineRow(officer.timeline);

  return (
    <div className="space-y-8">
      {/* Phase 44 Task 8, section 1: Officer Intelligence Summary Header. */}
      <OfficerIntelligenceHeader
        viewModel={officerIntelligence}
        portrait={portrait}
        phone={officer.phone}
        currentTimelineRow={officerCurrentTimelineRow}
        onPortraitChanged={handlePortraitChanged}
      />

      {editing ? (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">{t("officer.editModeBanner")}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : null}

      {saveError ? (
        <div className="flex items-center gap-2 rounded-xl border border-serious/40 bg-serious/5 px-4 py-3 text-sm text-serious" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("officer.saveFailed")}: {saveError.message}
        </div>
      ) : null}

      {/* Phase 44 Task 8, sections 2-4: ประเด็นที่ควรดำเนินการ -> Promotion
          Intelligence -> Age/Service/Retirement Summary. Hidden in Edit
          Mode (nothing here is editable; showing it while editing invites
          acting on stale data mid-edit). */}
      {!editing ? (
        <>
          <OfficerCommanderActions items={officerIntelligence.commander.recommendations} />
          <OfficerPromotionIntelligenceCard viewModel={officerIntelligence} />
          <div className="grid gap-6 lg:grid-cols-2">
            <OfficerPersonalTimelineCard viewModel={officerIntelligence} dateOfBirth={officer.dateOfBirth ?? null} />
            <OfficerRetirementIntelligenceCard viewModel={officerIntelligence} />
          </div>
        </>
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
          {intelligence ? <OfficerIntelligenceCard card={intelligence} /> : null}
          <ProfileCompletenessCard officer={officer} />
          <ProfileActionsCard editing={editing} onEditProfile={startEditing} canEdit={canEdit} />
        </div>
      </div>

      {/* Phase 44: Personnel Capability Intelligence — "ความเชี่ยวชาญและ
          ศักยภาพ / Professional Skills & Competencies". Placed AFTER Personal
          Information and BEFORE Salary History so personal data and potential
          are grouped together (spec placement). */}
      {editing ? (
        <SkillsEditor catalog={skillCatalog} rows={workspace.skills} onChange={workspace.setSkills} />
      ) : (
        <SkillsSection skills={officer.skills} />
      )}

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
        <CareerTimelineEditor
          rows={workspace.timeline}
          onChange={workspace.setTimeline}
          organizationEngine={organizationEngine}
          isSaving={isSaving}
          saveError={saveError}
        />
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
