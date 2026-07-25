/**
 * Phase 51.1 — Personnel Search API handler tests (injected fakes, no live DB).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { ROLE_PERMISSIONS } from "@/lib/auth/roles";
import type { CommanderQueryDataset, CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";
import type { OfficerDocumentIntelligence } from "@/lib/integration/documents/document_intelligence_contract";
import type { PersonnelSearchActor } from "@/lib/personnel_search_api/authentication";
import { handlePersonnelSearchRequest } from "@/lib/personnel_search_api/handler";
import { applyOrganizationFilter } from "@/lib/personnel_search_api/organization_filter";
import { encodeCursor, buildSearchFingerprint, decodeCursor } from "@/lib/personnel_search_api/pagination";
import { sanitizePersonnelSearchResult } from "@/lib/personnel_search_api/sanitize";
import { PersonnelSearchApiError } from "@/lib/personnel_search_api/errors";
import { validatePersonnelSearchApiBody } from "@/lib/personnel_search_api/validation";
import type { PersonnelSearchResult } from "@/lib/personnel_search/contracts";
import type { OrgTree } from "@/lib/organization/org_tree";

const TEST_ORG_TREE: OrgTree = {
  headquarters: [],
  regions: [{ id: 100, code: "4", nameTh: "ภาค 4", headquartersId: null }],
  battalions: [{ id: 200, code: "41", nameTh: "กก.ตชด.41", regionId: 100 }],
  companies: [
    { id: 57, code: "414", nameTh: "ร้อย ตชด.414", battalionId: 200 },
    { id: 58, code: "415", nameTh: "ร้อย ตชด.415", battalionId: 200 },
  ],
};

function promo(partial: Partial<PromotionSummary> = {}): PromotionSummary {
  return {
    available: true,
    status: "eligible",
    eligibleNow: true,
    monthsUntilEligible: 0,
    overdueYears: 0,
    eligibleYearOrdinal: 1,
    targetLevel: "รองผู้กำกับการ",
    currentRank: "พ.ต.ท.",
    currentPosition: "สารวัตร",
    targetRank: "รองผู้กำกับการ",
    targetPosition: "รองผู้กำกับการ",
    promotionStatus: "AlreadyEligible",
    eligibleDate: null,
    eligibleFiscalYearBe: 2569,
    firstEligibleDate: null,
    firstEligibleYearBe: 2569,
    firstEligibleFiscalYearBe: 2569,
    yearsEligible: 0,
    monthsEligible: 0,
    daysEligible: 0,
    promotionCyclesPassed: 1,
    displayEligibleSinceTh: null,
    displayStatusTh: "ครบคุณสมบัติมาแล้ว",
    displayReasonTh: null,
    remainingTenureYears: 0,
    displayRemainingTenureTh: "ครบแล้ว",
    requiredTenureYears: 5,
    waitingReasonTh: null,
    confidence: "confirmed",
    confidenceReasonTh: null,
    missingEvidence: [],
    priority: 80,
    priorityReason: "AlreadyEligible",
    ...partial,
  } as PromotionSummary;
}

function officer(id: string, overrides: Partial<CommanderQueryOfficer> = {}): CommanderQueryOfficer {
  return {
    officerId: id,
    rank: "พ.ต.ท.",
    firstName: "ทดสอบ",
    lastName: id,
    displayName: `ทดสอบ ${id}`,
    currentPosition: "สารวัตร",
    positionLevel: "สารวัตร",
    currentUnit: "ร้อย ตชด.414",
    regionId: 100,
    battalionId: 200,
    companyId: 57,
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
    promotionStatus: "eligible",
    retirementStatus: "normal",
    priority: "medium",
    profileCompletenessPercent: 80,
    flags: [],
    flagCodes: [],
    hasGp7: true,
    hasOfficialPortrait: true,
    hasTraining: true,
    hasDocuments: true,
    academyClass: 65,
    isGpfMember: null,
    isCooperativeMember: null,
    cooperativeName: null,
    eligibleTwoStep: false,
    mustSkipStep: false,
    skillSignals: [],
    nextLevelEligibility: null,
    promotionIntelligence: promo(),
    trainingIntelligence: {
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
      displayStatusTh: "—",
      recommendationsTh: [],
      dataQualityFlags: [],
    } as TrainingSummary,
    dateOfBirth: null,
    displayServiceDurationTh: null,
    positionLevelStartYearBe: 2564,
    rankStartedAtYearBe: 2560,
    yearsInRankCount: 6,
    displayAgeYearsMonthsTh: null,
    appointmentCycle: 2567,
    eligibleCycle: 2569,
    overdueCycles: 0,
    promotionCycleBucket: "eligible_this_cycle",
    thumbnailUrl: null,
    driveFileId: null,
    webViewUrl: null,
    officialPortraitUrl: null,
    documentIntelligence: {
      officerId: id,
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
      primaryActionLabelTh: "—",
      drillDownQuery: {},
    } as OfficerDocumentIntelligence,
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

function commanderActor(overrides: Partial<PersonnelSearchActor> = {}): PersonnelSearchActor {
  return {
    id: "u-cmd",
    username: "bpp414",
    displayName: "Commander",
    role: "commander",
    permissions: ROLE_PERMISSIONS.commander,
    officerId: null,
    ...overrides,
  };
}

function officerActor(): PersonnelSearchActor {
  return {
    id: "u-off",
    username: "officer1",
    displayName: "Officer",
    role: "officer",
    permissions: ROLE_PERMISSIONS.officer,
    officerId: "ภาค4/1",
  };
}

function request(body: unknown, init?: { method?: string; contentType?: string | null }): NextRequest {
  const headers = new Headers();
  if (init?.contentType !== null) {
    headers.set("content-type", init?.contentType ?? "application/json");
  }
  return new NextRequest("http://localhost:3000/api/personnel-search", {
    method: init?.method ?? "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("personnel_search_api validation", () => {
  it("accepts a valid request", () => {
    const v = validatePersonnelSearchApiBody({ query: "ร้อย 414", disclosureLevel: 1, client: "web" });
    assert.equal(v.query, "ร้อย 414");
    assert.equal(v.limit, 10);
  });

  it("rejects empty query", () => {
    assert.throws(
      () => validatePersonnelSearchApiBody({ query: "   " }),
      (e: unknown) => e instanceof PersonnelSearchApiError && e.code === "INVALID_REQUEST"
    );
  });

  it("rejects overly long query", () => {
    assert.throws(
      () => validatePersonnelSearchApiBody({ query: "ก".repeat(201) }),
      (e: unknown) => e instanceof PersonnelSearchApiError && e.code === "QUERY_TOO_LONG"
    );
  });

  it("rejects invalid disclosure level", () => {
    assert.throws(
      () => validatePersonnelSearchApiBody({ query: "test", disclosureLevel: 9 }),
      (e: unknown) => e instanceof PersonnelSearchApiError && e.code === "INVALID_DISCLOSURE_LEVEL"
    );
  });

  it("rejects excessive limit and invalid client", () => {
    assert.throws(
      () => validatePersonnelSearchApiBody({ query: "x", limit: 100 }),
      (e: unknown) => e instanceof PersonnelSearchApiError && e.code === "INVALID_REQUEST"
    );
    assert.throws(
      () => validatePersonnelSearchApiBody({ query: "x", client: "botnet" }),
      (e: unknown) => e instanceof PersonnelSearchApiError && e.code === "INVALID_REQUEST"
    );
  });
});

describe("personnel_search_api pagination", () => {
  it("round-trips opaque cursors and rejects invalid ones", () => {
    const k = buildSearchFingerprint({ query: "q", disclosureLevel: 1, userId: "u1" });
    const cursor = encodeCursor({ o: 10, k });
    assert.equal(decodeCursor(cursor, k), 10);
    assert.throws(() => decodeCursor("!!!", k));
    assert.throws(() => decodeCursor(encodeCursor({ o: 10, k: "other" }), k));
  });
});

describe("personnel_search_api organization filter", () => {
  it("filters company scope without mutating officers", () => {
    const a = officer("ภาค4/1", { companyId: 414 });
    const b = officer("ภาค4/2", { companyId: 415 });
    const ds = dataset([a, b]);
    const filtered = applyOrganizationFilter(ds, { companyId: 414 });
    assert.equal(filtered.officers.length, 1);
    assert.equal(filtered.officers[0].officerId, "ภาค4/1");
    assert.equal(ds.officers.length, 2);
  });
});

describe("personnel_search_api sanitize", () => {
  it("hashes audit query and strips unapproved hrefs", () => {
    const result = {
      intent: "PERSON_LOOKUP",
      resultType: "person",
      totalCount: 1,
      items: [
        {
          kind: "person",
          officerId: "ภาค4/1",
          officerIdDisplay: "ภ***/1",
          rank: "พ.ต.ท.",
          fullName: "ทดสอบ",
          nickname: null,
          currentPosition: null,
          unitLabel: "x",
          organizationPublic: { regionCode: "4", divisionCode: "41", companyCode: "414" },
          academyClass: null,
          matchKind: "exact_full_name",
          matchScore: 900,
          links: { profileHref: "/officers/ภาค4%2F1", promotionHref: "https://evil.example" },
        },
      ],
      actions: [
        {
          type: "open_profile",
          labelTh: "เปิด",
          labelEn: "Open",
          payload: { href: "https://evil.example/x", officerId: "ภาค4/1" },
        },
      ],
      clarification: null,
      permissionScope: ["search"],
      disclosureLevel: 3,
      audit: {
        query: "สมชาย",
        intent: "PERSON_LOOKUP",
        timestampIso: "2026-07-24T00:00:00.000Z",
        permissionScope: ["search"],
        client: "web",
        persistReady: false,
      },
    } as PersonnelSearchResult;

    const sanitized = sanitizePersonnelSearchResult(result);
    assert.notEqual(sanitized.audit.query, "สมชาย");
    assert.equal(sanitized.audit.query.length, 24);
    assert.equal(sanitized.actions[0].payload.href, undefined);
    if (sanitized.items[0].kind === "person") {
      assert.equal(sanitized.items[0].links?.promotionHref, null);
      assert.ok(sanitized.items[0].links?.profileHref.startsWith("/officers/"));
    }
  });
});

