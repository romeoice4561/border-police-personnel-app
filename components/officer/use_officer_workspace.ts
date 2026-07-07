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
  year: string;
  rank: string;
  position: string;
  unit: string;
  source: string;
  verified: string;
}

let nextKey = 1;
/** Generates a stable client-side key for a new draft row (never persisted — replaced by the DB id on reload). */
function newKey(): string {
  return `draft-${nextKey++}`;
}

function toProfileDraft(officer: OfficerWithRelations): ProfileDraft {
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
  };
}

function toTimelineDrafts(officer: OfficerWithRelations): TimelineDraftRow[] {
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

export function useOfficerWorkspace(officer: OfficerWithRelations) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileDraft>(() => toProfileDraft(officer));
  const [timeline, setTimeline] = useState<TimelineDraftRow[]>(() => toTimelineDrafts(officer));
  const [education, setEducation] = useState<EducationDraftRow[]>(() => toEducationDrafts(officer));
  const [training, setTraining] = useState<TrainingDraftRow[]>(() => toTrainingDrafts(officer));

  const mutation = useSaveOfficerProfile();

  const startEditing = useCallback(() => {
    setProfile(toProfileDraft(officer));
    setTimeline(toTimelineDrafts(officer));
    setEducation(toEducationDrafts(officer));
    setTraining(toTrainingDrafts(officer));
    setEditing(true);
  }, [officer]);

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
        currentUnit: profile.currentUnit.trim() || null,
        phone: profile.phone.trim() || null,
        email: profile.email.trim() || null,
        lineId: profile.lineId.trim() || null,
        facebookUrl: profile.facebookUrl.trim() || null,
      },
      timeline: timeline.map((row, i) => ({
        sequence: i,
        year: row.year,
        yearValue: /^\d+$/.test(row.year) ? Number(row.year) : null,
        rank: row.rank.trim() || null,
        position: row.position,
        unit: row.unit.trim() || null,
        source: row.source.trim() || null,
        verified: row.verified || "ยังไม่ตรวจ",
      })),
      education: education.map((row) => ({
        year: row.year.trim() || null,
        institution: row.institution,
        degree: row.degree.trim() || null,
        notes: row.notes.trim() || null,
      })),
      training: training.map((row) => ({
        year: row.year.trim() || null,
        course: row.course,
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
  return { key: newKey(), year: "", rank: "", position: "", unit: "", source: "", verified: "ยังไม่ตรวจ" };
}

export function emptyEducationRow(): EducationDraftRow {
  return { key: newKey(), year: "", institution: "", degree: "", notes: "" };
}

export function emptyTrainingRow(): TrainingDraftRow {
  return { key: newKey(), year: "", course: "", organization: "", notes: "" };
}

export type { CareerTimelineRow };
