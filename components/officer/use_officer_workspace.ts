/**
 * useOfficerWorkspace (Phase 23A — Officer Profile Workspace, Section 7).
 *
 * Owns the workspace's Edit Mode state: a single `editing` flag every
 * section reads (Section 7 — "ทั้งหน้า ใช้ปุ่มเดียว แก้ไขข้อมูล"), draft copies
 * of every editable section's data, and one `save()` that batches
 * profile/timeline/education/training into a single PATCH request (Section
 * 7 — "เมื่อกด Save ทุกข้อมูล Save พร้อมกันครั้งเดียว").
 *
 * `startEditing()` snapshots the current server data into drafts;
 * `cancel()` discards drafts and exits edit mode without saving. Each
 * section's editor mutates its own draft slice via the returned setters —
 * this hook does not know about UI, only data.
 */
"use client";

import { useCallback, useState } from "react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { CareerTimelineRow } from "@/components/officer/career_timeline_section";
import { useSaveOfficerProfile } from "@/lib/officer_profile/officer_profile_hooks";
import type { OfficerProfileSaveRequest } from "@/lib/ui/api_client";
import { formatThaiDate } from "@/lib/officer_profile/thai_date";
import type { OrgTree } from "@/lib/organization/org_tree";
import { divisionLabelForRegion } from "@/lib/organization/border_patrol_division_options";

export interface ProfileDraft {
  rank: string;
  firstName: string;
  lastName: string;
  currentPosition: string;
  currentUnit: string;
  phone: string;
  email: string;
  lineId: string;
  facebookUrl: string;
  /** Phase 26B Part 5 Part C/I: structured Current Organization hierarchy, replacing the free-text Unit editor field. */
  headquartersId: number | null;
  headquartersText: string;
  regionId: number | null;
  regionText: string;
  battalionId: number | null;
  battalionText: string;
  companyId: number | null;
  companyText: string;
  nickname: string;
  /** Phase 26B Part 5 Part G: Personal Information. */
  dateOfBirth: string;
  bloodGroup: string;
  rh: string;
  maritalStatus: string;
  children: string;
  homeProvince: string;
  shirtSize: string;
  nationality: string;
  /** Phase 26B Part 5 Part O: optional additional fields. */
  citizenId: string;
  passportNumber: string;
  employeeNumber: string;
  emergencyContact: string;
  emergencyPhone: string;
  addressSummary: string;
  currentProvince: string;
  religion: string;
  educationLevel: string;
  weightKg: string;
  heightCm: string;
  uniformShoeSize: string;
  hatSize: string;
  jacketSize: string;
}

export interface EducationDraftRow {
  key: string;
  year: string;
  institution: string;
  degree: string;
  notes: string;
}

export interface TrainingDraftRow {
  key: string;
  year: string;
  course: string;
  organization: string;
  notes: string;
}

export interface TimelineDraftRow {
  key: string;
  /** Legacy free-text year, preserved for backward compatibility and as a fallback display when the structured fields below are unset. */
  year: string;
  rank: string;
  position: string;
  /** Legacy free-text unit, preserved for backward compatibility and as a fallback display when the structured org fields below are unset. */
  unit: string;
  source: string;
  verified: string;
  /** Phase 26B Part 3: structured date model — the editor's primary input; `year` above is kept in sync from these. */
  day: number | null;
  month: number | null;
  yearBE: number | null;
  isPresent: boolean;
  /** Phase 26B Part C/D: structured org hierarchy — the editor's primary input; `unit` above is kept in sync from these. */
  headquartersId: number | null;
  headquartersText: string;
  regionId: number | null;
  regionText: string;
  battalionId: number | null;
  battalionText: string;
  companyId: number | null;
  companyText: string;
  /** Phase 26B Part 5 Part D/H/M: verification triad — additive alongside the existing `verified` free-text field above. */
  verificationStatus: string;
  verifiedBy: string;
  verifiedDate: string;
  verificationRemark: string;
}

let nextKey = 1;
/** Generates a stable client-side key for a new draft row (never persisted — replaced by the DB id on reload). */
function newKey(): string {
  return `draft-${nextKey++}`;
}

