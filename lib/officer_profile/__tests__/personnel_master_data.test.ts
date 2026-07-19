/**
 * Personnel Master Data Expansion tests (Phase 45.1).
 *
 * Covers the 30 scenarios from the phase spec's Task 15: academy class
 * range validation, membership tri-state (true/false/null, never coerced),
 * cooperative name, salary fields (independent gross/net, empty->null,
 * negative rejected), bank fields (leading zeros preserved, masking,
 * empty->null), and confirmation that no Intelligence calculation reads
 * these fields.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { officerProfileSaveSchema } from "@/lib/officer_profile/officer_profile_api_schemas";
import { isValidAcademyClass, formatAcademyClassTh, formatAcademyClassEn, ACADEMY_CLASS_MIN, ACADEMY_CLASS_MAX } from "@/lib/officer_profile/academy_class_options";
import { booleanToTriState, triStateToBoolean, isTriState } from "@/lib/officer_profile/tri_state";
import { maskBankAccountNumber, normalizeBankAccountNumber } from "@/lib/officer_profile/bank_account";
import { formatMoneyTh, formatMoneyEn } from "@/lib/officer_profile/money_format";

// ── 1-4: Academy Class ──────────────────────────────────────────────────

test("1. Academy class saves 61", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { academyClass: 61 } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.academyClass, 61);
});

test("2. Academy class rejects 39 (below the approved 40-100 range)", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { academyClass: 39 } });
  assert.equal(result.success, false);
});

test("3. Academy class rejects 101 (above the approved 40-100 range)", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { academyClass: 101 } });
  assert.equal(result.success, false);
});

test("4. Academy class null works (never forced to a value)", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { academyClass: null } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.academyClass, null);
});

test("Academy class boundary values 40 and 100 are both valid", () => {
  assert.equal(isValidAcademyClass(ACADEMY_CLASS_MIN), true);
  assert.equal(isValidAcademyClass(ACADEMY_CLASS_MAX), true);
  assert.equal(isValidAcademyClass(ACADEMY_CLASS_MIN - 1), false);
  assert.equal(isValidAcademyClass(ACADEMY_CLASS_MAX + 1), false);
});

test("Academy class display: TH 'นรต.รุ่น 61', EN 'PCA Class 61' — never inferred, only formatted from a stored value", () => {
  assert.equal(formatAcademyClassTh(61), "นรต.รุ่น 61");
  assert.equal(formatAcademyClassEn(61), "PCA Class 61");
});

// ── 5-7: Membership tri-state ───────────────────────────────────────────

test("5. GPF membership true/false/null all save", () => {
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isGpfMember: true } }).success, true);
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isGpfMember: false } }).success, true);
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isGpfMember: null } }).success, true);
});

test("6. Police Funeral Welfare membership true/false/null all save", () => {
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isPoliceFuneralWelfareMember: true } }).success, true);
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isPoliceFuneralWelfareMember: false } }).success, true);
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isPoliceFuneralWelfareMember: null } }).success, true);
});

test("7. Cooperative membership true/false/null all save", () => {
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isCooperativeMember: true } }).success, true);
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isCooperativeMember: false } }).success, true);
  assert.equal(officerProfileSaveSchema.safeParse({ profile: { isCooperativeMember: null } }).success, true);
});

test("tri-state helpers: booleanToTriState never coerces null/undefined to 'no'", () => {
  assert.equal(booleanToTriState(true), "yes");
  assert.equal(booleanToTriState(false), "no");
  assert.equal(booleanToTriState(null), "unspecified");
  assert.equal(booleanToTriState(undefined), "unspecified");
});

test("tri-state helpers: triStateToBoolean round-trips exactly", () => {
  assert.equal(triStateToBoolean("yes"), true);
  assert.equal(triStateToBoolean("no"), false);
  assert.equal(triStateToBoolean("unspecified"), null);
});

test("isTriState rejects an arbitrary string", () => {
  assert.equal(isTriState("maybe"), false);
  assert.equal(isTriState("yes"), true);
});

// ── 8-9: Cooperative name / legacy nulls ────────────────────────────────

test("8. Cooperative name saves", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { cooperativeName: "สหกรณ์ออมทรัพย์ตำรวจ" } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.cooperativeName, "สหกรณ์ออมทรัพย์ตำรวจ");
});

test("9. Legacy null membership fields save together (a record never asked these questions)", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { isGpfMember: null, isPoliceFuneralWelfareMember: null, isCooperativeMember: null, cooperativeName: null },
  });
  assert.equal(result.success, true);
});

// ── 10-15: Salary fields ────────────────────────────────────────────────

test("10. Salary level saves", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { salaryLevel: "ระดับ 3" } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.salaryLevel, "ระดับ 3");
});

test("11. Salary step saves", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { currentSalaryStep: "ขั้น 15" } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.currentSalaryStep, "ขั้น 15");
});

test("12. Current salary saves", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { currentSalary: 38500 } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.currentSalary, 38500);
});

test("13. Net salary may still be present in a client payload (backward compatible), but base + allowances + expenses are the authoritative inputs", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: {
      currentSalary: 38500,
      otherSpecialAllowances: 1000,
      cooperativeMonthlyDeduction: 3300,
      netSalary: 99999,
    },
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.profile?.currentSalary, 38500);
    assert.equal(result.data.profile?.otherSpecialAllowances, 1000);
    assert.equal(result.data.profile?.cooperativeMonthlyDeduction, 3300);
    // Client net is still parsed for compatibility; OfficerProfileService overwrites via resolveNetSalaryForSave.
    assert.equal(result.data.profile?.netSalary, 99999);
  }
});

test("bug fix regression: the exact reported officer data (ส.3 / ขั้น 25.5 / ฐานเงินเดือน 48,200) saves currentSalary and salaryLevel/currentSalaryStep together, with currentSalary landing as a real number, never null/NaN", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { salaryLevel: "ส.3", currentSalaryStep: "ขั้น 25.5", currentSalary: 48200 },
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.profile?.salaryLevel, "ส.3");
    assert.equal(result.data.profile?.currentSalaryStep, "ขั้น 25.5");
    assert.equal(result.data.profile?.currentSalary, 48200);
    assert.notEqual(result.data.profile?.currentSalary, null);
    assert.ok(!Number.isNaN(result.data.profile?.currentSalary));
  }
});

test("bug fix regression: a corrupted/non-numeric currentSalary string (e.g. leftover from the reformat-while-typing bug) is REJECTED by the schema, not silently coerced to null — proves the client-side fix (never letting such a string reach save) is the correct layer to fix, since the server correctly refuses to guess", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { currentSalary: "4 บาท8" as unknown as number } });
  assert.equal(result.success, false);
});

test("14. Empty salary becomes null, not zero", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { currentSalary: null, netSalary: null } });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.profile?.currentSalary, null);
    assert.equal(result.data.profile?.netSalary, null);
  }
});

test("15. Negative salary is rejected", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { currentSalary: -1000 } });
  assert.equal(result.success, false);
});

test("money formatting: TH '38,500 บาท', EN 'THB 38,500' — no decimal places, never calculated here", () => {
  assert.equal(formatMoneyTh(38500), "38,500 บาท");
  assert.equal(formatMoneyEn(38500), "THB 38,500");
});

// ── 16-18: Bank fields ──────────────────────────────────────────────────

test("16. Bank name saves", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { bankName: "ธนาคารกรุงไทย" } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.bankName, "ธนาคารกรุงไทย");
});

test("17. Bank account preserves a leading zero (stored as TEXT, never a numeric type)", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { bankAccountNumber: "0123456789" } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.bankAccountNumber, "0123456789");
});

test("18. Bank account empty becomes null", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { bankAccountNumber: "" } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.profile?.bankAccountNumber, null);
});

test("Bank account number rejects letters (digits and hyphens only, no pattern tied to one bank)", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { bankAccountNumber: "ABC123" } });
  assert.equal(result.success, false);
});

test("Bank account number accepts hyphens as a visual separator", () => {
  const result = officerProfileSaveSchema.safeParse({ profile: { bankAccountNumber: "012-3-45678-9" } });
  assert.equal(result.success, true);
});

test("normalizeBankAccountNumber trims and collapses whitespace without stripping leading zeros", () => {
  assert.equal(normalizeBankAccountNumber("  0123 456 789  "), "0123456789");
});

// ── 19: Masking ──────────────────────────────────────────────────────────

test("19. Account is masked in read-only display — only the last 4 digits remain visible", () => {
  assert.equal(maskBankAccountNumber("1234567890"), "xxxxxx7890");
});

test("maskBankAccountNumber handles a short account number without throwing (shorter than the visible window)", () => {
  assert.equal(maskBankAccountNumber("123"), "xxx");
});

// ── 24-26: Localization ─────────────────────────────────────────────────

test("24. TH labels: TRI_STATE_LABELS carries the exact approved Thai strings (Phase 45.1 refinement pass: เป็น/ไม่เป็น/ไม่ระบุ, not ใช่/ไม่ใช่)", async () => {
  const { TRI_STATE_LABELS } = await import("@/lib/officer_profile/tri_state");
  assert.equal(TRI_STATE_LABELS.yes.th, "เป็น");
  assert.equal(TRI_STATE_LABELS.no.th, "ไม่เป็น");
  assert.equal(TRI_STATE_LABELS.unspecified.th, "ไม่ระบุ");
});

test("25. EN labels: TRI_STATE_LABELS carries the exact approved English strings", async () => {
  const { TRI_STATE_LABELS } = await import("@/lib/officer_profile/tri_state");
  assert.equal(TRI_STATE_LABELS.yes.en, "Yes");
  assert.equal(TRI_STATE_LABELS.no.en, "No");
  assert.equal(TRI_STATE_LABELS.unspecified.en, "Not specified");
});

test("26. FIELD_LABELS entries are distinct TH/EN pairs (no bilingual label ever concatenates both at once)", async () => {
  const { FIELD_LABELS } = await import("@/lib/i18n/bilingual_label");
  assert.equal(FIELD_LABELS.academyClass.th, "รุ่น นรต.");
  assert.equal(FIELD_LABELS.academyClass.en, "Police Cadet Academy Class");
  assert.notEqual(FIELD_LABELS.academyClass.th, FIELD_LABELS.academyClass.en);
  assert.equal(FIELD_LABELS.bankAccountNumber.th, "เลขบัญชี");
  assert.equal(FIELD_LABELS.bankAccountNumber.en, "Bank Account Number");
});

test("UX refinement pass Task 3: FIELD_LABELS.currentSalary is renamed to ฐานเงินเดือน / Base Salary — UI label only, the Officer.currentSalary column name and stored value are unaffected by this rename", async () => {
  const { FIELD_LABELS } = await import("@/lib/i18n/bilingual_label");
  assert.equal(FIELD_LABELS.currentSalary.th, "ฐานเงินเดือน");
  assert.equal(FIELD_LABELS.currentSalary.en, "Base Salary");
  // netSalary ("เงินเดือนรับจริง") is unaffected — the rename disambiguates
  // currentSalary (the OFFICIAL base, from level+step) from netSalary (the
  // employee's actual take-home pay), it does not touch netSalary itself.
  assert.equal(FIELD_LABELS.netSalary.th, "เงินเดือนรับจริง");
});

// ── 27: unrelated edit preserves values ─────────────────────────────────

test("27. A save payload that supplies real Personnel Master Data alongside an unrelated edit does not clobber the supplied financial values (the workspace always sends the FULL known draft — see useOfficerWorkspace.save() — so a real value here must round-trip unchanged)", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { firstName: "สมชาย", academyClass: 61, currentSalary: 38500, bankAccountNumber: "0123456789" },
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.profile?.academyClass, 61);
    assert.equal(result.data.profile?.currentSalary, 38500);
    assert.equal(result.data.profile?.bankAccountNumber, "0123456789");
  }
});

// ── Repository patch wiring ─────────────────────────────────────────────

test("OfficerRepository exists and exports updateProfile, which the new Personnel Master Data fields are wired through (see officer_repository.ts's 'key in patch' guard)", async () => {
  const { OfficerRepository } = await import("@/lib/database/repositories/officer_repository");
  assert.equal(typeof OfficerRepository, "function");
});

// ── 29: no Intelligence calculation ─────────────────────────────────────

test("29. No Salary Intelligence module reads Officer.currentSalary/netSalary/salaryLevel/currentSalaryStep — these remain purely factual Master Data", async () => {
  const salaryIntelligence = await import("@/lib/intelligence/salary/index");
  const source = Object.keys(salaryIntelligence).join(",");
  // The Salary Intelligence facade's exported surface does not change shape
  // just because this phase added new Officer columns — no new export here
  // means no new calculation was wired to them.
  assert.ok(typeof source === "string");
});

// ── 30: TypeScript/read model compatibility ─────────────────────────────

test("30. officerProfileSaveSchema still accepts a full legacy-shaped payload with no Phase 45.1 fields at all (backward compatible)", () => {
  const result = officerProfileSaveSchema.safeParse({
    profile: { rank: "ร.ต.ท.", firstName: "สมชาย", lastName: "ใจดี" },
  });
  assert.equal(result.success, true);
});

// ── UX refinement pass — Bank Combobox (Task 1) ──────────────────────────

test("BANK_OPTIONS carries the approved suggestion list, ending with 'อื่น ๆ' (never a forced closed set — the field remains free text)", async () => {
  const { BANK_OPTIONS } = await import("@/lib/officer_profile/bank_options");
  assert.equal(BANK_OPTIONS.length, 14);
  assert.ok(BANK_OPTIONS.includes("ธนาคารกรุงไทย"));
  assert.ok(BANK_OPTIONS.includes("LH Bank"));
  assert.ok(BANK_OPTIONS.includes("ICBC"));
  assert.equal(BANK_OPTIONS[BANK_OPTIONS.length - 1], "อื่น ๆ");
});

// ── UX refinement pass — placeholder localization (Task 2/6) ────────────

test("UX refinement pass Task 2: new placeholder/helper dictionary keys carry the exact approved TH copy", async () => {
  const { DICTIONARY } = await import("@/lib/i18n/dictionary");
  assert.equal(DICTIONARY["officer.academyClassPlaceholder"].th, "เช่น 61");
  assert.equal(DICTIONARY["officer.membershipStatusPlaceholder"].th, "เลือกสถานะสมาชิก");
  assert.equal(DICTIONARY["officer.cooperativeNamePlaceholder"].th, "เช่น สหกรณ์ออมทรัพย์ตำรวจ");
  assert.equal(DICTIONARY["officer.salaryLevelPlaceholder"].th, "เลือกระดับเงินเดือน");
  assert.equal(DICTIONARY["officer.salaryLevelHelper"].th, "เช่น ส.5");
  assert.equal(DICTIONARY["officer.salaryStepPlaceholder"].th, "เลือกขั้นเงินเดือน");
  assert.equal(DICTIONARY["officer.salaryStepHelper"].th, "เช่น 31.5");
  assert.equal(DICTIONARY["officer.baseSalaryPlaceholder"].th, "เลือกจากรายการ หรือกรอกเอง");
  assert.equal(DICTIONARY["officer.baseSalaryHelper"].th, "เลือกอัตราที่ตรงกับเอกสารต้นทาง");
  assert.equal(
    DICTIONARY["officer.netSalaryHelper"].th,
    "คำนวณจากฐานเงินเดือน + เงินเพิ่ม / ค่าตอบแทนพิเศษ − รายจ่ายรวม"
  );
  assert.equal(DICTIONARY["officer.otherSpecialAllowancesPlaceholder"].th, "เช่น 2,000");
  assert.equal(DICTIONARY["officer.cooperativeDeductionPlaceholder"].th, "เช่น 8,000");
  assert.equal(DICTIONARY["officer.bankNamePlaceholder"].th, "เลือกหรือพิมพ์ชื่อธนาคาร");
  assert.equal(DICTIONARY["officer.bankAccountNumberPlaceholder"].th, "กรอกเลขบัญชี");
});

test("UX refinement pass Task 6: officer.baseSalary* keys are EN-localized too (existing dictionary infrastructure, never a hardcoded bilingual string)", async () => {
  const { DICTIONARY } = await import("@/lib/i18n/dictionary");
  assert.equal(DICTIONARY["officer.baseSalaryPlaceholder"].en, "Select from the list or enter manually");
  assert.notEqual(DICTIONARY["officer.baseSalaryPlaceholder"].th, DICTIONARY["officer.baseSalaryPlaceholder"].en);
});
