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

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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
import { OfficerTrainingIntelligenceCard } from "@/components/officer/officer_training_intelligence_card";
import { ProfileEditor, PersonalInformationEditor } from "@/components/officer/profile_editor";
import { BasicInformationSection } from "@/components/officer/basic_information_section";
import { CareerSection } from "@/components/officer/career_section";
import { CurrentOrganizationSection } from "@/components/officer/current_organization_section";
import { ContactSection } from "@/components/officer/contact_section";
import { PersonalInformationSection } from "@/components/officer/personal_information_section";
import { MembershipFinancialEditor } from "@/components/officer/membership_financial_editor";
import { MembershipFinancialSection } from "@/components/officer/membership_financial_section";
import { hasStoredBankAccountNumber } from "@/components/officer/use_officer_workspace";
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
import { EpfSection } from "@/components/officer/epf/epf_section";
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
  /**
   * Phase 45.1: unmasked bank account number + full financial Master Data —
   * a SEPARATE capability from canViewFull/canEdit (a commander or colleague
   * with general view access still sees the bank account masked). Own
   * profile always sees the unmasked value, matching the ownership-scoped
   * pattern used by canEdit above.
   */
  const canViewFinancial = !AUTH_ENFORCED || can("officers.viewFinancial") || isOwnProfile;

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

  return <OfficerFullWorkspace {...props} canEdit={canEdit} canViewFinancial={canViewFinancial} />;
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
function OfficerFullWorkspace({ officer, knownUnits, portrait, orgTree, intelligence, officerIntelligence, skillCatalog, canEdit, canViewFinancial }: OfficerWorkspaceProps & { canEdit: boolean; canViewFinancial: boolean }) {
  const router = useRouter();
  const organizationEngine = useMemo(() => organizationEngineFromTree(orgTree), [orgTree]);
  const workspace = useOfficerWorkspace(officer, organizationEngine);
  const { editing, startEditing, cancel, save, isSaving, saveError } = workspace;
  const { t } = useT();

  // Incremented after Upload / Replace / Delete / history "Set as Current" so
  // PhotoGallery's useEffect re-fetches portrait history without a page reload.
  const [galleryKey, setGalleryKey] = useState(0);
  const handlePortraitChanged = useCallback(() => setGalleryKey((k) => k + 1), []);

  // Transient success flag — cleared on the next edit/cancel action (not a timer).
  const [saveSucceeded, setSaveSucceeded] = useState(false);

  // The save mutation returns counts only (not a full officer payload), so
  // router.refresh() is required to re-fetch Server Component props. Running
  // it in the same turn as setEditing(false) raced React's editor→read-only
  // teardown against the RSC payload replacement (removeChild(null)). A ref
  // + effect defers refresh until after the editing=false commit; startTransition
  // keeps the RSC update off the urgent path.
  const pendingRefreshRef = useRef(false);
  useEffect(() => {
    if (!pendingRefreshRef.current || editing) return;
    pendingRefreshRef.current = false;
    startTransition(() => {
      router.refresh();
    });
  }, [editing, router]);

  async function handleSave() {
    // Post-save: (1) save() PATCHes JSON and exits edit mode; (2) after that
    // commit, the effect above refreshes Server Component data; (3) success
    // feedback is set. Scroll position is never touched.
    setSaveSucceeded(false);
    try {
      await save();
      setSaveSucceeded(true);
      pendingRefreshRef.current = true;
    } catch {
      // saveError (from useSaveOfficerProfile) is rendered below.
    }
  }

  function handleStartEditing() {
    setSaveSucceeded(false);
    startEditing();
  }

  function handleCancel() {
    setSaveSucceeded(false);
    cancel();
  }

  const officerCurrentTimelineRow = currentTimelineRow(officer.timeline);

  return (
    <div className="space-y-8">
      {/* Phase 44 Task 8, section 1: Officer Intelligence Summary Header. */}
      <OfficerIntelligenceHeader
        viewModel={officerIntelligence}
        portrait={portrait}
        phone={officer.phone}
        nickname={officer.nickname}
        academyClass={officer.academyClass}
        currentTimelineRow={officerCurrentTimelineRow}
        onPortraitChanged={handlePortraitChanged}
      />

      {editing ? (
        <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">{t("officer.editModeBanner")}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Bug-fix pass (Task 10): distinct success/failure feedback, inline —
          never a full-page asset, never the raw server/network error
          message (saveError.message is intentionally NOT rendered here
          anymore; it is still available to developers via saveError itself
          for future logging, just never shown to the user verbatim). */}
      {saveSucceeded && !saveError ? (
        <div className="flex items-center gap-2 rounded-xl border border-good/40 bg-good/5 px-4 py-3 text-sm text-good" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("officer.saveSuccess")}
        </div>
      ) : null}

      {saveError ? (
        <div className="flex items-center gap-2 rounded-xl border border-serious/40 bg-serious/5 px-4 py-3 text-sm text-serious" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("officer.saveErrorGeneric")}
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
              <MembershipFinancialEditor
                profile={workspace.profile}
                onChange={workspace.setProfile}
                canViewFinancial={canViewFinancial}
                hasStoredBankAccountNumber={hasStoredBankAccountNumber(officer)}
              />
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
              <MembershipFinancialSection officer={officer} />
            </>
          )}
        </div>

        <div className="space-y-6">
          {intelligence ? <OfficerIntelligenceCard card={intelligence} /> : null}
          <ProfileCompletenessCard officer={officer} />
          <ProfileActionsCard editing={editing} onEditProfile={handleStartEditing} canEdit={canEdit} />
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

      {/* Phase 45 Task 9: Training Intelligence summary sits ABOVE the
          factual Training/Education record list, never replacing it —
          hidden in Edit Mode like the other Intelligence cards (nothing
          here is editable). */}
      {!editing ? <OfficerTrainingIntelligenceCard viewModel={officerIntelligence} /> : null}

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

      {/* Phase 46: the Electronic Personnel File (e-PF) is now the central
          document repository, positioned before Media/Photo Gallery. It
          replaces DocumentsSection's rendering slot (same underlying
          upload/download/delete/history endpoints) — Photo Gallery keeps its
          own Media section unchanged below. Phase 46A: `portrait` is passed
          through only to derive the "Official Portrait" completeness signal
          (source !== "PLACEHOLDER") — never used to trigger a portrait
          upload from the e-PF section. */}
      <EpfSection officerId={officer.officerId} documents={officer.documents} portrait={portrait} />

      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Media</h2>
        </div>

        <div className="rounded-2xl border border-border bg-neutral-bg p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">คลังภาพ (Photo Gallery)</h3>
          <PhotoGallery officerId={officer.officerId} name={officerFullName(officer)} officialPortraitId={officer.officialPortraitId} refreshKey={galleryKey} />
        </div>
      </section>

      <OfficerQualityCard officer={officer} />

      <NotesSection />
    </div>
  );
}