/** Formats a persisted Date as "YYYY-MM-DD" for an HTML date input, or "" when unset. */
function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function toProfileDraft(officer: OfficerWithRelations, tree: OrgTree): ProfileDraft {
  return {
    rank: officer.rank,
    firstName: officer.firstName,
    lastName: officer.lastName,
    currentPosition: officer.currentPosition ?? "",
    currentUnit: officer.currentUnit ?? "",
    phone: officer.phone ?? "",
    email: officer.email ?? "",
    lineId: officer.lineId ?? "",
    facebookUrl: officer.facebookUrl ?? "",
    headquartersId: officer.headquartersId ?? null,
    headquartersText: findLabel(tree.headquarters, (h) => h.nameTh, officer.headquartersId ?? null),
    regionId: officer.regionId ?? null,
    regionText: findDivisionLabel(tree.regions, officer.regionId ?? null),
    battalionId: officer.battalionId ?? null,
    battalionText: findLabel(tree.battalions, (b) => b.nameTh, officer.battalionId ?? null),
    companyId: officer.companyId ?? null,
    companyText: findLabel(tree.companies, (c) => c.nameTh, officer.companyId ?? null),
    nickname: officer.nickname ?? "",
    dateOfBirth: toDateInputValue(officer.dateOfBirth),
    bloodGroup: officer.bloodGroup ?? "",
    rh: officer.rh ?? "",
    maritalStatus: officer.maritalStatus ?? "",
    children: officer.children != null ? String(officer.children) : "",
    homeProvince: officer.homeProvince ?? "",
    shirtSize: officer.shirtSize ?? "",
    nationality: officer.nationality ?? "",
    citizenId: officer.citizenId ?? "",
    passportNumber: officer.passportNumber ?? "",
    employeeNumber: officer.employeeNumber ?? "",
    emergencyContact: officer.emergencyContact ?? "",
    emergencyPhone: officer.emergencyPhone ?? "",
    addressSummary: officer.addressSummary ?? "",
    currentProvince: officer.currentProvince ?? "",
    religion: officer.religion ?? "",
    educationLevel: officer.educationLevel ?? "",
    weightKg: officer.weightKg != null ? String(officer.weightKg) : "",
    heightCm: officer.heightCm != null ? String(officer.heightCm) : "",
    uniformShoeSize: officer.uniformShoeSize ?? "",
    hatSize: officer.hatSize ?? "",
    jacketSize: officer.jacketSize ?? "",
  };
}

/** Looks up a row's display label from the org tree by id, or "" when unset/unresolved (never invented). */
function findLabel<T extends { id: number }>(rows: readonly T[], label: (row: T) => string, id: number | null): string {
  if (id === null) return "";
  const row = rows.find((r) => r.id === id);
  return row ? label(row) : "";
}

/** The Border Patrol Division combobox's display label ("ตชด.ภ.4") for a persisted regionId, or "" when unset/unresolved. */
function findDivisionLabel(regions: OrgTree["regions"], regionId: number | null): string {
  if (regionId === null) return "";
  const region = regions.find((r) => r.id === regionId);
  return region ? divisionLabelForRegion(region) : "";
}

function toTimelineDrafts(officer: OfficerWithRelations, tree: OrgTree): TimelineDraftRow[] {
  return [...officer.timeline]
    .sort((a, b) => a.sequence - b.sequence)
    .map((t) => ({
      key: newKey(),
      year: t.year,
      rank: t.rank ?? "",
      position: t.position,
      unit: t.unit ?? "",
      source: t.source ?? "",
      verified: t.verified,
      day: t.day ?? null,
      month: t.month ?? null,
      yearBE: t.yearBE ?? null,
      isPresent: t.isPresent ?? false,
      headquartersId: t.headquartersId ?? null,
      headquartersText: findLabel(tree.headquarters, (h) => h.nameTh, t.headquartersId ?? null),
      regionId: t.regionId ?? null,
      regionText: findDivisionLabel(tree.regions, t.regionId ?? null),
      battalionId: t.battalionId ?? null,
      battalionText: findLabel(tree.battalions, (b) => b.nameTh, t.battalionId ?? null),
      companyId: t.companyId ?? null,
      companyText: findLabel(tree.companies, (c) => c.nameTh, t.companyId ?? null),
      verificationStatus: t.verificationStatus ?? "",
      verifiedBy: t.verifiedBy ?? "",
      verifiedDate: toDateInputValue(t.verifiedDate),
      verificationRemark: t.verificationRemark ?? "",
    }));
}

function toEducationDrafts(officer: OfficerWithRelations): EducationDraftRow[] {
  return officer.education.map((e) => ({
    key: newKey(),
    year: e.year ?? "",
    institution: e.institution,
    degree: e.degree ?? "",
    notes: e.notes ?? "",
  }));
}