describe("personnel_search_api handler", () => {
  const officers = [
    officer("ภาค4/1", { firstName: "ชลัช", lastName: "ใจดี", displayName: "ชลัช ใจดี", companyId: 57 }),
    officer("ภาค4/2", { firstName: "สมชาย", lastName: "เอ", displayName: "สมชาย เอ", companyId: 57 }),
    officer("ภาค4/3", {
      firstName: "สมชาย",
      lastName: "บี",
      displayName: "สมชาย บี",
      rank: "ร.ต.อ.",
      companyId: 58,
    }),
  ];
  const ds = dataset(officers);
  const enrichment = new Map([
    ["ภาค4/1", { nickname: "ชา", dutyPhone: "0811111111", phones: ["0811111111"] }],
  ]);
  const orgDeps = {
    loadOrganizationTree: async () => TEST_ORG_TREE,
  };

  it("rejects anonymous callers", async () => {
    const res = await handlePersonnelSearchRequest(request({ query: "ร้อย414" }), {
      resolveActor: async () => {
        throw new PersonnelSearchApiError("UNAUTHENTICATED", "Authentication required", 401);
      },
      loadDataset: async () => ds,
      loadEnrichment: async () => enrichment,
      ...orgDeps,
      auditSink: { record() {} },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });

  it("ignores user-supplied role and returns unit summary", async () => {
    let datasetLoads = 0;
    let enrichmentLoads = 0;
    const res = await handlePersonnelSearchRequest(
      request({ query: "ร้อย414", role: "admin", permissions: [], disclosureLevel: 1, client: "web" }),
      {
        resolveActor: async () => commanderActor(),
        loadDataset: async () => {
          datasetLoads += 1;
          return ds;
        },
        loadEnrichment: async () => {
          enrichmentLoads += 1;
          return enrichment;
        },
        ...orgDeps,
        auditSink: { record() {} },
      }
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(datasetLoads, 1);
    assert.equal(enrichmentLoads, 1);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.result.intent, "UNIT_LOOKUP");
    assert.equal(body.result.resultType, "unit_summary");
    assert.notEqual(body.result.audit.query, "ร้อย414");
    assert.equal(body.result.items[0].publicCode, "414");
  });

  it("returns person lookup and preserves duplicate-name clarification", async () => {
    const res = await handlePersonnelSearchRequest(request({ query: "สมชาย", disclosureLevel: 2 }), {
      resolveActor: async () => commanderActor(),
      loadDataset: async () => ds,
      loadEnrichment: async () => new Map(),
      ...orgDeps,
      auditSink: { record() {} },
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.result.resultType, "person_disambiguation");
    assert.ok(body.result.clarification);
    assert.equal(body.meta.nextCursor, null);
  });

  it("supports disclosure levels and promotion list", async () => {
    const res = await handlePersonnelSearchRequest(
      request({ query: "ครบคุณสมบัติมาแล้ว", disclosureLevel: 2, client: "internal" }),
      {
        resolveActor: async () => commanderActor(),
        loadDataset: async () => ds,
        loadEnrichment: async () => enrichment,
        ...orgDeps,
        auditSink: { record() {} },
      }
    );
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.result.intent, "PROMOTION_SEARCH");
    assert.equal(body.meta.client, "api");
    assert.equal(body.meta.disclosureLevel, 2);
  });

  it("rejects officer unitScope as OUT_OF_SCOPE", async () => {
    const res = await handlePersonnelSearchRequest(
      request({ query: "ร้อย414", unitScope: { companyCode: "414" } }),
      {
        resolveActor: async () => officerActor(),
        loadDataset: async () => ds,
        loadEnrichment: async () => new Map(),
        ...orgDeps,
        auditSink: { record() {} },
      }
    );
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, "OUT_OF_SCOPE");
  });

  it("rejects malformed JSON and missing content-type", async () => {
    const bad = new NextRequest("http://localhost:3000/api/personnel-search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await handlePersonnelSearchRequest(bad, {
      resolveActor: async () => commanderActor(),
      loadDataset: async () => ds,
      loadEnrichment: async () => new Map(),
      ...orgDeps,
      auditSink: { record() {} },
    });
    assert.equal(res.status, 400);

    const res2 = await handlePersonnelSearchRequest(request({ query: "x" }, { contentType: null }), {
      resolveActor: async () => commanderActor(),
      loadDataset: async () => ds,
      loadEnrichment: async () => new Map(),
      ...orgDeps,
      auditSink: { record() {} },
    });
    assert.equal(res2.status, 415);
  });

  it("pages list results with a valid next cursor", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      officer(`ภาค4/${i + 10}`, {
        firstName: "ราย",
        lastName: `การ${i}`,
        displayName: `ราย การ${i}`,
        promotionIntelligence: promo({
          promotionStatus: "EligibleThisYear",
          displayStatusTh: "พร้อมเลื่อนปีนี้",
        }),
      })
    );

    const res = await handlePersonnelSearchRequest(
      request({ query: "พร้อมเลื่อนปีนี้", disclosureLevel: 1, limit: 5, client: "web" }),
      {
        resolveActor: async () => commanderActor(),
        loadDataset: async () => dataset(many),
        loadEnrichment: async () => new Map(),
        ...orgDeps,
        auditSink: { record() {} },
      }
    );
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.meta.nextCursor);
    assert.ok(body.result.items.length <= 5);

    const res2 = await handlePersonnelSearchRequest(
      request({
        query: "พร้อมเลื่อนปีนี้",
        disclosureLevel: 1,
        limit: 5,
        cursor: body.meta.nextCursor,
      }),
      {
        resolveActor: async () => commanderActor(),
        loadDataset: async () => dataset(many),
        loadEnrichment: async () => new Map(),
        ...orgDeps,
        auditSink: { record() {} },
      }
    );
    const body2 = await res2.json();
    assert.equal(body2.ok, true);
  });

  it("records audit without raw query text", async () => {
    const events: unknown[] = [];
    await handlePersonnelSearchRequest(request({ query: "ชลัช ใจดี" }), {
      resolveActor: async () => commanderActor(),
      loadDataset: async () => ds,
      loadEnrichment: async () => enrichment,
      ...orgDeps,
      auditSink: {
        record(event) {
          events.push(event);
        },
      },
    });
    assert.equal(events.length, 1);
    const event = events[0] as { normalizedQueryHash?: string; outcome: string };
    assert.ok(event.normalizedQueryHash);
    assert.equal(event.outcome, "success");
    assert.equal(JSON.stringify(events).includes("ชลัช"), false);
  });
});
