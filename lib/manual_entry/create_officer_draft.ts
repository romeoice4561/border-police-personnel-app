/**
 * Empty Manual Entry draft for create-mode OfficerWorkspace (Phase XX.1).
 *
 * Produces an in-memory OfficerWithRelations-shaped shell with source="manual"
 * so the canonical profile workspace can render without a DB row. Never
 * persisted as-is — ManualEntryService.create assigns the real officerId.
 */

import type { OfficerWithRelations } from "@/lib/database/query_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";

/** Sentinel officerId for the unsaved create draft — never written to the DB. */
export const CREATE_OFFICER_DRAFT_ID = "manual/new";

export const PLACEHOLDER_PORTRAIT: ResolvedOfficerPortrait = {
  driveFileId: null,
  thumbnailUrl: null,
  webViewUrl: null,
  source: "PLACEHOLDER",
};

/**
 * Builds an empty Manual Entry officer draft for `/officers/new`.
 * Callers pass this into OfficerWorkspace with mode="create".
 */
export function createEmptyManualOfficerDraft(): OfficerWithRelations {
  const now = new Date(0);
  return {
    id: 0,
    officerId: CREATE_OFFICER_DRAFT_ID,
    rank: "",
    firstName: "",
    lastName: "",
    currentPosition: null,
    currentUnit: null,
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    phone: null,
    qualityScore: null,
    knowledgeScore: null,
    region: null,
    confidence: null,
    dateOfBirth: null,
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitId: null,
    email: null,
    lineId: null,
    facebookUrl: null,
    nickname: null,
    bloodGroup: null,
    rh: null,
    maritalStatus: null,
    children: null,
    homeProvince: null,
    shirtSize: null,
    nationality: null,
    citizenId: null,
    passportNumber: null,
    employeeNumber: null,
    emergencyContact: null,
    emergencyPhone: null,
    addressSummary: null,
    currentProvince: null,
    religion: null,
    educationLevel: null,
    weightKg: null,
    heightCm: null,
    uniformShoeSize: null,
    hatSize: null,
    jacketSize: null,
    academyClass: null,
    isGpfMember: null,
    isPoliceFuneralWelfareMember: null,
    isCooperativeMember: null,
    cooperativeName: null,
    salaryLevel: null,
    currentSalaryStep: null,
    currentSalary: null,
    otherSpecialAllowances: null,
    cooperativeMonthlyDeduction: null,
    netSalary: null,
    bankName: null,
    bankAccountNumber: null,
    source: "manual",
    createdBy: null,
    createdByName: null,
    updatedBy: null,
    updatedByName: null,
    employmentStatus: null,
    policeServiceNumber: null,
    createdAt: now,
    updatedAt: now,
    timeline: [],
    phones: [],
    education: [],
    training: [],
    salaryHistory: [],
    documents: [],
    skills: [],
  } as unknown as OfficerWithRelations;
}
