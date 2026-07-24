/**
 * Phase 51 — Personnel Search Gateway tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";
import type { OfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import { ROLE_PERMISSIONS } from "@/lib/auth/roles";
import { searchPersonnel } from "@/lib/personnel_search/gateway";
import { resolveSearchIntent } from "@/lib/personnel_search/intent";
import { normalizeUnitQuery } from "@/lib/personnel_search/normalizer";
import { maskOfficerId, resolveFieldAccess } from "@/lib/personnel_search/permission";
import { compareForDisambiguation, scorePersonMatch } from "@/lib/personnel_search/ranking";
import { needsDisambiguation, searchPersons } from "@/lib/personnel_search/search_person";

function promo(partial: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    available: true,
    status: "not_eligible",
    eligibleNow: false,
    monthsUntilEligible: 36,
    overdueYears: 0,
    eligibleYearOrdinal: null,
    targetLevel: "รองผู้กำกับการ",
    currentRank: "พ.ต.ท.",
    currentPosition: "สารวัตร",
    targetRank: "รองผู้กำกับการ",
    targetPosition: "รองผู้กำกับการ",
    promotionStatus: "Waiting",
    eligibleDate: null,
    eligibleFiscalYearBe: null,
    firstEligibleDate: null,
    firstEligibleYearBe: null,
    firstEligibleFiscalYearBe: null,
    yearsEligible: null,
    monthsEligible: null,
    daysEligible: null,
    promotionCyclesPassed: null,
    displayEligibleSinceTh: null,
    displayStatusTh: "ยังไม่ครบคุณสมบัติ",
    displayReasonTh: null,
    remainingTenureYears: 3,
    displayRemainingTenureTh: "ประมาณ 3 ปี",
    requiredTenureYears: 5,
    waitingReasonTh: null,
    confidence: "confirmed",
    confidenceReasonTh: null,
    missingEvidence: [],
    priority: 10,
    priorityReason: "Waiting",
    ...partial,
  } as PromotionSummary;
}

function training(partial: Partial<TrainingSummary> = {}): TrainingSummary {
  return {
    available: true,
    asOfDate: "2026-07-24",
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
    displayStatusTh: "ไม่มีข้อมูลหลักสูตร",
    recommendationsTh: [],
    dataQualityFlags: [],
    ...partial,
  };
}

function docs(partial: Partial<OfficerDocumentIntelligence> = {}): OfficerDocumentIntelligence {
  return {
    officerId: "x",
    readinessLevel: "READY",
    readinessLabelTh: "พร้อมครบ",
    completenessScore: 100,
    completenessLevel: "complete",
    missingRequiredCount: 0,
    missingRequiredDocuments: [],
    expiringSoonCount: 0,
    expiredCount: 0,
    pendingReviewCount: 0,
    unsupportedCount: 0,
    qualityWarningCount: 0,
    primaryAction: "NONE",
    primaryActionLabelTh: "ไม่ต้องดำเนินการ",
    drillDownQuery: {},
    ...partial,
  };
}

function officer(id: string, overrides: Partial<CommanderQueryOfficer> = {}, promoOverrides: Partial<PromotionSummary> = {}): CommanderQueryOfficer {
  return {
    officerId: id,
    rank: "พ.ต.ท.",
    firstName: "ทดสอบ",
    lastName: id,
    displayName: `ทดสอบ ${id}`,
    currentPosition: "สารวัตร",
    positionLevel: "สารวัตร",
    currentUnit: "กก.ตชด.41",
    regionId: 4,
    battalionId: 41,
    companyId: 414,
    companyLabel: "ร้อย ตชด.414",
    yearsInRank: 5,
    yearsInPosition: 5,
    yearsInPositionLevel: 5,
    positionLevelYearCount: 2,
    completedPromotionCycles: 2,
    governmentServiceYears: 20,
    ageYears: 45,
    retirementYear: 2045,
    retirementYearBe: 2588,
    promotionStatus: "near_eligible",
    retirementStatus: "normal",
    priority: "medium",
    profileCompletenessPercent: 80,
    flags: [],
    flagCodes: [],
    hasGp7: true,
    hasOfficialPortrait: true,
    hasTraining: true,
    hasDocuments: true,
    academyClass: null,
    isGpfMember: null,
    isCooperativeMember: null,
    cooperativeName: null,
    eligibleTwoStep: false,
    mustSkipStep: false,
    skillSignals: [],
    nextLevelEligibility: null,
    promotionIntelligence: promo(promoOverrides),
    trainingIntelligence: training(),
    dateOfBirth: null,
    displayServiceDurationTh: "20 ปี",
    positionLevelStartYearBe: 2564,
    rankStartedAtYearBe: 2560,
    yearsInRankCount: 6,
    displayAgeYearsMonthsTh: null,
    appointmentCycle: 2567,
    eligibleCycle: 2572,
    overdueCycles: 0,
    promotionCycleBucket: "not_eligible",
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitUrl: null,
    documentIntelligence: docs({ officerId: id }),
    documentExpiryInfo: [],
    ...overrides,
  } as CommanderQueryOfficer;
}

function dataset(officers: CommanderQueryOfficer[]): CommanderQueryDataset {
  return {
    officers,
    options: {
      ranks: [],
      positionLevels: [],
      regions: [],
      battalions: [],
      companies: [],
      priorities: [],
      skillCatalog: { categories: [], levels: [] },
    },
  };
}

describe("personnel_search normalizer", () => {
  it("normalizes company unit variants to Company N", () => {
    for (const q of ["ร้อย414", "ร้อย 414", "ตชด414", "ตชด.414", "กองร้อย414"]) {
      const u = normalizeUnitQuery(q);
      assert.ok(u, q);
      assert.equal(u!.level, "company");
      assert.equal(u!.number, 414);
      assert.equal(u!.labelEn, "Company 414");
    }
  });

  it("normalizes division and region variants", () => {
    assert.equal(normalizeUnitQuery("กก41")?.labelEn, "Division 41");
    assert.equal(normalizeUnitQuery("กก.ตชด.41")?.labelEn, "Division 41");
    assert.equal(normalizeUnitQuery("กองกำกับ41")?.labelEn, "Division 41");
    assert.equal(normalizeUnitQuery("ภาค4")?.labelEn, "Region 4");
    assert.equal(normalizeUnitQuery("ภาค 4")?.labelEn, "Region 4");
  });
});

describe("personnel_search intent", () => {
  it("resolves promotion / retirement / training / document intents", () => {
    assert.equal(resolveSearchIntent("พร้อมเลื่อนปีนี้").intent, "PROMOTION_SEARCH");
    assert.equal(resolveSearchIntent("ครบคุณสมบัติมาแล้ว").intent, "PROMOTION_SEARCH");
    assert.equal(resolveSearchIntent("ขาดหลักสูตร").intent, "PROMOTION_SEARCH");
    assert.equal(resolveSearchIntent("เกษียณปี2570").intent, "RETIREMENT_SEARCH");
    assert.equal(resolveSearchIntent("หลักสูตรสืบสวน").intent, "TRAINING_SEARCH");
    assert.equal(resolveSearchIntent("ขาดเอกสาร").intent, "DOCUMENT_SEARCH");
    assert.equal(resolveSearchIntent("ข้อมูลไม่ครบ").intent, "DATA_QUALITY_SEARCH");
    assert.equal(resolveSearchIntent("ร้อย414").intent, "UNIT_LOOKUP");
    assert.equal(resolveSearchIntent("help").intent, "HELP");
  });
});

describe("personnel_search ranking + duplicates", () => {
  it("ranks exact officer id above fuzzy name", () => {
    const a = officer("ภาค4/1", { firstName: "สมชาย", lastName: "ใจดี", displayName: "สมชาย ใจดี" });
    const b = officer("ภาค4/2", { firstName: "สมชาย", lastName: "ทองดี", displayName: "สมชาย ทองดี" });
    const idHit = scorePersonMatch(a, {}, "ภาค4/1");
    const nameHit = scorePersonMatch(b, {}, "สมชาย");
    assert.ok(idHit && nameHit);
    assert.ok(idHit!.matchScore > nameHit!.matchScore);
  });

  it("never auto-picks duplicate first names — disambiguation ordered by rank", () => {
    const junior = officer("ภาค4/10", {
      rank: "ร.ต.อ.",
      firstName: "สมชาย",
      lastName: "เล็ก",
      displayName: "สมชาย เล็ก",
      currentPosition: "ผบ.มว.",
      companyLabel: "ร้อย414",
      academyClass: 70,
    });
    const senior = officer("ภาค4/11", {
      rank: "พ.ต.ต.",
      firstName: "สมชาย",
      lastName: "ใหญ่",
      displayName: "สมชาย ใหญ่",
      currentPosition: "สว.",
      companyLabel: "กก.ตชด.41",
      academyClass: 65,
    });
    const enrichment = new Map([
      ["ภาค4/10", { nickname: "บอล" }],
      ["ภาค4/11", { nickname: "ชาย" }],
    ]);
    const matches = searchPersons([junior, senior], enrichment, "สมชาย");
    assert.equal(needsDisambiguation(matches, "สมชาย"), true);
    const ordered = [...matches].sort(compareForDisambiguation);
    assert.equal(ordered[0].officer.rank, "พ.ต.ต.");
    assert.equal(ordered[0].enrichment.nickname, "ชาย");
  });
});

describe("personnel_search permissions + contracts", () => {
  it("masks officer ids without directory permission", () => {
    assert.equal(maskOfficerId("ภาค4/85", false).includes("***"), true);
    assert.equal(maskOfficerId("ภาค4/85", true), "ภาค4/85");
  });

  it("denies search without permissions", () => {
    const result = searchPersonnel(
      {
        query: "สมชาย",
        client: "test",
        permissions: [],
        nowIso: "2026-07-24T00:00:00.000Z",
      },
      { dataset: dataset([officer("ภาค4/1", { firstName: "สมชาย", lastName: "เอ" })] ) }
    );
    assert.equal(result.resultType, "error");
    assert.ok(result.clarification?.reasonTh.includes("สิทธิ์"));
  });

  it("returns unit summary without dumping officers", () => {
    const officers = [
      officer("ภาค4/1", { companyId: 414, rank: "พ.ต.ท.", currentPosition: "ผบ.ร้อย", firstName: "ก", lastName: "หนึ่ง" }),
      officer("ภาค4/2", { companyId: 414, firstName: "ข", lastName: "สอง" }, { promotionStatus: "AlreadyEligible", displayStatusTh: "ครบคุณสมบัติมาแล้ว" }),
      officer("ภาค4/3", { companyId: 999, firstName: "ค", lastName: "สาม" }),
    ];
    const result = searchPersonnel(
      {
        query: "ร้อย414",
        client: "web",
        permissions: ROLE_PERMISSIONS.commander,
        disclosureLevel: 1,
        nowIso: "2026-07-24T00:00:00.000Z",
      },
      { dataset: dataset(officers) }
    );
    assert.equal(result.intent, "UNIT_LOOKUP");
    assert.equal(result.resultType, "unit_summary");
    assert.equal(result.totalCount, 2);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].kind, "unit");
    if (result.items[0].kind === "unit") {
      assert.equal(result.items[0].officerCount, 2);
      assert.equal(result.items[0].promotionReadyCount, 1);
    }
  });

  it("promotion intent uses PromotionSummary status only", () => {
    const officers = [
      officer("a", {}, { promotionStatus: "EligibleThisYear", displayStatusTh: "ครบในปีนี้", targetLevel: "รองผู้กำกับการ" }),
      officer("b", {}, { promotionStatus: "AlreadyEligible", displayStatusTh: "มาแล้ว" }),
      officer("c", {}, { promotionStatus: "Waiting", displayStatusTh: "รอ" }),
      officer("d", {}, { promotionStatus: "MissingTraining", displayStatusTh: "ขาดหลักสูตร" }),
    ];
    const ready = searchPersonnel(
      { query: "พร้อมเลื่อนปีนี้", client: "api", permissions: ROLE_PERMISSIONS.commander, nowIso: "2026-07-24T00:00:00.000Z" },
      { dataset: dataset(officers) }
    );
    assert.equal(ready.intent, "PROMOTION_SEARCH");
    assert.equal(ready.totalCount, 1);

    const missing = searchPersonnel(
      { query: "ขาดหลักสูตร", client: "api", permissions: ROLE_PERMISSIONS.commander, nowIso: "2026-07-24T00:00:00.000Z" },
      { dataset: dataset(officers) }
    );
    assert.equal(missing.totalCount, 1);
    assert.equal(missing.items[0].kind, "list_entry");
  });

  it("retirement and data-quality intents return list contracts", () => {
    const officers = [
      officer("r1", { retirementStatus: "retiring_within_1_year", retirementYearBe: 2570, flagCodes: ["RETIRING_SOON"] }),
      officer("r2", { retirementYearBe: 2570 }),
      officer(
        "q1",
        { flagCodes: ["PROFILE_INCOMPLETE"] },
        {
          confidence: "incomplete",
          confidenceReasonTh: "ไม่มีปีเริ่มดำรงระดับ",
          missingEvidence: ["current_position_level_start_date"],
          promotionStatus: "Unknown",
        }
      ),
    ];
    const retire = searchPersonnel(
      { query: "เกษียณปี2570", client: "telegram", permissions: ROLE_PERMISSIONS.admin, nowIso: "2026-07-24T00:00:00.000Z" },
      { dataset: dataset(officers) }
    );
    assert.equal(retire.intent, "RETIREMENT_SEARCH");
    assert.equal(retire.totalCount, 2);
    assert.equal(retire.audit.client, "telegram");
    assert.equal(retire.audit.persistReady, false);

    const dq = searchPersonnel(
      { query: "ไม่มีปีเริ่มดำรงระดับ", client: "line", permissions: ROLE_PERMISSIONS.commander, nowIso: "2026-07-24T00:00:00.000Z" },
      { dataset: dataset(officers) }
    );
    assert.equal(dq.intent, "DATA_QUALITY_SEARCH");
    assert.ok(dq.totalCount >= 1);
  });

  it("level 3 includes profile links; level 1 does not", () => {
    const unique = officer("ภาค4/99", { firstName: "เอก", lastName: "เดียว", displayName: "เอก เดียว" });
    const l1 = searchPersonnel(
      { query: "เอก เดียว", client: "web", permissions: ROLE_PERMISSIONS.commander, disclosureLevel: 1, nowIso: "2026-07-24T00:00:00.000Z" },
      { dataset: dataset([unique]) }
    );
    assert.equal(l1.resultType, "person");
    assert.equal(l1.items[0].kind, "person");
    if (l1.items[0].kind === "person") assert.equal(l1.items[0].links, undefined);

    const l3 = searchPersonnel(
      { query: "เอก เดียว", client: "web", permissions: ROLE_PERMISSIONS.commander, disclosureLevel: 3, nowIso: "2026-07-24T00:00:00.000Z" },
      { dataset: dataset([unique]) }
    );
    if (l3.items[0].kind === "person") {
      assert.ok(l3.items[0].links?.profileHref.includes("/officers/"));
    }
  });

  it("contact search respects permission scope", () => {
    const accessOfficer = resolveFieldAccess({ permissions: ROLE_PERMISSIONS.officer });
    assert.equal(accessOfficer.canViewContacts, false);
    const accessCmd = resolveFieldAccess({ permissions: ROLE_PERMISSIONS.commander });
    assert.equal(accessCmd.canViewContacts, true);
  });
});
