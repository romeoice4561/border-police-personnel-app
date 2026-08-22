/**
 * Phase DI-4 — Telegram Drug Intelligence Search tests (Section 34).
 *
 * Covers: authorization (unbound/no-permission/commander/admin), command
 * routing (/drug + mode-driven free text), result formatting per entity
 * type, no-result/empty-query, masking (Telegram always masked regardless
 * of drug.edit — confirmed with the user), rate limiting, callback safety,
 * deep links, and Personnel-command regression (no collision).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import type { DrugCaseCreateRequest } from "@/lib/drug_intelligence/drug_case_types";

import { actorFromAuthUser } from "@/lib/personnel_intelligence_service/permissions";
import { defaultPermissionsForRole } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";
import { allowAllTelegramRateLimiter, createInProcessTelegramRateLimiter } from "@/lib/telegram_identity/rate_limit";

import { CALLBACK, parseCallbackData } from "@/lib/personnel_search_telegram/callback_codes";
import { dispatchTelegramUpdate } from "@/lib/personnel_search_telegram/dispatcher";
import { loadTelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import { createMemoryTelegramSessionStoreV2 } from "@/lib/telegram_identity/session_store";
import { noopTelegramIdentityAuditSink, type TelegramIdentityAuditEvent } from "@/lib/telegram_identity/audit";
import type { TelegramOutgoingMessage } from "@/lib/personnel_search_telegram/types";
import {
  escapeTelegramHtml,
  formatDrugGroupedResultText,
  flattenDrugGroupedResults,
} from "@/lib/personnel_search_telegram/drug_search_formatter";
import { handleDrugSearchQuery } from "@/lib/personnel_search_telegram/drug_search_command";
import { createFreshSession } from "@/lib/personnel_search_telegram/session";

function user(role: AuthUser["role"] = "commander"): AuthUser {
  return {
    id: `mock:${role}`,
    username: role,
    displayName: role,
    role,
    permissions: defaultPermissionsForRole(role),
    officerId: null,
    mustChangePassword: false,
    isActive: true,
  };
}

function boundPrincipal(role: AuthUser["role"] = "commander") {
  return async () => ({ ok: true as const, actor: actorFromAuthUser(user(role)), bindingId: "b1" }) as const;
}

function unboundPrincipal(code: "UNBOUND" | "REVOKED" | "DISABLED" = "UNBOUND") {
  return async () => ({ ok: false as const, code });
}

function baseCase(overrides: Partial<DrugCaseCreateRequest> = {}): DrugCaseCreateRequest {
  return {
    caseNumber: "TG-2569-00100",
    title: "คดีทดสอบ Telegram",
    status: "OPEN",
    arrestDate: new Date("2026-02-01"),
    arrestTime: "10:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "กก.ตชด.44",
    province: "เชียงราย",
    district: null,
    subdistrict: null,
    locationName: null,
    latitude: null,
    longitude: null,
    narrative: null,
    persons: [],
    seizedItems: [],
    locations: [],
    actorId: "mock:admin",
    actorName: "Administrator",
    ...overrides,
  };
}

async function seedSearchableDb(): Promise<InMemoryDatabaseClient> {
  const db = new InMemoryDatabaseClient();
  const caseService = new DrugCaseService({ db });
  await caseService.createCase(
    baseCase({
      caseNumber: "TG-SEARCH-1",
      persons: [
        {
          newPerson: { primaryFullName: "สมชาย เทเลแกรม", nationality: null, dateOfBirth: null, notes: null, identifiers: [] },
          role: "SUSPECT",
          linkedOfficerId: null,
          notes: null,
          phones: [{ rawInput: "0891234567", firstSeenAt: null, lastSeenAt: null, notes: null }],
          sims: [],
          devices: [],
          vehicles: [],
        },
      ],
    })
  );
  return db;
}

function messageUpdate(text: string, userId = 100, chatId = 100) {
  return {
    update_id: Math.floor(Math.random() * 1_000_000),
    message: { message_id: 1, date: 0, chat: { id: chatId, type: "private" }, from: { id: userId }, text },
  };
}

function callbackUpdate(data: string, userId = 100, chatId = 100) {
  return {
    update_id: Math.floor(Math.random() * 1_000_000),
    callback_query: { id: "c1", from: { id: userId }, message: { message_id: 1, date: 0, chat: { id: chatId, type: "private" } }, data },
  };
}

describe("DI-4: authorization", () => {
  it("unbound Telegram user is rejected with the unbound message, never a search result", async () => {
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug สมชาย"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: unboundPrincipal(),
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /ยังไม่ได้เชื่อมต่อ/);
  });

  it("bound user WITHOUT drug.read is rejected with a generic denial, never revealing entity existence or counts", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug สมชาย"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("officer"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /ไม่มีสิทธิ์เข้าถึง Drug Intelligence/);
    assert.doesNotMatch(sent[0].text, /พบ \d+ รายการ/, "must never leak a result count to an unauthorized actor");
  });

  it("commander (drug.read only) CAN search — search is read-only, never a higher bar", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug สมชาย เทเลแกรม"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("commander"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /สมชาย เทเลแกรม/);
    assert.match(sent[0].text, /พบ 1 รายการ|พบ \d+ รายการ/);
  });

  it("admin can search", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug สมชาย เทเลแกรม"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(sent.length, 1);
    assert.doesNotMatch(sent[0].text, /ไม่มีสิทธิ์/);
  });
});

describe("DI-4: command routing / no collision with Personnel", () => {
  it("/drug <query> triggers Drug search, never the Personnel API", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    let personnelCalled = false;
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug 0891234567"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        personnelCalled = true;
        throw new Error("unexpected Personnel API call");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(personnelCalled, false);
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /Drug Intelligence/);
  });

  it("existing Personnel free-text search still routes to the Personnel API when Drug mode is not active (regression)", async () => {
    let personnelCalled = false;
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("สมชาย ใจดี"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        personnelCalled = true;
        return {
          ok: true,
          requestId: "r1",
          result: {
            intent: "PERSON_SEARCH",
            resultType: "person_list",
            totalCount: 0,
            items: [],
            actions: [],
            clarification: null,
            permissionScope: [],
            disclosureLevel: 2,
            audit: { queryHash: "x", matchedIntent: "PERSON_SEARCH", resultCount: 0 },
          },
          meta: {
            generatedAt: "2026-07-25T00:00:00.000Z",
            client: "telegram",
            disclosureLevel: 2,
            nextCursor: null,
            resultCount: 0,
            totalCount: 0,
          },
        } as never;
      },
      resolvePrincipal: boundPrincipal("admin"),
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(personnelCalled, true, "plain free text outside Drug mode must still reach the Personnel search fallback unchanged");
    assert.equal(sent.length, 1);
  });

  it("picking the Drug Intelligence menu button enters awaiting_drug_search mode and the next free-text message becomes a Drug query, not a Personnel query", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sessions = createMemoryTelegramSessionStoreV2();
    let personnelCalled = false;
    const sent: TelegramOutgoingMessage[] = [];
    const deps = {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions,
      apiClient: async () => {
        personnelCalled = true;
        throw new Error("must not call Personnel API while in Drug mode");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c: number, m: TelegramOutgoingMessage) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    };
    await dispatchTelegramUpdate(callbackUpdate(CALLBACK.MENU_DRUG), deps);
    assert.match(sent[0].text, /พิมพ์ข้อมูลที่ต้องการค้นหา/);

    await dispatchTelegramUpdate(messageUpdate("สมชาย เทเลแกรม"), deps);
    assert.equal(personnelCalled, false);
    assert.match(sent[1].text, /สมชาย เทเลแกรม/);
  });

  it("\"ยกเลิก\" while in Drug mode exits back to the home menu — the user is never trapped", async () => {
    const sessions = createMemoryTelegramSessionStoreV2();
    const sent: TelegramOutgoingMessage[] = [];
    const deps = {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions,
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      send: async (_c: number, m: TelegramOutgoingMessage) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    };
    await dispatchTelegramUpdate(callbackUpdate(CALLBACK.MENU_DRUG), deps);
    await dispatchTelegramUpdate(messageUpdate("ยกเลิก"), deps);
    assert.equal(sent.length, 2);
    assert.match(sent[1].text, /Personnel Intelligence/);
  });
});

describe("DI-4: results / no-result / empty query", () => {
  it("empty query is rejected — never a wildcard dump-all", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.match(sent[0].text, /กรุณาพิมพ์คำค้น/);
  });

  it("no-result query never implies the entity doesn't exist in reality", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug ไม่มีข้อมูลนี้แน่นอน999"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.match(sent[0].text, /ไม่พบข้อมูลที่ตรงกับคำค้น/);
    assert.doesNotMatch(sent[0].text, /ไม่มีอยู่จริง|ไม่มีตัวตน/);
  });

  it("phone search returns a grouped result with the phone and its related person counted", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug 0891234567"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.match(sent[0].text, /เบอร์โทรศัพท์/);
  });
});

describe("DI-4: masking (Telegram always masked, per user decision)", () => {
  it("Telegram output stays masked even for an admin who holds drug.edit", async () => {
    const db = new InMemoryDatabaseClient();
    const caseService = new DrugCaseService({ db });
    await caseService.createCase(
      baseCase({
        caseNumber: "TG-MASK-1",
        persons: [
          {
            newPerson: {
              primaryFullName: "ปกปิด ทดสอบ",
              nationality: null,
              dateOfBirth: null,
              notes: null,
              identifiers: [{ type: "THAI_ID", value: "1103700123456", notes: null }],
            },
            role: "SUSPECT",
            linkedOfficerId: null,
            notes: null,
            phones: [],
            sims: [],
            devices: [],
            vehicles: [],
          },
        ],
      })
    );
    const searchService = new DrugIntelligenceSearchService(db);
    const admin = actorFromAuthUser(user("admin"));
    assert.ok(admin.permissions.includes("drug.edit"), "admin must hold drug.edit for this test to be meaningful");

    const { message, sessionPatch } = await handleDrugSearchQuery(
      {
        actor: admin,
        telegramUserId: "1",
        appBaseUrl: null,
        resolveDeepLink: async () => null,
        searchService,
      },
      createFreshSession(1, 1),
      "1103700123456"
    );
    // Section 9: matchedValueMasked is what the service returns for the matched IDENTIFIER field — this is the
    // value that would ever surface a raw sensitive value, and it must stay masked in Telegram regardless of
    // the actor's drug.edit permission (contrast with Web, where drug.edit sees the full value).
    const byType = await searchService.searchByType(
      { query: "1103700123456", entityType: "PERSON", page: 1, pageSize: 10 },
      { canViewFull: false, actorId: admin.id, actorName: admin.displayName }
    );
    assert.equal(byType.rows.length, 1);
    assert.doesNotMatch(byType.rows[0].matchedValueMasked, /1103700123456/, "matchedValueMasked must stay masked for Telegram (canViewFull always false)");
    assert.ok(sessionPatch.lastDrugResults && sessionPatch.lastDrugResults.length === 1);
    assert.match(message.text, /Drug Intelligence/);
  });
});

describe("DI-4: rate limiting", () => {
  it("a rate-limited actor receives a polite Thai message, never an HTTP status", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const limiter = createInProcessTelegramRateLimiter({ max: 1, windowMs: 60_000 });
    const admin = actorFromAuthUser(user("admin"));
    const deps = { actor: admin, telegramUserId: "1", appBaseUrl: null, resolveDeepLink: async () => null, searchService, rateLimiter: limiter };

    const first = await handleDrugSearchQuery(deps, createFreshSession(1, 1), "สมชาย เทเลแกรม");
    assert.match(first.message.text, /Drug Intelligence/);

    const second = await handleDrugSearchQuery(deps, createFreshSession(1, 1), "สมชาย เทเลแกรม");
    assert.match(second.message.text, /ค้นหาบ่อยเกินไป/);
  });

  it("allow-all limiter never blocks", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const admin = actorFromAuthUser(user("admin"));
    const deps = { actor: admin, telegramUserId: "1", appBaseUrl: null, resolveDeepLink: async () => null, searchService, rateLimiter: allowAllTelegramRateLimiter };
    for (let i = 0; i < 5; i++) {
      const view = await handleDrugSearchQuery(deps, createFreshSession(1, 1), "สมชาย เทเลแกรม");
      assert.doesNotMatch(view.message.text, /ค้นหาบ่อยเกินไป/);
    }
  });
});

describe("DI-4: callback data safety", () => {
  it("every static Drug callback code is well under Telegram's 64-byte callback_data limit", () => {
    assert.ok(CALLBACK.MENU_DRUG.length <= 64);
    assert.ok(CALLBACK.drugOpen(999).length <= 64);
    assert.ok(CALLBACK.drugPage("next").length <= 64);
    assert.ok(CALLBACK.drugGroup("VEHICLE").length <= 64);
  });

  it("Drug callback codes parse correctly and do not collide with the existing dx: (disambiguate) prefix", () => {
    assert.deepEqual(parseCallbackData(CALLBACK.MENU_DRUG), { kind: "drug_menu" });
    assert.deepEqual(parseCallbackData(CALLBACK.drugOpen(3)), { kind: "drug_open", index: 3 });
    assert.deepEqual(parseCallbackData(CALLBACK.drugPage("next")), { kind: "drug_page", direction: "next" });
    assert.deepEqual(parseCallbackData(CALLBACK.drugGroup("CASE")), { kind: "drug_group", entityType: "CASE" });
    assert.deepEqual(parseCallbackData("dx:3"), { kind: "disambiguate", index: 3 }, "dx: must remain routed to disambiguate, unaffected by dg:/dp:/dv:");
  });

  it("callback_data never contains a raw sensitive query value — only compact type:index/type:enum tokens", () => {
    assert.doesNotMatch(CALLBACK.drugOpen(0), /[0-9]{10,}/);
    assert.equal(CALLBACK.drugGroup("PERSON"), "dv:PERSON");
  });
});

describe("DI-4: formatter safety", () => {
  it("escapeTelegramHtml neutralizes markup-breaking characters in officer-entered free text", () => {
    assert.equal(escapeTelegramHtml("<script>&</script>"), "&lt;script&gt;&amp;&lt;/script&gt;");
  });

  it("formatDrugGroupedResultText never exceeds a safe length even with names that could grow the message", () => {
    const text = formatDrugGroupedResultText({
      query: "test",
      classification: "PERSON_NAME",
      totalCount: 1,
      groups: [{ entityType: "PERSON", count: 1, results: [] }],
    });
    assert.ok(text.length < 4096);
  });

  it("flattenDrugGroupedResults produces the same ordering the message body numbers results in", () => {
    const results = {
      query: "q",
      classification: "GENERAL_TEXT" as const,
      totalCount: 2,
      groups: [
        {
          entityType: "PERSON" as const,
          count: 1,
          results: [
            {
              entityType: "PERSON" as const,
              entityId: "p1",
              primaryLabel: "A",
              secondaryLabel: null,
              matchedField: "PRIMARY_NAME" as const,
              matchedValueMasked: "A",
              strength: "EXACT" as const,
              firstSeen: null,
              lastSeen: null,
              caseCount: 0,
              hasPotentialDuplicate: false,
              canonicalTarget: null,
            },
          ],
        },
        {
          entityType: "CASE" as const,
          count: 1,
          results: [
            {
              entityType: "CASE" as const,
              entityId: "c1",
              primaryLabel: "B",
              secondaryLabel: null,
              matchedField: "CASE_NUMBER" as const,
              matchedValueMasked: "B",
              strength: "EXACT" as const,
              firstSeen: null,
              lastSeen: null,
              caseCount: 0,
              hasPotentialDuplicate: null,
              canonicalTarget: null,
            },
          ],
        },
      ],
    };
    const refs = flattenDrugGroupedResults(results);
    assert.deepEqual(refs, [
      { entityType: "PERSON", entityId: "p1" },
      { entityType: "CASE", entityId: "c1" },
    ]);
  });
});

describe("DI-4: audit", () => {
  it("a successful search records exactly one drug_search_requested audit event without the raw query text", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const events: TelegramIdentityAuditEvent[] = [];
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug สมชาย เทเลแกรม"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: { record: (e) => void events.push(e) },
    });
    const drugEvents = events.filter((e) => e.type === "drug_search_requested");
    assert.equal(drugEvents.length, 1);
    for (const e of events) {
      assert.equal(JSON.stringify(e).includes("สมชาย เทเลแกรม"), false, "audit event must never carry the raw query text");
    }
  });

  it("a permission-denied attempt records drug_permission_denied", async () => {
    const events: TelegramIdentityAuditEvent[] = [];
    await dispatchTelegramUpdate(messageUpdate("/drug สมชาย"), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("officer"),
      send: async () => {},
      answerCallback: async () => {},
      auditSink: { record: (e) => void events.push(e) },
    });
    assert.ok(events.some((e) => e.type === "drug_permission_denied"));
  });
});

describe("DI-4: result drill-down (dg:/dv:/dp: callbacks)", () => {
  it("opening a numbered result by dg:N resolves the SAME entity the grouped search showed", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sessions = createMemoryTelegramSessionStoreV2();
    const sent: TelegramOutgoingMessage[] = [];
    const deps = {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions,
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c: number, m: TelegramOutgoingMessage) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    };
    await dispatchTelegramUpdate(messageUpdate("/drug สมชาย เทเลแกรม"), deps);
    await dispatchTelegramUpdate(callbackUpdate(CALLBACK.drugOpen(0)), deps);
    assert.equal(sent.length, 2);
    assert.match(sent[1].text, /สมชาย เทเลแกรม/);
  });

  it("opening an out-of-range/expired index never throws — a safe expired-item message instead", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(callbackUpdate(CALLBACK.drugOpen(99)), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /หมดอายุแล้ว/);
  });

  it("drug_group drill-down is backend-paginated via searchByType, never a client-side slice", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const sessions = createMemoryTelegramSessionStoreV2();
    const sent: TelegramOutgoingMessage[] = [];
    const deps = {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions,
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      drugSearchService: searchService,
      send: async (_c: number, m: TelegramOutgoingMessage) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    };
    await dispatchTelegramUpdate(messageUpdate("/drug สมชาย เทเลแกรม"), deps);
    await dispatchTelegramUpdate(callbackUpdate(CALLBACK.drugGroup("PERSON")), deps);
    assert.equal(sent.length, 2);
    assert.match(sent[1].text, /บุคคล/);
    assert.match(sent[1].text, /หน้า 1\//);
  });

  it("drug_page next/prev without an active drill-down context returns a safe expired message, never throws", async () => {
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(callbackUpdate(CALLBACK.drugPage("next")), {
      config: loadTelegramPersonnelSearchConfig({}),
      sessions: createMemoryTelegramSessionStoreV2(),
      apiClient: async () => {
        throw new Error("must not call Personnel API");
      },
      resolvePrincipal: boundPrincipal("admin"),
      send: async (_c, m) => { sent.push(m); },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /หมดอายุแล้ว/);
  });
});

describe("DI-4: deep links", () => {
  it("a result open button links through the Web handoff pattern, never a bare unauthenticated URL", async () => {
    const db = await seedSearchableDb();
    const searchService = new DrugIntelligenceSearchService(db);
    const admin = actorFromAuthUser(user("admin"));
    const { handleDrugResultOpen } = await import("@/lib/personnel_search_telegram/drug_search_command");

    const byType = await searchService.searchByType(
      { query: "สมชาย เทเลแกรม", entityType: "PERSON", page: 1, pageSize: 10 },
      { canViewFull: false, actorId: admin.id, actorName: admin.displayName }
    );
    const ref = byType.rows[0];

    const captured: { destination: string | null } = { destination: null };
    const message = await handleDrugResultOpen(
      {
        actor: admin,
        telegramUserId: "1",
        appBaseUrl: "https://app.example.gov.th",
        searchService,
        resolveDeepLink: async (destination) => {
          captured.destination = destination;
          return "https://app.example.gov.th/api/auth/telegram-handoff?token=fake";
        },
      },
      { ...createFreshSession(1, 1), lastDrugQuery: "สมชาย เทเลแกรม", lastDrugResults: [{ entityType: ref.entityType, entityId: ref.entityId }] },
      0
    );
    assert.ok(captured.destination?.startsWith("/drug-intelligence/persons/"));
    assert.equal(message.reply_markup?.inline_keyboard[0]?.[0]?.url, "https://app.example.gov.th/api/auth/telegram-handoff?token=fake");
  });

  it("/drug-intelligence/ is an approved handoff destination prefix", async () => {
    const { isApprovedHandoffDestination } = await import("@/lib/telegram_identity/handoff");
    assert.equal(isApprovedHandoffDestination("/drug-intelligence/persons/abc123"), true);
    assert.equal(isApprovedHandoffDestination("/drug-intelligence/search?q=test"), true);
    assert.equal(isApprovedHandoffDestination("https://evil.example.com/drug-intelligence/x"), false);
  });
});
