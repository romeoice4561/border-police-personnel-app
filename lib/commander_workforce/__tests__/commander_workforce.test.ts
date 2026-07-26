/**
 * Phase 52.1 — Workforce Intelligence ViewModel tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { composeOfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";
import {
  composeCommanderWorkforceViewModel,
  EMPTY_WORKFORCE_FILTERS,
  normalizeWorkforceFilters,
  WORKFORCE_PROMOTION_STATUSES,
} from "@/lib/commander_workforce";
import type { WorkforceOrgPublicIndex } from "@/lib/commander_workforce/types";

const ASOF = new Date("2026-07-17T00:00:00.000Z");

function fakePromo(overrides: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    available: true,
    status: "not_eligible",
    eligibleNow: false,
    monthsUntilEligible: null,
    overdueYears: null,
    eligibleYearOrdinal: null,
    targetLevel: null,
    currentRank: null,
    currentPosition: null,
    targetRank: null,
    targetPosition: null,
    promotionStatus: "NotEligible",
    eligibleDate: null,
    eligibleFiscalYearBe: null,
    firstEligibleDate: null,
    firstEligibleYearBe: null,
    firstEligibleFiscalYearBe: null,
    displayReasonTh: null,
    remainingTenureYears: null,
    displayRemainingTenureTh: null,
    yearsEligible: null,
    monthsEligible: null,
    daysEligible: null,
    promotionCyclesPassed: null,
    displayEligibleSinceTh: null,
    displayStatusTh: "ยังไม่ครบคุณสมบัติ",
    requiredTenureYears: null,
    waitingReasonTh: null,
    confidence: "confirmed",
    confidenceReasonTh: null,
    missingEvidence: [],
    priority: null,
    priorityReason: null,
    ...overrides,
  };
}

function fakeTraining(overrides: Partial<TrainingSummary> = {}): TrainingSummary {
  return {
    available: true,
    asOfDate: "2026-07-17",
    totalRecords: 0,
    verifiedRecords: 0,
    unverifiedRecords: 0,
    completedCourseCount: 0,
    missingRequiredCourseCount: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
    requiredRequirements: [],
    completedCourses: [],
    missingRequirements: [],
    expiringSoon: [],
    expired: [],
    trainingStatus: "NoData",
    displayStatusTh: "ยังไม่มีข้อมูล",
    recommendationsTh: [],
    dataQualityFlags: [],
    ...overrides,
  };
}

function officer(id: string, overrides: Partial<CommanderQueryOfficer> = {}): CommanderQueryOfficer {
  const documentIntelligence =
    overrides.documentIntelligence ??
    composeOfficerDocumentIntelligence({ officerId: id, officerPk: 1, documents: [], asOf: ASOF });

  return {
    officerId: id,
    rank: "ร.ต.อ.",
    firstName: "ทดสอบ",
    lastName: id,
    displayName: `ทดสอบ ${id}`,
    currentPosition: "รอง สว.",
    positionLevel: "รองสารวัตร",
    currentUnit: "ร้อย 414",
    regionId: 4,
    battalionId: 41,
    companyId: 414,
    companyLabel: "ร้อย ตชด.414",
    yearsInRank: null,
    yearsInPosition: null,
    yearsInPositionLevel: null,
    positionLevelYearCount: null,
    completedPromotionCycles: null,
    governmentServiceYears: null,
    ageYears: null,
    retirementYear: 2030,
    retirementYearBe: 2573,
    promotionStatus: "not_eligible",
    retirementStatus: "normal",
    priority: "low",
    profileCompletenessPercent: 90,
    flags: [],
    flagCodes: [],
    hasGp7: true,
    hasOfficialPortrait: true,
    hasTraining: false,
    hasDocuments: true,
    academyClass: null,
    isGpfMember: null,
    isCooperativeMember: null,
    cooperativeName: null,
    eligibleTwoStep: false,
    mustSkipStep: false,
    skillSignals: [],
    nextLevelEligibility: null,
    promotionIntelligence: fakePromo(),
    trainingIntelligence: fakeTraining(),
    dateOfBirth: new Date("1980-01-01T00:00:00.000Z"),
    displayServiceDurationTh: null,
    positionLevelStartYearBe: 2560,
    rankStartedAtYearBe: 2555,
    yearsInRankCount: 11,
    displayAgeYearsMonthsTh: null,
    appointmentCycle: null,
    eligibleCycle: null,
    overdueCycles: 0,
    promotionCycleBucket: "not_eligible",
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitUrl: null,
    documentIntelligence,
    documentExpiryInfo: [],
    ...overrides,
  };
}

const ORG_INDEX: WorkforceOrgPublicIndex = {
  regionById: { "4": "4" },
  divisionById: { "41": "41" },
  companyById: { "414": "414", "415": "415" },
  regionLabelByCode: { "4": "ตชด.ภาค 4" },
  divisionLabelByCode: { "41": "กก.ตชด.41" },
  companyLabelByCode: { "414": "ร้อย ตชด.414", "415": "ร้อย ตชด.415" },
};

describe("composition", () => {
  it("handles empty dataset", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [],
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.equal(vm.overview.metrics.find((m) => m.key === "total_personnel")?.count, 0);
    assert.equal(vm.promotion.totalEvaluated, 0);
    assert.equal(vm.actionCenter.items.length, 0);
  });

  it("handles one officer and mixed statuses", () => {
    const officers = [
      officer("A", {
        promotionIntelligence: fakePromo({ promotionStatus: "EligibleThisYear" }),
        retirementYear: 2026,
        retirementStatus: "retiring_within_1_year",
        trainingIntelligence: fakeTraining({ trainingStatus: "Complete" }),
      }),
      officer("B", {
        companyId: 415,
        promotionIntelligence: fakePromo({ promotionStatus: "MissingTraining" }),
        retirementYear: 2035,
        trainingIntelligence: fakeTraining({ trainingStatus: "MissingRequired" }),
        flagCodes: ["PROFILE_INCOMPLETE"],
        priority: "critical",
      }),
      officer("C", {
        promotionIntelligence: fakePromo({ promotionStatus: "Unknown", confidence: "unknown" }),
        retirementYear: null,
        retirementStatus: "unknown",
        dateOfBirth: null,
      }),
    ];
    const vm = composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.equal(vm.metadata.filteredOfficerCount, 3);
    assert.equal(vm.promotion.byStatus.find((s) => s.status === "EligibleThisYear")?.count, 1);
    assert.equal(vm.promotion.byStatus.find((s) => s.status === "MissingTraining")?.count, 1);
    assert.equal(vm.promotion.unknownTotal, 1);
    assert.ok(vm.retirement.buckets.find((b) => b.key === "unknown")!.count >= 1);
    assert.ok(vm.actionCenter.items.some((i) => i.key === "promotion_ready"));
  });

  it("is deterministic and does not mutate officers", () => {
    const officers = [
      officer("A", { promotionIntelligence: fakePromo({ promotionStatus: "Waiting" }) }),
      officer("B", { promotionIntelligence: fakePromo({ promotionStatus: "AlreadyEligible" }) }),
    ];
    const snapshot = JSON.stringify(officers);
    const a = composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    const b = composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.equal(JSON.stringify(officers), snapshot);
    assert.equal(a.metadata.compositionDurationMs, null);
  });

  it("composes a representative fixture quickly", () => {
    const officers = Array.from({ length: 200 }, (_, i) =>
      officer(`O${i}`, {
        companyId: i % 2 === 0 ? 414 : 415,
        promotionIntelligence: fakePromo({
          promotionStatus: WORKFORCE_PROMOTION_STATUSES[i % WORKFORCE_PROMOTION_STATUSES.length],
        }),
      })
    );
    const t0 = performance.now();
    composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    const ms = performance.now() - t0;
    assert.ok(ms < 500, `expected composition < 500ms for 200 officers, got ${ms.toFixed(1)}ms`);
  });
});

describe("filters", () => {
  const officers = [
    officer("A", {
      companyId: 414,
      rank: "ร.ต.อ.",
      positionLevel: "รองสารวัตร",
      promotionIntelligence: fakePromo({ promotionStatus: "EligibleThisYear" }),
    }),
    officer("B", {
      companyId: 415,
      rank: "พ.ต.ท.",
      positionLevel: "สารวัตร",
      promotionIntelligence: fakePromo({ promotionStatus: "Waiting" }),
      trainingIntelligence: fakeTraining({ trainingStatus: "Expired" }),
    }),
  ];

  it("filters by public company code without exposing internal IDs", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      filters: { companyPublicCode: "414" },
      now: ASOF,
    });
    assert.equal(vm.metadata.filteredOfficerCount, 1);
    const json = JSON.stringify(vm);
    assert.ok(!json.includes('"regionId"'));
    assert.ok(!json.includes("companyId"));
    assert.ok(json.includes("414"));
  });

  it("combined filters and clear restores totals", () => {
    const filtered = composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      filters: { rank: "พ.ต.ท.", promotionStatus: "Waiting" },
      now: ASOF,
    });
    assert.equal(filtered.metadata.filteredOfficerCount, 1);

    const cleared = composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      filters: EMPTY_WORKFORCE_FILTERS,
      now: ASOF,
    });
    assert.equal(cleared.metadata.filteredOfficerCount, 2);
  });

  it("ignores invalid promotion status filter", () => {
    const normalized = normalizeWorkforceFilters({ promotionStatus: "NotARealStatus" });
    assert.equal(normalized.promotionStatus, null);
  });
});

describe("overview vacancy vs zero", () => {
  it("marks vacancy unavailable, not zero-as-evaluated", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [officer("A")],
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.equal(vm.overview.vacancy.availability.status, "unavailable");
    assert.equal(vm.overview.vacancy.availability.reason, "SOURCE_NOT_IMPLEMENTED");
    assert.equal(vm.overview.personnelCategory.availability.status, "unavailable");
    const total = vm.overview.metrics.find((m) => m.key === "total_personnel");
    assert.equal(total?.count, 1);
    assert.equal(total?.availability.status, "available");
  });
});

describe("promotion", () => {
  it("counts every canonical PromotionSummary status", () => {
    const officers = WORKFORCE_PROMOTION_STATUSES.map((status, i) =>
      officer(`P${i}`, { promotionIntelligence: fakePromo({ promotionStatus: status }) })
    );
    const vm = composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    for (const status of WORKFORCE_PROMOTION_STATUSES) {
      assert.equal(vm.promotion.byStatus.find((s) => s.status === status)?.count, 1, status);
    }
    assert.equal(vm.promotion.eligibleTotal, 2);
    assert.equal(vm.promotion.unknownTotal, 1);
    assert.ok(
      vm.promotion.byStatus.every((s) => s.drilldown.filters.promotionEligibilityStatus === s.status || s.drilldown.target === "commander-promotion")
    );
  });
});

describe("retirement", () => {
  it("buckets using existing retirementYear / status", () => {
    const officers = [
      officer("1", { retirementYear: 2026, retirementStatus: "retiring_within_1_year" }),
      officer("2", { retirementYear: 2029, retirementStatus: "normal" }),
      officer("3", { retirementYear: 2040, retirementStatus: "normal" }),
      officer("4", { retirementYear: null, retirementStatus: "unknown", dateOfBirth: null }),
      officer("5", { retirementStatus: "retired", retirementYear: 2020 }),
    ];
    const vm = composeCommanderWorkforceViewModel({
      officers,
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.ok((vm.retirement.buckets.find((b) => b.key === "this_fiscal_year")?.count ?? 0) >= 1);
    assert.ok((vm.retirement.buckets.find((b) => b.key === "within_3_years")?.count ?? 0) >= 1);
    assert.ok((vm.retirement.buckets.find((b) => b.key === "beyond_5_years")?.count ?? 0) >= 1);
    assert.equal(vm.retirement.buckets.find((b) => b.key === "unknown")?.count, 1);
    assert.equal(vm.retirement.buckets.find((b) => b.key === "already_retired")?.count, 1);
  });
});

describe("training & documents", () => {
  it("aggregates training statuses without inventing requirements", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [
        officer("A", { trainingIntelligence: fakeTraining({ trainingStatus: "Complete" }) }),
        officer("B", { trainingIntelligence: fakeTraining({ trainingStatus: "NoPolicy" }) }),
        officer("C", { trainingIntelligence: fakeTraining({ trainingStatus: "Expired" }) }),
      ],
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.equal(vm.training.complete, 1);
    assert.equal(vm.training.noPolicy, 1);
    assert.equal(vm.training.expired, 1);
  });

  it("aggregates document intelligence fields", () => {
    const completeDoc = composeOfficerDocumentIntelligence({
      officerId: "A",
      officerPk: 1,
      documents: [],
      asOf: ASOF,
    });
    // Force counts via spread override on a base intelligence object.
    const withExpired = {
      ...completeDoc,
      expiredCount: 1,
      expiringSoonCount: 0,
      missingRequiredCount: 0,
      completenessLevel: "partial" as const,
      readinessLevel: "NEEDS_REVIEW" as const,
    };
    const vm = composeCommanderWorkforceViewModel({
      officers: [
        officer("A", {
          documentIntelligence: {
            ...completeDoc,
            completenessLevel: "complete",
            readinessLevel: "READY",
            expiredCount: 0,
            expiringSoonCount: 0,
            missingRequiredCount: 0,
          },
        }),
        officer("B", { documentIntelligence: withExpired }),
      ],
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.equal(vm.documents.expired, 1);
    assert.ok(vm.documents.complete >= 1);
  });
});

describe("readiness & action center", () => {
  it("excludes unavailable dimensions and exposes formula breakdown", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [
        officer("A", {
          promotionIntelligence: fakePromo({ promotionStatus: "EligibleThisYear" }),
          trainingIntelligence: fakeTraining({ trainingStatus: "NoPolicy" }),
        }),
      ],
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.ok(vm.readiness.formulaTh.includes("available"));
    assert.ok(vm.readiness.breakdownTh.length >= 5);
    const trainingDim = vm.readiness.dimensions.find((d) => d.key === "training");
    // Single officer NoPolicy → training dimension unavailable
    assert.equal(trainingDim?.status, "unavailable");
    assert.ok(vm.readiness.dimensions.some((d) => d.key === "promotion" && d.status === "available"));
  });

  it("creates deterministic actions without ranking people", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [
        officer("A", { promotionIntelligence: fakePromo({ promotionStatus: "EligibleThisYear" }) }),
        officer("B", {
          promotionIntelligence: fakePromo({ promotionStatus: "MissingDocuments" }),
          documentIntelligence: {
            ...composeOfficerDocumentIntelligence({
              officerId: "B",
              officerPk: 2,
              documents: [],
              asOf: ASOF,
            }),
            expiredCount: 2,
            missingRequiredCount: 1,
          },
        }),
      ],
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    assert.ok(vm.actionCenter.items.every((i) => i.drilldown.relativeHref?.startsWith("/")));
    assert.ok(vm.actionCenter.items.every((i) => i.count > 0));
    assert.ok(vm.actionCenter.omittedZeroCountKeys.includes("training_missing"));
    const keys = vm.actionCenter.items.map((i) => i.key);
    assert.deepEqual(keys, [...keys].sort((a, b) => {
      const order = { critical: 0, urgent: 1, attention: 2, info: 3 } as const;
      const ia = vm.actionCenter.items.find((x) => x.key === a)!;
      const ib = vm.actionCenter.items.find((x) => x.key === b)!;
      return order[ia.severity] - order[ib.severity] || a.localeCompare(b);
    }));
  });
});

describe("serialization & architecture", () => {
  it("is JSON serializable without Map/Set/functions/Prisma", () => {
    const vm = composeCommanderWorkforceViewModel({
      officers: [officer("A")],
      asOfDate: ASOF,
      orgPublicIndex: ORG_INDEX,
      now: ASOF,
    });
    const json = JSON.stringify(vm);
    const parsed = JSON.parse(json);
    assert.equal(parsed.metadata.schemaVersion, 1);
    assert.ok(!json.includes("[object Map]"));
  });

  it("commander_workforce sources avoid Prisma/React/Telegram/engine calculators", () => {
    const dir = path.join(process.cwd(), "lib", "commander_workforce");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    const forbidden = [
      "@prisma",
      "from \"react\"",
      "from 'react'",
      "personnel_search_telegram",
      "computePromotionSummary",
      "computeRetirementSummary",
      "createDatabaseClient",
    ];
    for (const file of files) {
      if (file === "index.ts") continue;
      const src = readFileSync(path.join(dir, file), "utf8");
      for (const needle of forbidden) {
        assert.ok(!src.includes(needle), `${file} must not contain ${needle}`);
      }
    }
  });
});
