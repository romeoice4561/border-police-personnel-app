/**
 * Phase 40B — Data Standardization & Thai Government Date Foundation.
 *
 * Tests for the new shared date-domain utilities (exact_duration, thai_date,
 * fiscal_year) and the strengthened Age/Service/Retirement Intelligence
 * facades. All tests use a fixed, explicit `asOf` — never the real current
 * date — so results are deterministic regardless of when the suite runs.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { computeExactDuration, formatExactDurationTh, formatExactDurationCompactTh } from "@/lib/intelligence/shared/exact_duration";
import {
  toBuddhistEraYear,
  formatBuddhistEraYearTh,
  formatCompactBuddhistEraYearTh,
  formatFullThaiDateTh,
  formatShortThaiDateTh,
} from "@/lib/intelligence/shared/thai_date";
import { computeFiscalYearSummary } from "@/lib/intelligence/shared/fiscal_year";
import { computeAgeSummary } from "@/lib/intelligence/age";
import { computeRetirementSummary } from "@/lib/intelligence/retirement";
import { computeServiceSummary } from "@/lib/intelligence/service";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officerWithTimeline(overrides: Partial<OfficerWithRelations> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "OFF-1",
    rank: "ร.ต.อ.",
    firstName: "ทดสอบ",
    lastName: "ระบบ",
    currentPosition: "รอง สว.",
    currentUnit: "กก.1",
    phone: null,
    careerYears: 0,
    qualityScore: null,
    knowledgeScore: null,
    region: null,
    confidence: null,
    driveFileId: null,
    thumbnailUrl: null,
    webViewUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    regionId: null,
    battalionId: null,
    companyId: null,
    headquartersId: null,
    email: null,
    lineId: null,
    facebookUrl: null,
    nickname: null,
    dateOfBirth: null,
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
    officialPortraitId: null,
    timeline: [],
    phones: [],
    education: [],
    training: [],
    salaryHistory: [],
    documents: [],
    skills: [],
    ...overrides,
  } as unknown as OfficerWithRelations;
}

// ---------------------------------------------------------------------------
// 1. Exact age calculation
// ---------------------------------------------------------------------------
test("exact age calculation returns years/months/days, no decimal", () => {
  const summary = computeAgeSummary(utcDate(1985, 8, 11), utcDate(2026, 7, 17));
  assert.equal(summary.available, true);
  assert.deepEqual(summary.exactAge, { years: 40, months: 11, days: 6 });
  assert.equal(summary.displayAgeTh, "40 ปี 11 เดือน 6 วัน");
});

// ---------------------------------------------------------------------------
// 2. Birthday today
// ---------------------------------------------------------------------------
test("birthday today: daysUntilNextBirthday is 0, nextBirthdayDate is today", () => {
  const summary = computeAgeSummary(utcDate(1990, 7, 17), utcDate(2026, 7, 17));
  assert.equal(summary.available, true);
  assert.equal(summary.daysUntilNextBirthday, 0);
  assert.equal(summary.nextBirthdayDate, "2026-07-17");
  assert.equal(summary.nextBirthdayAge, 36);
});

// ---------------------------------------------------------------------------
// 3. Birthday tomorrow
// ---------------------------------------------------------------------------
test("birthday tomorrow: daysUntilNextBirthday is 1", () => {
  const summary = computeAgeSummary(utcDate(1990, 7, 18), utcDate(2026, 7, 17));
  assert.equal(summary.available, true);
  assert.equal(summary.daysUntilNextBirthday, 1);
  assert.equal(summary.nextBirthdayDate, "2026-07-18");
});

// ---------------------------------------------------------------------------
// 4. End-of-month dates
// ---------------------------------------------------------------------------
test("end-of-month birth date (31 Jan) computes age correctly across a shorter month", () => {
  const summary = computeAgeSummary(utcDate(1990, 1, 31), utcDate(2026, 2, 28));
  assert.equal(summary.available, true);
  // 1990-01-31 -> 2026-02-28 is 36 years, 0 months, 28 days (Jan 31 + 36y = 2026-01-31; to 2026-02-28 is 28 days).
  assert.deepEqual(summary.exactAge, { years: 36, months: 0, days: 28 });
});

// ---------------------------------------------------------------------------
// 5. Leap-day birth date
// ---------------------------------------------------------------------------
test("leap-day birth date (29 Feb) does not produce an invalid date on a non-leap asOf year", () => {
  const summary = computeAgeSummary(utcDate(2000, 2, 29), utcDate(2026, 2, 28));
  assert.equal(summary.available, true);
  assert.equal(Number.isNaN((summary.exactAge as unknown as { years: number }).years), false);
  // addYears clamps 29 Feb -> 28 Feb in a non-leap target year (matches lib/personnel_calendar/calendar.ts's addYears).
  assert.equal(summary.nextBirthdayDate, "2026-02-28");
});

// ---------------------------------------------------------------------------
// 6. Exact service duration
// ---------------------------------------------------------------------------
test("exact service duration derives from the earliest dated Timeline row", () => {
  const officer = officerWithTimeline({
    timeline: [
      { id: 10, sequence: 1, year: "2553", yearValue: 2553, position: "ผบ.หมู่", unit: "กก.1", rank: null, source: null, verified: "ยังไม่ตรวจ", positionLevel: null, day: 1, month: 4, yearBE: 2553, appointmentCycle: null, isPresent: false, effectiveDate: null, officerId: 1 },
      { id: 11, sequence: 2, year: "2560", yearValue: 2560, position: "รอง สว.", unit: "กก.1", rank: null, source: null, verified: "ยังไม่ตรวจ", positionLevel: null, day: 1, month: 1, yearBE: 2560, appointmentCycle: null, isPresent: false, effectiveDate: null, officerId: 1 },
    ] as unknown as OfficerWithRelations["timeline"],
  });
  const summary = computeServiceSummary(officer, utcDate(2026, 7, 17));
  assert.equal(summary.available, true);
  assert.equal(summary.serviceStartDate, "2010-04-01");
  assert.equal(summary.sourceTimelineEntryId, 10);
  assert.deepEqual(summary.exactServiceDuration, { years: 16, months: 3, days: 16 });
  assert.equal(summary.displayServiceDurationTh, "16 ปี 3 เดือน 16 วัน");
});

// ---------------------------------------------------------------------------
// 7. Missing service start date
// ---------------------------------------------------------------------------
test("missing service start date (no dated Timeline rows) is explicitly unavailable, not zero", () => {
  const officer = officerWithTimeline({ timeline: [] });
  const summary = computeServiceSummary(officer, utcDate(2026, 7, 17));
  assert.equal(summary.available, false);
  assert.equal(summary.reason, "NO_TRUSTWORTHY_TIMELINE_ENTRY");
  assert.equal(summary.serviceStartDate, null);
  assert.equal(summary.sourceTimelineEntryId, null);
  assert.equal(summary.exactServiceDuration, null);
});

// ---------------------------------------------------------------------------
// 8. Thai Buddhist Era formatting
// ---------------------------------------------------------------------------
test("Thai Buddhist Era formatting: full date, short date, year-only", () => {
  const date = utcDate(1985, 8, 11);
  assert.equal(toBuddhistEraYear(1985), 2528);
  assert.equal(formatFullThaiDateTh(date), "11 สิงหาคม 2528");
  assert.equal(formatShortThaiDateTh(date), "11 ส.ค. 2528");
  assert.equal(formatBuddhistEraYearTh(date), "พ.ศ. 2528");
  assert.equal(formatCompactBuddhistEraYearTh(date), "2528");
});

// ---------------------------------------------------------------------------
// 9. Fiscal year on 30 September
// ---------------------------------------------------------------------------
test("fiscal year on 30 September belongs to the fiscal year ending that day", () => {
  const summary = computeFiscalYearSummary(utcDate(2026, 9, 30));
  assert.equal(summary.fiscalYear, 2026);
  assert.equal(summary.fiscalYearBe, 2569);
  assert.equal(summary.displayFiscalYearTh, "ปีงบประมาณ 2569");
});

// ---------------------------------------------------------------------------
// 10. Fiscal year on 1 October
// ---------------------------------------------------------------------------
test("fiscal year on 1 October rolls forward to the next fiscal year", () => {
  const summary = computeFiscalYearSummary(utcDate(2026, 10, 1));
  assert.equal(summary.fiscalYear, 2027);
  assert.equal(summary.fiscalYearBe, 2570);
  assert.equal(summary.displayFiscalYearTh, "ปีงบประมาณ 2570");
});

// ---------------------------------------------------------------------------
// 11. Retirement calculation
// ---------------------------------------------------------------------------
test("retirement calculation returns exact remaining duration and Thai display text", () => {
  const summary = computeRetirementSummary(utcDate(1985, 9, 30), utcDate(2045, 9, 30));
  assert.equal(summary.available, true);
  assert.equal(summary.retirementFiscalYearBe, 2588);
  assert.equal(summary.displayRetirementDateTh, "30 กันยายน 2588");
  assert.equal(summary.displayRetirementYearTh, "ปีงบประมาณ 2588");
  assert.equal(summary.isRetired, false);
});

// ---------------------------------------------------------------------------
// 12. Birth date on 2 October (retirement fiscal-year rollover business rule)
// ---------------------------------------------------------------------------
test("officer born 2 October retires in the NEXT fiscal year, not the earlier one", () => {
  const summary = computeRetirementSummary(utcDate(1985, 10, 2), utcDate(2045, 10, 2));
  assert.equal(summary.available, true);
  // 60th birthday is 2045-10-02, which is in fiscal year 2046 (Gregorian-labeled) = พ.ศ. 2589.
  assert.equal(summary.retirementFiscalYear, 2046);
  assert.equal(summary.retirementFiscalYearBe, 2589);
  assert.equal(summary.displayRetirementDateTh, "30 กันยายน 2589");
});

// ---------------------------------------------------------------------------
// 13. Missing birth date
// ---------------------------------------------------------------------------
test("missing birth date: age and retirement are explicitly unavailable, never a computed zero", () => {
  const age = computeAgeSummary(null, utcDate(2026, 7, 17));
  assert.equal(age.available, false);
  assert.equal(age.reason, "MISSING_DATE_OF_BIRTH");
  assert.equal(age.exactAge, null);
  assert.equal(age.displayAgeTh, null);

  const retirement = computeRetirementSummary(null, utcDate(2026, 7, 17));
  assert.equal(retirement.available, false);
  assert.equal(retirement.reason, "MISSING_DATE_OF_BIRTH");
  assert.equal(retirement.retirementDate, null);
  assert.equal(retirement.displayRetirementDateTh, null);
});

// ---------------------------------------------------------------------------
// 14. Invalid date handling
// ---------------------------------------------------------------------------
test("invalid date never renders 'Invalid Date' — falls back to the Thai placeholder", () => {
  const invalid = new Date(NaN);
  assert.equal(formatFullThaiDateTh(invalid), "ไม่มีข้อมูล");
  assert.equal(formatShortThaiDateTh(invalid), "ไม่มีข้อมูล");
  assert.equal(formatBuddhistEraYearTh(invalid), "ไม่มีข้อมูล");
  assert.equal(formatFullThaiDateTh(null), "ไม่มีข้อมูล");
  assert.equal(formatFullThaiDateTh(undefined), "ไม่มีข้อมูล");

  const result = computeExactDuration(invalid, utcDate(2026, 7, 17), "MISSING_DATE_OF_BIRTH");
  assert.equal(result.available, false);
  assert.equal(result.reason, "INVALID_DATE");
});

// ---------------------------------------------------------------------------
// 15. Timezone stability
// ---------------------------------------------------------------------------
test("timezone stability: UTC-constructed dates never shift by a day regardless of local offset", () => {
  const dob = utcDate(1990, 12, 31);
  const asOf = utcDate(2026, 1, 1);
  const summary = computeAgeSummary(dob, asOf);
  assert.equal(summary.available, true);
  assert.equal(summary.birthDate, "1990-12-31");
  assert.equal(summary.asOfDate, "2026-01-01");
  assert.deepEqual(summary.exactAge, { years: 35, months: 0, days: 1 });
});

// ---------------------------------------------------------------------------
// Additional exact-duration formatting coverage
// ---------------------------------------------------------------------------
test("formatExactDurationTh always shows all three units; compact form omits leading zeros", () => {
  const duration = { years: 20, months: 8, days: 15 };
  assert.equal(formatExactDurationTh(duration), "20 ปี 8 เดือน 15 วัน");
  assert.equal(formatExactDurationCompactTh({ years: 0, months: 0, days: 6 }), "6 วัน");
  assert.equal(formatExactDurationTh(null), "ไม่มีข้อมูล");
});

test("computeExactDuration is unavailable with a machine-readable reason when start is missing", () => {
  const result = computeExactDuration(null, utcDate(2026, 7, 17), "MISSING_SERVICE_START_DATE");
  assert.equal(result.available, false);
  assert.equal(result.reason, "MISSING_SERVICE_START_DATE");
  assert.equal(result.duration, null);
});
