/**
 * OfficerWorkspace (Phase 23A — Officer Profile Workspace, Section 7;
 * Phase XX.1 — create mode on the same canonical shell).
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
 *
 * Phase XX.1: `mode="create"` locks editors on `/officers/new`, hides
 * intelligence KPI cards, defers portrait upload until after Manual Entry
 * create, then patches nested profile data and redirects to `/officers/{id}`.
 */
"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";
import type { OfficerIntelligenceCard as OfficerIntelligenceCardData } from "@/lib/intelligence";
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import { officerFullName, currentTimelineRow } from "@/lib/ui/officer_summary";
import { useOfficerWorkspace, type OfficerWorkspaceMode } from "@/components/officer/use_officer_workspace";
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
import { OfficerDocumentReadinessCard } from "@/components/officer/officer_document_readiness_card";
import type { OfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { ProfileActionsCard } from "@/components/officer/profile_actions_card";
import { OfficerIntelligenceCard } from "@/components/intelligence/officer_intelligence_card";
import { OfficerRestrictedProfile } from "@/components/officer/officer_restricted_profile";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { useAuth } from "@/components/auth/auth_provider";
import { AUTH_ENFORCED } from "@/lib/auth/auth_config";
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
import type { OrgTree } from "@/lib/organization/org_tree";
import type { ManualEntryDuplicateCandidate } from "@/lib/ui/api_client";
import {
  appointmentDateFromTimelineDrafts,
  CreateOfficerDuplicateError,
  CreateOfficerPartialFailure,
  runCreateOfficerSave,
  validateCreateIdentity,
} from "@/lib/manual_entry/create_officer_save";
import type { PendingCreatePortrait } from "@/lib/manual_entry/create_officer_portrait";

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
  /** Phase 49A: the canonical per-officer document-readiness contract, composed once server-side from officer.documents (zero extra I/O) — read by OfficerDocumentReadinessCard here AND by EpfSection's summary, so both agree. */
  documentIntelligence: OfficerDocumentIntelligence;
  /**
   * Phase 27: the raw org-tree snapshot, fetched server-side. Wrapped into an
   * OrganizationEngine HERE (client-side) rather than accepted as an
   * OrganizationEngine prop directly — a class instance can't cross the
   * Server -> Client Component boundary (RSC only serializes plain data).
   */
  orgTree: OrgTree;
  /** Phase 44: the active skill catalog (categories + skills + levels) for the skills accordion editor. */
  skillCatalog: SkillCatalog;
  /**
   * Phase XX.1: workspace mode. Omit on `/officers/[id]` — existing view/edit
   * behavior is unchanged. `"create"` locks editors on `/officers/new`.
   */
  mode?: OfficerWorkspaceMode;
}

const DUPLICATE_REASON_LABEL: Record<string, string> = {
  policeServiceNumber: "เลขประจำตัวตำรวจตรงกัน",
  citizenId: "เลขบัตรประชาชนตรงกัน",
  nameAndDateOfBirth: "ชื่อ-นามสกุล และวันเกิดตรงกัน",
};

/**
 * Phase 47 — profile visibility gate (hook-safe).
 *
 * The EXPORTED OfficerWorkspace is a thin wrapper that calls exactly one hook
 * (useAuth) — always, unconditionally — then chooses ONE of two independent
 * child components. Each child owns its own complete, unconditional set of
 * hooks; because the choice happens at a component boundary (not by skipping a
 * hook inside a single component), React's hook order can never differ between
 * renders.
 */