function toTrainingDrafts(officer: OfficerWithRelations): TrainingDraftRow[] {
  return officer.training.map((t) => ({
    key: newKey(),
    year: t.year ?? "",
    course: t.course,
    organization: t.organization ?? "",
    notes: t.notes ?? "",
  }));
}

export function useOfficerWorkspace(officer: OfficerWithRelations, orgTree: OrgTree) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileDraft>(() => toProfileDraft(officer, orgTree));
  const [timeline, setTimeline] = useState<TimelineDraftRow[]>(() => toTimelineDrafts(officer, orgTree));
  const [education, setEducation] = useState<EducationDraftRow[]>(() => toEducationDrafts(officer));
  const [training, setTraining] = useState<TrainingDraftRow[]>(() => toTrainingDrafts(officer));

  const mutation = useSaveOfficerProfile();

  const startEditing = useCallback(() => {
    setProfile(toProfileDraft(officer, orgTree));
    setTimeline(toTimelineDrafts(officer, orgTree));
    setEducation(toEducationDrafts(officer));
    setTraining(toTrainingDrafts(officer));
    setEditing(true);
  }, [officer, orgTree]);

  const cancel = useCallback(() => {
    setEditing(false);
    mutation.reset();
  }, [mutation]);

  const save = useCallback(async () => {
    const body: OfficerProfileSaveRequest = {
      profile: {
        rank: profile.rank,
        firstName: profile.firstName,
        lastName: profile.lastName,
        currentPosition: profile.currentPosition.trim() || null,
        // The legacy free-text currentUnit is DERIVED from the most specific
        // resolved org level (company > battalion > region > headquarters)
        // whenever the Current Organization picker has resolved a
        // selection, so every reader that still displays currentUnit (or
        // hasn't been migrated to the structured org fields yet) keeps
        // showing an accurate value — never overwritten with a guess when no
        // structured selection exists.
        currentUnit: (profile.companyText || profile.battalionText || profile.regionText || profile.headquartersText || profile.currentUnit).trim() || null,
        phone: profile.phone.trim() || null,
        email: profile.email.trim() || null,
        lineId: profile.lineId.trim() || null,
        facebookUrl: profile.facebookUrl.trim() || null,
        headquartersId: profile.headquartersId,
        regionId: profile.regionId,
        battalionId: profile.battalionId,
        companyId: profile.companyId,
        nickname: profile.nickname.trim() || null,
        dateOfBirth: profile.dateOfBirth.trim() || null,
        bloodGroup: profile.bloodGroup.trim() || null,
        rh: profile.rh.trim() || null,
        maritalStatus: profile.maritalStatus.trim() || null,
        children: profile.children.trim() ? Number(profile.children) : null,
        homeProvince: profile.homeProvince.trim() || null,
        shirtSize: profile.shirtSize.trim() || null,
        nationality: profile.nationality.trim() || null,
        citizenId: profile.citizenId.trim() || null,
        passportNumber: profile.passportNumber.trim() || null,
        employeeNumber: profile.employeeNumber.trim() || null,
        emergencyContact: profile.emergencyContact.trim() || null,
        emergencyPhone: profile.emergencyPhone.trim() || null,
        addressSummary: profile.addressSummary.trim() || null,
        currentProvince: profile.currentProvince.trim() || null,
        religion: profile.religion.trim() || null,
        educationLevel: profile.educationLevel.trim() || null,
        weightKg: profile.weightKg.trim() ? Number(profile.weightKg) : null,
        heightCm: profile.heightCm.trim() ? Number(profile.heightCm) : null,
        uniformShoeSize: profile.uniformShoeSize.trim() || null,
        hatSize: profile.hatSize.trim() || null,
        jacketSize: profile.jacketSize.trim() || null,
      },
      // Phase 26A stabilization (bug #1): a row added via "เพิ่มแถว" but
      // never filled in (still fully blank) previously reached the server
      // as-is and failed the required position/institution/course
      // validation with "Invalid officer profile save request" — the row
      // was never meant to be saved, only started. Drop untouched-blank
      // rows here rather than loosening the server's structural
      // validation (which exists to guard real data — Phase 23B's own
      // docstring is explicit that CONTENT is tolerated but STRUCTURE
      // still is not).
      timeline: timeline
        .filter((row) => row.year.trim() || row.position.trim() || row.unit.trim() || row.yearBE != null)
        .map((row, i) => {
        // The legacy free-text `year` is DERIVED from the structured fields
        // whenever the row has been edited through the new Day/Month/Year
        // dropdowns (yearBE set), so every reader that still displays `year`
        // (or hasn't been migrated to the structured fields yet) keeps
        // showing an accurate value. A row the user never touched in the new
        // editor (yearBE still null) keeps its original free-text `year`
        // verbatim — never overwritten with a guess.
        const year = row.yearBE != null ? formatThaiDate(row) : row.year;
        // The legacy free-text `unit` is DERIVED from the most specific
        // resolved org level (company > battalion > region > headquarters)
        // whenever the row has been linked through the new hierarchy
        // pickers, so every reader that still displays `unit` (or hasn't
        // been migrated to the structured org fields yet) keeps showing an
        // accurate value. A row with no structured org selection keeps its
        // original free-text `unit` verbatim — never overwritten with a guess.
        const resolvedUnitText = row.companyText || row.battalionText || row.regionText || row.headquartersText;
        const unit = resolvedUnitText || row.unit;
        return {
          sequence: i,
          year: year.trim() || "-",
          yearValue: row.yearBE ?? (/^\d+$/.test(row.year) ? Number(row.year) : null),
          rank: row.rank.trim() || null,
          // Server requires a non-empty position (Zod min(1)); a row with
          // other real content (year/unit) but no position yet is a
          // genuine partial edit worth keeping, not silently dropped — "-"
          // is a visible placeholder the user can fill in on the next edit,
          // never a guess at real data.
          position: row.position.trim() || "-",
          unit: unit.trim() || null,
          source: row.source.trim() || null,
          verified: row.verified || "ยังไม่ตรวจ",
          day: row.day,
          month: row.month,
          yearBE: row.yearBE,
          isPresent: row.isPresent,
          headquartersId: row.headquartersId,
          regionId: row.regionId,
          battalionId: row.battalionId,
          companyId: row.companyId,
          verificationStatus: row.verificationStatus || null,
          verifiedBy: row.verifiedBy.trim() || null,
          verifiedDate: row.verifiedDate.trim() || null,
          verificationRemark: row.verificationRemark.trim() || null,
        };
        }),
      // Phase 26A stabilization (bug #1): same untouched-blank-row filter as timeline above.
      education: education
        .filter((row) => row.year.trim() || row.institution.trim() || row.degree.trim() || row.notes.trim())
        .map((row) => ({
          year: row.year.trim() || null,
          institution: row.institution.trim() || "-",
          degree: row.degree.trim() || null,
          notes: row.notes.trim() || null,
        })),
      training: training
        .filter((row) => row.year.trim() || row.course.trim() || row.organization.trim() || row.notes.trim())
        .map((row) => ({
          year: row.year.trim() || null,
          course: row.course.trim() || "-",
          organization: row.organization.trim() || null,
          notes: row.notes.trim() || null,
        })),
    };

    await mutation.mutateAsync({ officerId: officer.officerId, body });
    setEditing(false);
  }, [profile, timeline, education, training, officer.officerId, mutation]);

  return {
    editing,
    startEditing,
    cancel,
    save,
    isSaving: mutation.isPending,
    saveError: mutation.error,
    profile,
    setProfile,
    timeline,
    setTimeline,
    education,
    setEducation,
    training,
    setTraining,
    newRowKey: newKey,
  };
}

export type OfficerWorkspaceState = ReturnType<typeof useOfficerWorkspace>;

/** Re-exported so section components can build a fresh empty row without importing internals. */
export function emptyTimelineRow(): TimelineDraftRow {
  return {
    key: newKey(),
    year: "",
    rank: "",
    position: "",
    unit: "",
    source: "",
    verified: "ยังไม่ตรวจ",
    day: null,
    month: null,
    yearBE: null,
    isPresent: false,
    headquartersId: null,
    headquartersText: "",
    regionId: null,
    regionText: "",
    battalionId: null,
    battalionText: "",
    companyId: null,
    companyText: "",
    verificationStatus: "",
    verifiedBy: "",
    verifiedDate: "",
    verificationRemark: "",
  };
}

export function emptyEducationRow(): EducationDraftRow {
  return { key: newKey(), year: "", institution: "", degree: "", notes: "" };
}

export function emptyTrainingRow(): TrainingDraftRow {
  return { key: newKey(), year: "", course: "", organization: "", notes: "" };
}

export type { CareerTimelineRow };
