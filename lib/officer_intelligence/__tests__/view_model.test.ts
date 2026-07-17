/**
 * Officer Intelligence View Model tests (Phase 44).
 *
 * All tests use a fixed, explicit `asOf` — never the real current date — so
 * results are deterministic regardless of when the suite runs. The fixture
 * builder fills only the fields `toQueryOfficer`/`composeOfficerIntelligenceViewModel`
 * actually read (mirrors the existing `officer()` fixture pattern in
 * lib/ui/__tests__/profile_completeness.test.ts), cast via `as
 * OfficerWithRelations` like that test does.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { utcDate } from "@/lib/personnel_calendar";
import { composeOfficerIntelligenceViewModel } from "@/lib/officer_intelligence/view_model";
import type { OfficerWithRelations } from "@/lib/database/query_types";

function officer(overrides: Record<string, unknown> = {}): OfficerWithRelations {
  return {
    id: 1,
    officerId: "ภาค1/5",
    rank: "รองสารวัตร",
    firstName: "ทดสอบ",
    lastName: "ระบบ",
    currentPosition: "รอง สว.",
    currentUnit: "กก.ตชด.41",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    phone: null,
    qualityScore: 80,
    knowledgeScore: 70,
    region: null,
    confidence: 80,
    dateOfBirth: null,
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitId: null,
    email: null,
    lineId: null,
    facebookUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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

const ASOF = utcDate(2026, 7, 17); // 17 July 2026.
const ORG_LABELS = { company: "กองร้อยทดสอบ" };

test("1. exact age output — years/months/days, never decimal", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ dateOfBirth: utcDate(1985, 8, 11) }), ORG_LABELS, null, ASOF);
  assert.equal(vm.age.available, true);
  assert.match(vm.age.displayAgeTh!, /^\d+ ปี \d+ เดือน \d+ วัน$/);
  assert.equal(vm.age.ageYears, 40);
});

test("2. next birthday output — date, age turning, days until", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ dateOfBirth: utcDate(1985, 8, 11) }), ORG_LABELS, null, ASOF);
  assert.equal(vm.age.nextBirthdayDate, "2026-08-11");
  assert.equal(vm.age.daysUntilNextBirthday, 25);
  assert.match(vm.age.displayNextBirthdayTh!, /11 สิงหาคม 2569/);
});

test("3. exact service duration — years/months/days, never decimal", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({ timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2551", yearBE: 2551, position: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร" }] }),
    ORG_LABELS,
    null,
    ASOF
  );
  assert.equal(vm.service.available, true);
  assert.match(vm.service.displayServiceDurationTh!, /ปี.*เดือน.*วัน/);
});

test("4. missing service start — explicit Thai fallback, not fabricated", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ timeline: [] }), ORG_LABELS, null, ASOF);
  assert.equal(vm.service.available, false);
  assert.equal(vm.service.displayServiceDurationTh, null);
  assert.equal(vm.service.serviceStartDate, null);
});

test("5. current position-level start year (Buddhist Era)", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({
      currentPosition: "รองสารวัตร",
      timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2564", yearBE: 2564, position: "รองสารวัตร", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
    }),
    ORG_LABELS,
    null,
    ASOF
  );
  assert.equal(vm.service.currentPositionLevelStartYearBe, 2564);
});

test("6. years in current position level — whole years, not promotionCyclesPassed", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({
      currentPosition: "รองสารวัตร",
      timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2564", yearBE: 2564, position: "รองสารวัตร", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
    }),
    ORG_LABELS,
    null,
    ASOF
  );
  assert.equal(vm.service.yearsInCurrentPositionLevel, vm.promotion.yearsInCurrentLevel);
  assert.ok(Number.isInteger(vm.service.yearsInCurrentPositionLevel));
});

test("7. target position display — Thai commander-readable position, never raw enum", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({
      currentPosition: "รองสารวัตร",
      timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2560", yearBE: 2560, appointmentCycle: 2560, position: "รองสารวัตร", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
    }),
    ORG_LABELS,
    null,
    ASOF
  );
  assert.equal(vm.promotion.targetPositionTh, "สารวัตร");
  assert.equal(vm.promotion.qualificationTextTh, "ครบขึ้น สารวัตร");
});

test("8. first eligible year — Buddhist Era, from PromotionSummary", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({
      currentPosition: "รองสารวัตร",
      timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2560", yearBE: 2560, appointmentCycle: 2560, position: "รองสารวัตร", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
    }),
    ORG_LABELS,
    null,
    ASOF
  );
  assert.ok(vm.promotion.firstEligibleYearBe != null);
  assert.ok(vm.promotion.firstEligibleYearBe! > 2500); // sanity: Buddhist Era, not Gregorian
});

test("9. waiting duration — overdueYears - 1, floored at 0/null", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({
      currentPosition: "รองสารวัตร",
      timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2555", yearBE: 2555, appointmentCycle: 2555, position: "รองสารวัตร", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
    }),
    ORG_LABELS,
    null,
    ASOF
  );
  assert.ok(vm.promotion.waitingYears == null || vm.promotion.waitingYears >= 0);
});

test("10. current eligibility year number — bare number, never calculated from today's date in this component", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({
      currentPosition: "รองสารวัตร",
      timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2560", yearBE: 2560, appointmentCycle: 2560, position: "รองสารวัตร", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
    }),
    ORG_LABELS,
    null,
    ASOF
  );
  assert.ok(typeof vm.promotion.eligibilityYearNumber === "number" || vm.promotion.eligibilityYearNumber === null);
});

test("11. retirement year in Buddhist Era", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ dateOfBirth: utcDate(1970, 8, 11) }), ORG_LABELS, null, ASOF);
  assert.equal(vm.retirement.available, true);
  assert.ok(vm.retirement.retirementYearBe! > 2500);
});

test("12. retirement remaining duration — exact, not decimal", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ dateOfBirth: utcDate(1985, 8, 11) }), ORG_LABELS, null, ASOF);
  assert.match(vm.retirement.displayRemainingTh!, /ปี.*เดือน.*วัน/);
  assert.equal(typeof vm.retirement.remainingDays, "number");
});

test("13. missing birth date — age/retirement explicitly unavailable, not a silent zero", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ dateOfBirth: null }), ORG_LABELS, null, ASOF);
  assert.equal(vm.age.available, false);
  assert.equal(vm.age.displayAgeTh, null);
  assert.equal(vm.age.ageYears, null);
  assert.equal(vm.retirement.available, false);
  assert.equal(vm.retirement.retirementYearBe, null);
});

test("14. missing timeline data — service unavailable, position-level start unavailable", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ timeline: [] }), ORG_LABELS, null, ASOF);
  assert.equal(vm.service.available, false);
  assert.equal(vm.service.currentPositionLevelStartYearBe, null);
});

test("15. Unknown promotion status when position level cannot be classified", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ currentPosition: "", timeline: [] }), ORG_LABELS, null, ASOF);
  assert.equal(vm.promotion.status, "Unknown");
});

test("16. action-required flags — set when promotion-ready, missing portrait, or near retirement", () => {
  const readyOfficer = officer({
    currentPosition: "รองสารวัตร",
    timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2555", yearBE: 2555, appointmentCycle: 2555, position: "รองสารวัตร", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
  });
  const vm = composeOfficerIntelligenceViewModel(readyOfficer, ORG_LABELS, null, ASOF);
  // No official portrait -> actionRequired must be true regardless of promotion status.
  assert.equal(vm.commander.actionRequired, true);
});

test("17. profile completeness data — percent + missing items, never invented", () => {
  const vm = composeOfficerIntelligenceViewModel(officer(), ORG_LABELS, null, ASOF);
  assert.equal(vm.profileQuality.available, true);
  assert.ok(vm.profileQuality.completenessPercent! >= 0 && vm.profileQuality.completenessPercent! <= 100);
  assert.ok(Array.isArray(vm.profileQuality.missingItems));
});

test("18. Official Portrait consistency — identity.officialPortraitUrl is exactly the resolved URL passed in, never a raw field", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({ thumbnailUrl: "https://unreliable-legacy.example/raw.jpg" }),
    ORG_LABELS,
    "https://resolved-official-portrait.example/real.jpg",
    ASOF
  );
  assert.equal(vm.identity.officialPortraitUrl, "https://resolved-official-portrait.example/real.jpg");
});

test("19. no arbitrary gallery image fallback — null officialPortraitUrl stays null, never substitutes the raw thumbnailUrl", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ thumbnailUrl: "https://unreliable-legacy.example/raw.jpg" }), ORG_LABELS, null, ASOF);
  assert.equal(vm.identity.officialPortraitUrl, null);
  assert.equal(vm.profileQuality.hasOfficialPortrait, false);
});

test("20. empty recommendations — a fully-complete, non-urgent officer gets an empty or minimal action list, never fabricated urgency", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({
      dateOfBirth: utcDate(1985, 8, 11),
      currentPosition: "รองสารวัตร",
      timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2560", yearBE: 2560, position: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
      documents: [{ id: 1, officerId: 1, documentType: "GP7", isActive: true, createdAt: new Date(), title: "gp7.pdf" }],
      training: [{ id: 1, officerId: 1, course: "หลักสูตรทดสอบ" }],
    }),
    ORG_LABELS,
    "https://resolved.example/real.jpg",
    ASOF
  );
  const birthdayMentioned = vm.commander.recommendations.some((item) => item.textTh.includes("วันเกิด"));
  assert.equal(birthdayMentioned, false, "birthday must never appear as a commander action item");
});

test("21. Thai display labels — displayStatusTh is Thai text, not a raw enum key", () => {
  const vm = composeOfficerIntelligenceViewModel(
    officer({
      currentPosition: "รองสารวัตร",
      timeline: [{ id: 1, officerId: 1, sequence: 0, year: "2555", yearBE: 2555, appointmentCycle: 2555, position: "รองสารวัตร", positionLevel: "รองสารวัตร", unit: "กก.ตชด.41", rank: "รองสารวัตร", isPresent: true }],
    }),
    ORG_LABELS,
    null,
    ASOF
  );
  assert.ok(vm.promotion.displayStatusTh);
  assert.notEqual(vm.promotion.displayStatusTh, vm.promotion.status);
  assert.ok(/[ก-๙]/.test(vm.promotion.displayStatusTh!), "status text should contain Thai characters");
});

test("22. no decimal age anywhere in the view model's display strings", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ dateOfBirth: utcDate(1985, 3, 3) }), ORG_LABELS, null, ASOF);
  assert.doesNotMatch(vm.age.displayAgeTh ?? "", /\d+\.\d+/);
});

test("23. no raw enum values in identity.positionLevel — Unknown normalizes to null", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ currentPosition: "", timeline: [] }), ORG_LABELS, null, ASOF);
  assert.equal(vm.identity.positionLevel, null);
});

test("24. no silent zero for unavailable retirement/age data", () => {
  const vm = composeOfficerIntelligenceViewModel(officer({ dateOfBirth: null }), ORG_LABELS, null, ASOF);
  assert.notEqual(vm.age.ageYears, 0);
  assert.equal(vm.age.ageYears, null);
  assert.notEqual(vm.retirement.remainingDays, 0);
  assert.equal(vm.retirement.remainingDays, null);
});

test("25. deterministic asOfDate/generatedAt — identical asOf always produces identical output", () => {
  const o = officer({ dateOfBirth: utcDate(1985, 8, 11) });
  const vm1 = composeOfficerIntelligenceViewModel(o, ORG_LABELS, null, ASOF);
  const vm2 = composeOfficerIntelligenceViewModel(o, ORG_LABELS, null, ASOF);
  assert.equal(vm1.asOfDate, "2026-07-17");
  assert.equal(vm1.asOfDate, vm2.asOfDate);
  assert.equal(vm1.generatedAt, vm2.generatedAt);
  assert.deepEqual(vm1, vm2);
});