export function OfficerWorkspace(props: OfficerWorkspaceProps) {
  const { user, can } = useAuth();
  const isCreate = props.mode === "create";

  const { officer } = props;
  const isOwnProfile = user?.officerId != null && user.officerId === officer.officerId;
  const canViewFull = isCreate || !AUTH_ENFORCED || can("officers.view") || isOwnProfile;
  const canEdit = isCreate || !AUTH_ENFORCED || can("officers.edit") || (can("officer.editOwn") && isOwnProfile);
  const canViewFinancial = isCreate || !AUTH_ENFORCED || can("officers.viewFinancial") || isOwnProfile;

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

function OfficerFullWorkspace({
  officer,
  knownUnits,
  portrait,
  orgTree,
  intelligence,
  officerIntelligence,
  documentIntelligence,
  skillCatalog,
  canEdit,
  canViewFinancial,
  mode = "view",
}: OfficerWorkspaceProps & { canEdit: boolean; canViewFinancial: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const isCreate = mode === "create";
  const organizationEngine = useMemo(() => organizationEngineFromTree(orgTree), [orgTree]);
  const workspace = useOfficerWorkspace(officer, organizationEngine, { mode: isCreate ? "create" : undefined });
  const { editing, startEditing, cancel, save, buildSaveRequest, isSaving, saveError } = workspace;
  const { t } = useT();

  const [galleryKey, setGalleryKey] = useState(0);
  const handlePortraitChanged = useCallback(() => setGalleryKey((k) => k + 1), []);

  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createFieldError, setCreateFieldError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<ManualEntryDuplicateCandidate[] | null>(null);
  const [partialFailure, setPartialFailure] = useState<{ officerId: string; message: string } | null>(null);
  const [pendingPortrait, setPendingPortrait] = useState<PendingCreatePortrait | null>(null);

  const pendingRefreshRef = useRef(false);
  useEffect(() => {
    if (!pendingRefreshRef.current || editing) return;
    pendingRefreshRef.current = false;
    startTransition(() => {
      router.refresh();
    });
  }, [editing, router]);

  useEffect(() => {
    return () => {
      if (pendingPortrait?.previewUrl) URL.revokeObjectURL(pendingPortrait.previewUrl);
    };
  }, [pendingPortrait]);

  async function handleSave() {
    setSaveSucceeded(false);
    try {
      await save();
      setSaveSucceeded(true);
      pendingRefreshRef.current = true;
    } catch {
      // saveError (from useSaveOfficerProfile) is rendered below.
    }
  }

  async function handleCreateSave() {
    setCreateFieldError(null);
    setDuplicates(null);
    setPartialFailure(null);

    if (!validateCreateIdentity(workspace.profile)) {
      setCreateFieldError(t("manualEntry.requiredFieldsMissing"));
      return;
    }
    if (!user?.id || !user.displayName) {
      setCreateFieldError(t("manualEntry.saveErrorGeneric"));
      return;
    }

    setCreateBusy(true);
    try {
      const result = await runCreateOfficerSave({
        profile: workspace.profile,
        profileSaveBody: buildSaveRequest(),
        actorId: user.id,
        actorName: user.displayName,
        appointmentDate: appointmentDateFromTimelineDrafts(workspace.timeline),
        pendingPortrait,
      });
      router.push(`/officers/${encodeURIComponent(result.officerId)}`);
    } catch (error) {
      if (error instanceof CreateOfficerDuplicateError) {
        setDuplicates(error.candidates);
      } else if (error instanceof CreateOfficerPartialFailure) {
        setPartialFailure({ officerId: error.officerId, message: error.message });
      } else {
        setCreateFieldError(t("manualEntry.saveErrorGeneric"));
      }
    } finally {
      setCreateBusy(false);
    }
  }

  function handleStartEditing() {
    setSaveSucceeded(false);
    startEditing();
  }

  function handleCancel() {
    if (isCreate) {
      router.push("/officers");
      return;
    }
    setSaveSucceeded(false);
    cancel();
  }

  const showEditors = isCreate || editing;
  const hideIntelCards = isCreate || editing;
  const busy = isCreate ? createBusy : isSaving;
  const officerCurrentTimelineRow = currentTimelineRow(officer.timeline);

  const liveUnit =
    (
      workspace.profile.companyText ||
      workspace.profile.battalionText ||
      workspace.profile.regionText ||
      workspace.profile.headquartersText ||
      workspace.profile.currentUnit
    ).trim() || null;
  const liveDisplayName = [workspace.profile.rank, workspace.profile.firstName, workspace.profile.lastName]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-8" data-testid={isCreate ? "officer-workspace-create" : "officer-workspace"}>
      <OfficerIntelligenceHeader
        viewModel={officerIntelligence}
        portrait={portrait}
        phone={isCreate ? workspace.profile.phone.trim() || null : officer.phone}
        nickname={isCreate ? workspace.profile.nickname.trim() || null : officer.nickname}
        academyClass={
          isCreate
            ? workspace.profile.academyClass.trim()
              ? Number(workspace.profile.academyClass)
              : null
            : officer.academyClass
        }
        currentTimelineRow={officerCurrentTimelineRow}
        onPortraitChanged={handlePortraitChanged}
        officerSource={officer.source}
        hideIntelligenceKpis={isCreate}
        identityOverride={
          isCreate
            ? {
                rank: workspace.profile.rank.trim() || null,
                displayName: liveDisplayName || "โปรไฟล์ใหม่",
                position: workspace.profile.currentPosition.trim() || null,
                unit: liveUnit,
              }
            : null
        }
        deferPortraitUpload={isCreate}
        deferredPortraitPreviewUrl={pendingPortrait?.previewUrl ?? null}
        onDeferredPortrait={(payload) => {
          setPendingPortrait((prev) => {
            if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
            return payload;
          });
        }}
        onClearDeferredPortrait={() => {
          setPendingPortrait((prev) => {
            if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
            return null;
          });
        }}
      />

      {isCreate || editing ? (
        <div className="sticky top-0 z-20 flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-foreground">
            {isCreate ? t("manualEntry.createModeBanner") : t("officer.editModeBanner")}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={isCreate ? handleCreateSave : handleSave} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {isCreate ? t("manualEntry.saveProfile") : t("common.save")}
            </Button>
          </div>
        </div>
      ) : null}

      {saveSucceeded && !saveError && !isCreate ? (
        <div className="flex items-center gap-2 rounded-xl border border-good/40 bg-good/5 px-4 py-3 text-sm text-good" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("officer.saveSuccess")}
        </div>
      ) : null}

      {saveError && !isCreate ? (
        <div className="flex items-center gap-2 rounded-xl border border-serious/40 bg-serious/5 px-4 py-3 text-sm text-serious" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("officer.saveErrorGeneric")}
        </div>
      ) : null}

      {duplicates && duplicates.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-serious/40 bg-serious/5 p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-serious">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("manualEntry.duplicateFoundTitle")}
          </p>
          <ul className="space-y-1.5">
            {duplicates.map((c) => (
              <li key={c.officerId} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <Link href={`/officers/${encodeURIComponent(c.officerId)}`} className="font-medium text-accent hover:underline">
                  {c.rank} {c.firstName} {c.lastName}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  {c.reasons.map((r) => DUPLICATE_REASON_LABEL[r] ?? r).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {partialFailure ? (
        <div className="flex flex-col gap-2 rounded-xl border border-serious/40 bg-serious/5 px-4 py-3 text-sm text-serious" role="alert">
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("manualEntry.partialFailureTitle")}
          </p>
          <p>{partialFailure.message}</p>
          <Link
            href={`/officers/${encodeURIComponent(partialFailure.officerId)}`}
            className="font-medium text-accent underline"
          >
            {t("manualEntry.partialFailureContinue")}
          </Link>
        </div>
      ) : null}

      {createFieldError ? (
        <div className="rounded-xl border border-critical/40 bg-critical/5 px-4 py-3 text-sm text-critical" role="alert">
          {createFieldError}
        </div>
      ) : null}

      {!hideIntelCards ? (
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
          {showEditors ? (
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
          {!isCreate && intelligence ? <OfficerIntelligenceCard card={intelligence} /> : null}
          {!isCreate ? <OfficerDocumentReadinessCard documentIntelligence={documentIntelligence} /> : null}
          {!isCreate ? <ProfileCompletenessCard officer={officer} /> : null}
          {!isCreate ? (
            <ProfileActionsCard editing={editing} onEditProfile={handleStartEditing} canEdit={canEdit} />
          ) : null}
        </div>
      </div>

      {showEditors ? (
        <SkillsEditor catalog={skillCatalog} rows={workspace.skills} onChange={workspace.setSkills} />
      ) : (
        <SkillsSection skills={officer.skills} />
      )}

      {showEditors ? (
        <SalaryHistoryEditor rows={workspace.salaryHistory} onChange={workspace.setSalaryHistory} />
      ) : (
        <SalaryHistorySection salaryHistory={officer.salaryHistory} />
      )}

      {showEditors ? (
        <CareerTimelineEditor
          rows={workspace.timeline}
          onChange={workspace.setTimeline}
          organizationEngine={organizationEngine}
          isSaving={busy}
          saveError={isCreate ? null : saveError}
        />
      ) : (
        <CareerTimelineSection timeline={officer.timeline} organizationEngine={organizationEngine} />
      )}

      {!hideIntelCards ? <OfficerTrainingIntelligenceCard viewModel={officerIntelligence} /> : null}

      <div className="grid gap-6 sm:grid-cols-2">
        {showEditors ? (
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

      <div id="epf-section">
        {isCreate ? (
          <div className="rounded-2xl border border-border bg-neutral-bg p-4 text-sm text-muted">
            {t("manualEntry.epfDeferred")}
          </div>
        ) : (
          <EpfSection officerId={officer.officerId} documents={officer.documents} portrait={portrait} />
        )}
      </div>

      <section className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{t("officer.media")}</h2>
        </div>

        <div className="rounded-2xl border border-border bg-neutral-bg p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t("officer.photoGallery")}</h3>
          {isCreate ? (
            <p className="text-sm text-muted">{t("manualEntry.mediaDeferred")}</p>
          ) : (
            <PhotoGallery
              officerId={officer.officerId}
              name={officerFullName(officer)}
              officialPortraitId={officer.officialPortraitId}
              refreshKey={galleryKey}
            />
          )}
        </div>
      </section>

      {!isCreate ? <OfficerQualityCard officer={officer} /> : null}

      <NotesSection />
    </div>
  );
}
