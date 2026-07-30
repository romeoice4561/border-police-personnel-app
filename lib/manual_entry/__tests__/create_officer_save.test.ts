/**
 * Create-mode save builders / validation (Phase XX.1).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentDateFromTimelineDrafts,
  buildManualEntryCreateRequest,
  CreateOfficerDuplicateError,
  CreateOfficerPartialFailure,
  validateCreateIdentity,
} from "@/lib/manual_entry/create_officer_save";
import type { ProfileDraft, TimelineDraftRow } from "@/components/officer/use_officer_workspace";
import { emptyTimelineRow } from "@/components/officer/use_officer_workspace";

function blankProfile(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return {
    rank: "",
    firstName: "",
    lastName: "",
    currentPosition: "",
    currentUnit: "",
    phone: "",
    email: "",
    lineId: "",
    facebookUrl: "",
    headquartersId: null,
    headquartersText: "",
    regionId: null,
    regionText: "",
    battalionId: null,
    battalionText: "",
    companyId: null,
    companyText: "",
    nickname: "",
    dateOfBirth: "",
    bloodGroup: "",
    rh: "",
    maritalStatus: "",
    children: "",
    homeProvince: "",
    shirtSize: "",
    nationality: "",
    citizenId: "",
    policeServiceNumber: "",
    employmentStatus: "",
    passportNumber: "",
    employeeNumber: "",
    emergencyContact: "",
    emergencyPhone: "",
    addressSummary: "",
    currentProvince: "",
    religion: "",
    educationLevel: "",
    weightKg: "",
    heightCm: "",
    uniformShoeSize: "",
    hatSize: "",
    jacketSize: "",
    academyClass: "",
    isGpfMember: "unspecified",
    isPoliceFuneralWelfareMember: "unspecified",
    isCooperativeMember: "unspecified",
    cooperativeName: "",
    salaryLevel: "",
    currentSalaryStep: "",
    currentSalary: "",
    otherSpecialAllowances: "",
    cooperativeMonthlyDeduction: "",
    netSalary: "",
    bankName: "",
    bankAccountNumber: "",
    ...overrides,
  };
}

test("validateCreateIdentity requires rank + first + last name", () => {
  assert.equal(validateCreateIdentity(blankProfile()), false);
  assert.equal(validateCreateIdentity(blankProfile({ rank: "ร.ต.อ.", firstName: "สมชาย", lastName: "ใจดี" })), true);
});

test("buildManualEntryCreateRequest maps draft identity and derived unit", () => {
  const body = buildManualEntryCreateRequest(
    blankProfile({
      rank: "ร.ต.อ.",
      firstName: "สมชาย",
      lastName: "ใจดี",
      nickname: "ชาย",
      policeServiceNumber: "12345",
      citizenId: "1101700123456",
      companyText: "กองร้อย 1",
      battalionText: "กก.ตชด.41",
      currentPosition: "สารวัตร",
      dateOfBirth: "01/01/2530",
      phone: "0812345678",
      email: "a@example.com",
      employmentStatus: "ปฏิบัติราชการ",
      academyClass: "61",
    }),
    { actorId: "mock:admin", actorName: "Administrator" },
    "15/04/2555"
  );

  assert.equal(body.rank, "ร.ต.อ.");
  assert.equal(body.firstName, "สมชาย");
  assert.equal(body.lastName, "ใจดี");
  assert.equal(body.currentUnit, "กองร้อย 1");
  assert.equal(body.policeServiceNumber, "12345");
  assert.equal(body.appointmentDate, "15/04/2555");
  assert.equal(body.actorId, "mock:admin");
  assert.equal(body.academyClass, 61);
});

test("appointmentDateFromTimelineDrafts uses first structured date", () => {
  const row: TimelineDraftRow = {
    ...emptyTimelineRow(),
    day: 5,
    month: 12,
    yearBE: 2560,
    position: "สารวัตร",
  };
  assert.equal(appointmentDateFromTimelineDrafts([emptyTimelineRow(), row]), "05/12/2560");
  assert.equal(appointmentDateFromTimelineDrafts([emptyTimelineRow()]), null);
});

test("CreateOfficerPartialFailure carries officerId and failed step", () => {
  const err = new CreateOfficerPartialFailure("manual/abc", "portrait");
  assert.equal(err.officerId, "manual/abc");
  assert.equal(err.failedStep, "portrait");
  assert.match(err.message, /สร้างโปรไฟล์แล้ว/);
});

test("CreateOfficerDuplicateError carries candidates", () => {
  const err = new CreateOfficerDuplicateError([
    { officerId: "ภาค1/1", firstName: "ก", lastName: "ข", rank: "ร.ต.อ.", reasons: ["citizenId"] },
  ]);
  assert.equal(err.candidates.length, 1);
  assert.equal(err.candidates[0].officerId, "ภาค1/1");
});
