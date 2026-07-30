/**
 * Create-mode save orchestration (Phase XX.1).
 *
 * Pure builders + sequential create → patch → portrait flow. No React.
 * Duplicate 409 is surfaced as CreateOfficerDuplicateError; partial failure
 * after a successful create is CreateOfficerPartialFailure.
 */

import {
  apiClient,
  ApiClientError,
  type ManualEntryCreateRequest,
  type ManualEntryDuplicateCandidate,
  type OfficerProfileSaveRequest,
} from "@/lib/ui/api_client";
import type { ProfileDraft, TimelineDraftRow } from "@/components/officer/use_officer_workspace";
import {
  uploadPendingCreatePortrait,
  type PendingCreatePortrait,
} from "@/lib/manual_entry/create_officer_portrait";

export class CreateOfficerDuplicateError extends Error {
  readonly candidates: ManualEntryDuplicateCandidate[];
  constructor(candidates: ManualEntryDuplicateCandidate[]) {
    super("A matching officer already exists");
    this.name = "CreateOfficerDuplicateError";
    this.candidates = candidates;
  }
}

export type CreateOfficerPartialStep = "profile" | "portrait";

export class CreateOfficerPartialFailure extends Error {
  readonly officerId: string;
  readonly failedStep: CreateOfficerPartialStep;
  constructor(officerId: string, failedStep: CreateOfficerPartialStep, cause?: unknown) {
    const stepTh = failedStep === "portrait" ? "อัปโหลดรูปโปรไฟล์" : "บันทึกข้อมูลเพิ่มเติม";
    super(
      `สร้างโปรไฟล์แล้ว แต่${stepTh}ไม่สำเร็จ — เปิดโปรไฟล์เพื่อแก้ไขต่อ`,
      cause instanceof Error ? { cause } : undefined
    );
    this.name = "CreateOfficerPartialFailure";
    this.officerId = officerId;
    this.failedStep = failedStep;
  }
}

export interface CreateOfficerSaveInput {
  profile: ProfileDraft;
  profileSaveBody: OfficerProfileSaveRequest;
  actorId: string;
  actorName: string;
  /** Optional appointment date DD/MM/YYYY (พ.ศ.) — seeds first timeline row on create. */
  appointmentDate?: string | null;
  pendingPortrait?: PendingCreatePortrait | null;
}

export interface CreateOfficerSaveSuccess {
  officerId: string;
}

/** Maps workspace ProfileDraft → Manual Entry create body (identity seed only). */
export function buildManualEntryCreateRequest(
  profile: ProfileDraft,
  actor: { actorId: string; actorName: string },
  appointmentDate?: string | null
): ManualEntryCreateRequest {
  const currentUnit =
    (profile.companyText || profile.battalionText || profile.regionText || profile.headquartersText || profile.currentUnit).trim() ||
    null;
  return {
    rank: profile.rank.trim(),
    firstName: profile.firstName.trim(),
    lastName: profile.lastName.trim(),
    nickname: profile.nickname.trim() || null,
    policeServiceNumber: profile.policeServiceNumber.trim() || null,
    citizenId: profile.citizenId.trim() || null,
    academyClass: profile.academyClass.trim() ? Number(profile.academyClass) : null,
    currentPosition: profile.currentPosition.trim() || null,
    currentUnit,
    region: profile.regionText.trim() || profile.currentProvince.trim() || null,
    dateOfBirth: profile.dateOfBirth.trim() || null,
    appointmentDate: appointmentDate?.trim() || null,
    phone: profile.phone.trim() || null,
    email: profile.email.trim() || null,
    employmentStatus: profile.employmentStatus.trim() || null,
    actorId: actor.actorId,
    actorName: actor.actorName,
  };
}

/**
 * Best-effort appointment date from the earliest structured timeline draft
 * (for ManualEntryService's optional first-timeline seed). Returns null when
 * no row has a complete day/month/yearBE.
 */
export function appointmentDateFromTimelineDrafts(timeline: readonly TimelineDraftRow[]): string | null {
  for (const row of timeline) {
    if (row.day != null && row.month != null && row.yearBE != null) {
      const dd = String(row.day).padStart(2, "0");
      const mm = String(row.month).padStart(2, "0");
      return `${dd}/${mm}/${row.yearBE}`;
    }
  }
  return null;
}

/** True when create can proceed (rank + first + last name required). */
export function validateCreateIdentity(profile: ProfileDraft): boolean {
  return Boolean(profile.rank.trim() && profile.firstName.trim() && profile.lastName.trim());
}

/**
 * create officer → patch extended profile → optional portrait → success.
 * Throws CreateOfficerDuplicateError | CreateOfficerPartialFailure | Error.
 */
export async function runCreateOfficerSave(input: CreateOfficerSaveInput): Promise<CreateOfficerSaveSuccess> {
  const createBody = buildManualEntryCreateRequest(
    input.profile,
    { actorId: input.actorId, actorName: input.actorName },
    input.appointmentDate
  );

  let officerId: string;
  try {
    const created = await apiClient.createOfficer(createBody);
    officerId = created.officerId;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 409) {
      const candidates = (error.details as { candidates?: ManualEntryDuplicateCandidate[] } | undefined)?.candidates ?? [];
      throw new CreateOfficerDuplicateError(candidates);
    }
    throw error;
  }

  try {
    await apiClient.saveOfficerProfile(officerId, input.profileSaveBody);
  } catch (error) {
    throw new CreateOfficerPartialFailure(officerId, "profile", error);
  }

  if (input.pendingPortrait) {
    try {
      await uploadPendingCreatePortrait(officerId, input.pendingPortrait);
    } catch (error) {
      throw new CreateOfficerPartialFailure(officerId, "portrait", error);
    }
  }

  return { officerId };
}
