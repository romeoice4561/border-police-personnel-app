import assert from "node:assert/strict";
import test from "node:test";
import { buildCommanderDashboard, buildOfficerIntelligenceCard } from "@/lib/intelligence";
import { buildPromotionContext, createMinimumServiceRule, createRequiredDocumentsRule, createRequiredTrainingRule } from "@/lib/promotion";
import { utcDate } from "@/lib/personnel_calendar";
import type { OfficerIntelligenceInput } from "@/lib/intelligence";

function baseInput(overrides: Partial<OfficerIntelligenceInput> = {}): OfficerIntelligenceInput {
  const promotionContext = buildPromotionContext({
    asOf: utcDate(2026, 7, 14),
    dateOfBirth: utcDate(1985, 9, 30),
    governmentServiceStartDate: utcDate(2005, 1, 1),
    trainingRecords: [{ code: "COMMAND" }],
    documents: [{ typeCode: "GP7", isActive: true }],
  });

  return {
    officerId: "off-1",
    displayName: "Officer One",
    promotionContext,
    promotionRules: [
      createMinimumServiceRule({ minimum: { years: 10, months: 0, days: 0 } }),
      createRequiredTrainingRule({ requiredTrainingCodes: ["COMMAND"] }),
      createRequiredDocumentsRule({ requiredDocumentTypes: ["GP7"] }),
    ],
    profileCompletenessPercent: 92,
    hasOfficialPortrait: true,
    documents: [{ typeCode: "GP7", isActive: true }],
    trainingRecords: [{ code: "COMMAND" }],
    ...overrides,
  };
}

test("promotion ready officer gets ready flag and recommendation", () => {
  const card = buildOfficerIntelligenceCard(baseInput());

  assert.equal(card.promotionStatus, "eligible");
  assert.equal(card.retirementStatus, "normal");
  assert.equal(card.profileCompleteness, "high");
  assert.ok(card.flags.some((flag) => flag.code === "PROMOTION_READY"));
  assert.ok(card.recommendations.includes("Officer is ready for promotion review."));
});

test("retiring soon officer is flagged and priority increases", () => {
  const card = buildOfficerIntelligenceCard(baseInput({
    promotionContext: buildPromotionContext({
      asOf: utcDate(2045, 1, 1),
      dateOfBirth: utcDate(1985, 9, 30),
      governmentServiceStartDate: utcDate(2005, 1, 1),
      trainingRecords: [{ code: "COMMAND" }],
      documents: [{ typeCode: "GP7", isActive: true }],
    }),
  }));

  assert.equal(card.retirementStatus, "retiring_within_1_year");
  assert.ok(card.flags.some((flag) => flag.code === "RETIRING_SOON"));
  assert.ok(card.recommendations.includes("Retirement planning should begin."));
  assert.notEqual(card.priority, "low");
});

test("missing documents surface GP7 summary and document recommendations", () => {
  const card = buildOfficerIntelligenceCard(baseInput({
    documents: [],
    promotionContext: buildPromotionContext({
      asOf: utcDate(2026, 7, 14),
      dateOfBirth: utcDate(1985, 9, 30),
      governmentServiceStartDate: utcDate(2005, 1, 1),
      trainingRecords: [{ code: "COMMAND" }],
      documents: [],
    }),
  }));

  assert.equal(card.promotionStatus, "not_eligible");
  assert.ok(card.flags.some((flag) => flag.code === "DOCUMENTS_MISSING"));
  assert.ok(card.recommendations.includes("Complete GP7."));
});

test("mixed dashboard scenarios aggregate summary counts", () => {
  const dashboard = buildCommanderDashboard([
    baseInput({ officerId: "ready" }),
    baseInput({
      officerId: "near",
      profileCompletenessPercent: 60,
      hasOfficialPortrait: false,
      documents: [],
      promotionContext: buildPromotionContext({
        asOf: utcDate(2026, 7, 14),
        dateOfBirth: utcDate(1985, 10, 2),
        governmentServiceStartDate: utcDate(2005, 1, 1),
        trainingRecords: [{ code: "COMMAND" }],
        documents: [],
      }),
    }),
    baseInput({
      officerId: "retiring",
      promotionContext: buildPromotionContext({
        asOf: utcDate(2045, 1, 1),
        dateOfBirth: utcDate(1985, 9, 30),
        governmentServiceStartDate: utcDate(2005, 1, 1),
        trainingRecords: [{ code: "COMMAND" }],
        documents: [{ typeCode: "GP7", isActive: true }],
      }),
    }),
  ]);

  assert.equal(dashboard.summary.totalOfficers, 3);
  assert.equal(dashboard.summary.promotionReady, 2);
  assert.equal(dashboard.summary.retiringSoon, 1);
  assert.equal(dashboard.summary.incompleteProfiles, 1);
  assert.equal(dashboard.summary.missingDocuments, 1);
  assert.equal(dashboard.summary.missingGp7, 1);
  assert.equal(dashboard.summary.missingPortrait, 1);
});

test("empty dashboard returns zero counts and no cards", () => {
  const dashboard = buildCommanderDashboard([]);

  assert.deepEqual(dashboard.summary, {
    totalOfficers: 0,
    promotionReady: 0,
    nearPromotion: 0,
    retiringSoon: 0,
    incompleteProfiles: 0,
    missingDocuments: 0,
    missingGp7: 0,
    missingPortrait: 0,
    missingTraining: 0,
  });
  assert.deepEqual(dashboard.officers, []);
});
