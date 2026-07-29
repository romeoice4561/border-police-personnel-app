/**
 * Phase 51.4 — Commander Mobile Intelligence presentation tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersonnelSearchResult } from "@/lib/personnel_search/contracts";
import { actorFromAuthUser } from "@/lib/personnel_intelligence_service/permissions";
import { defaultPermissionsForRole } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";
import { parseCallbackData, CALLBACK } from "@/lib/personnel_search_telegram/callback_codes";
import {
  formatHomeTodayCard,
  formatListIntelligenceCard,
  formatPersonIntelligenceCard,
  formatUnitIntelligenceCard,
  unitSnapshotFromApiItem,
} from "@/lib/personnel_search_telegram/commander_cards";
import { COMMANDER_QUERIES } from "@/lib/personnel_search_telegram/commander_queries";
import { upsertFavorite, queryForFavorite, normalizeFavorites } from "@/lib/personnel_search_telegram/favorites";
import { formatPersonnelSearchResultText } from "@/lib/personnel_search_telegram/formatter";
import {
  buildFavoritesMessage,
  buildHomeMessage,
  buildQuickActionsMessage,
  buildRecentMessage,
  HOME_MENU_TITLE,
} from "@/lib/personnel_search_telegram/home_menu";
import {
  buildNotificationContract,
  COMMANDER_NOTIFICATION_EVENT_TYPES,
  isCommanderNotificationEventType,
} from "@/lib/personnel_search_telegram/notification_contracts";
import { pushRecentSearch, MAX_RECENT_SEARCHES } from "@/lib/personnel_search_telegram/recent";
import { createFreshSession } from "@/lib/personnel_search_telegram/session";
import { parseCommanderShortcut } from "@/lib/personnel_search_telegram/shortcuts";
import { dispatchTelegramUpdate } from "@/lib/personnel_search_telegram/dispatcher";
import { loadTelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import { createMemoryTelegramSessionStoreV2 } from "@/lib/telegram_identity/session_store";
import { noopTelegramIdentityAuditSink } from "@/lib/telegram_identity/audit";
import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";
import type { TelegramOutgoingMessage } from "@/lib/personnel_search_telegram/types";

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

function boundPrincipal() {
  return async () =>
    ({
      ok: true as const,
      actor: actorFromAuthUser(user()),
      bindingId: "b1",
    }) as const;
}

function unitItem() {
  return {
    kind: "unit" as const,
    level: "company" as const,
    key: "company:414",
    labelTh: "ร้อย ตชด.414",
    publicCode: "414",
    commanderName: "พ.ต.ท. ทดสอบ",
    deputyNames: [],
    officerCount: 10,
    policeCount: 8,
    promotionReadyCount: 3,
    retirementNearCount: 2,
    incompleteDataCount: 1,
    topContacts: [],
  };
}

function personItem(): Extract<PersonnelSearchResult["items"][number], { kind: "person" }> {
  return {
    kind: "person",
    officerId: "ภาค4/79",
    officerIdDisplay: "ภาค4/79",
    rank: "ร.ต.อ.",
    fullName: "สมชาย ใจดี",
    nickname: "ชาย",
    currentPosition: "รอง สว.",
    unitLabel: "ร้อย ตชด.414",
    organizationPublic: { regionCode: "4", divisionCode: "41", companyCode: "414" },
    academyClass: null,
    matchKind: "exact_full_name",
    matchScore: 1,
    intelligence: {
      positionLevel: "รองผู้กำกับการ",
      positionLevelYearCount: 5,
      positionLevelStartYearBe: 2564,
      promotionStatusTh: "มีคุณสมบัติครบมาแล้ว",
      promotionStatus: "AlreadyEligible",
      firstEligibleDate: "2025-10-01",
      firstEligibleYearBe: 2568,
      firstEligibleFiscalYearBe: 2568,
      promotionCyclesPassed: 1,
      requiredTenureYears: 4,
      retirementYearBe: 2570,
      retirementStatus: "near",
      trainingStatusTh: "ขาดหลักสูตร",
      documentReadinessTh: "เอกสารใกล้หมดอายุ",
      dataQualityNotesTh: ["ขาดวันที่บรรจุ"],
    },
  };
}

function okResponse(result: PersonnelSearchResult): PersonnelSearchApiResponse {
  return {
    ok: true,
    requestId: "r1",
    result,
    meta: {
      generatedAt: "2026-07-25T00:00:00.000Z",
      client: "telegram",
      disclosureLevel: 2,
      nextCursor: null,
      resultCount: result.items.length,
      totalCount: result.totalCount,
    },
  };
}

describe("commander home", () => {
  it("builds Personnel Intelligence Today dashboard", () => {
    const session = createFreshSession(1, 1, 2);
    const snap = unitSnapshotFromApiItem(unitItem());
    const msg = buildHomeMessage(session, snap);
    assert.equal(HOME_MENU_TITLE, "Personnel Intelligence");
    assert.ok(msg.text.includes("Today"));
    assert.ok(msg.text.includes("Promotion Ready"));
    assert.ok(msg.text.includes("<b>3</b>"));
    const labels = msg.reply_markup!.inline_keyboard.flat().map((b) => b.text);
    assert.ok(labels.some((t) => t.includes("Favorites")));
    assert.ok(labels.some((t) => t.includes("Recent")));
    assert.ok(labels.some((t) => t.includes("Settings")));
  });

  it("home without snapshot shows placeholders", () => {
    const text = formatHomeTodayCard(null);
    assert.ok(text.includes("Promotion Ready: —"));
    assert.ok(text.includes("Data Quality: —"));
  });
});

describe("commander cards", () => {
  it("formats unit intelligence card from API unit item", () => {
    const text = formatUnitIntelligenceCard(unitItem());
    assert.ok(text.includes("Unit Intelligence"));
    assert.ok(text.includes("พร้อมเลื่อน"));
    assert.ok(text.includes("414"));
  });

  it("formats person intelligence card with API intelligence snippets", () => {
    const text = formatPersonIntelligenceCard(personItem());
    assert.ok(text.includes("Person Intelligence"));
    assert.ok(text.includes("สถานะตำแหน่งและการแต่งตั้ง"));
    assert.ok(text.includes("ระดับตำแหน่ง : รองผู้กำกับการ"));
    assert.ok(text.includes("ดำรงระดับนี้ : 5 ปี"));
    assert.ok(text.includes("ดำรงระดับนี้ตั้งแต่ปี : 2564"));
    assert.ok(text.includes("คุณสมบัติ : ครบขึ้น ผกก."));
    assert.ok(text.includes("สถานะการแต่งตั้ง : มีคุณสมบัติครบมาแล้ว"));
    assert.ok(text.includes("วันที่ครบครั้งแรก : 1 ต.ค. 2568"));
    assert.ok(text.includes("รอบการแต่งตั้ง : ปีที่ 2"));
    assert.ok(text.includes("2570"));
    assert.ok(text.includes("ขาดหลักสูตร"));
  });

  it("person card shows dashes when eligibility scalars are missing or not ready", () => {
    const person = personItem();
    person.intelligence = {
      ...person.intelligence!,
      positionLevel: null,
      positionLevelYearCount: null,
      positionLevelStartYearBe: null,
      promotionStatus: "Waiting",
      promotionStatusTh: "ยังไม่ครบคุณสมบัติ",
      firstEligibleDate: null,
      promotionCyclesPassed: null,
    };
    const text = formatPersonIntelligenceCard(person);
    assert.ok(text.includes("ระดับตำแหน่ง : —"));
    assert.ok(text.includes("ดำรงระดับนี้ : —"));
    assert.ok(text.includes("ดำรงระดับนี้ตั้งแต่ปี : —"));
    assert.ok(text.includes("คุณสมบัติ : —"));
    assert.ok(text.includes("สถานะการแต่งตั้ง : ยังไม่ครบคุณสมบัติ"));
    assert.ok(text.includes("วันที่ครบครั้งแรก : —"));
    assert.ok(text.includes("รอบการแต่งตั้ง : —"));
  });

  it("formats list intelligence cards by result type", () => {
    const promo: PersonnelSearchResult = {
      intent: "PROMOTION_SEARCH",
      resultType: "promotion_list",
      totalCount: 5,
      items: [],
      actions: [],
      clarification: null,
      permissionScope: [],
      disclosureLevel: 2,
      audit: {
        query: "x",
        intent: "PROMOTION_SEARCH",
        timestampIso: "2026-07-25T00:00:00.000Z",
        permissionScope: [],
        client: "telegram",
        persistReady: false,
      },
    };
    assert.ok(formatListIntelligenceCard(promo).includes("Promotion"));
    assert.ok(formatPersonnelSearchResultText(promo).includes("Ready"));
  });
});

describe("favorites & recent", () => {
  it("stores favorites and maps them to search queries", () => {
    let session = createFreshSession(1, 1, 2);
    session = {
      ...session,
      favorites: upsertFavorite(session, {
        kind: "company",
        labelTh: "ร้อย 414",
        publicCode: "414",
        savedAtIso: "2026-07-25T00:00:00.000Z",
      }),
    };
    assert.equal(normalizeFavorites(session.favorites).length, 1);
    assert.ok(queryForFavorite(session.favorites[0])?.includes("414"));
    const msg = buildFavoritesMessage(session);
    assert.ok(msg.text.includes("Favorites"));
    assert.ok(msg.reply_markup!.inline_keyboard.some((row) => row.some((b) => b.text.includes("เปิด"))));
  });

  it("keeps at most 10 recent searches", () => {
    let session = createFreshSession(1, 1, 2);
    for (let i = 0; i < 15; i++) {
      session = {
        ...session,
        recentSearches: pushRecentSearch(session, { query: `q${i}`, labelTh: `q${i}` }),
      };
    }
    assert.equal(session.recentSearches.length, MAX_RECENT_SEARCHES);
    assert.equal(session.recentSearches[0].query, "q14");
    const msg = buildRecentMessage(session);
    assert.ok(msg.text.includes("Recent"));
  });
});

describe("shortcuts", () => {
  it("parses unit and intelligence slash commands", () => {
    assert.deepEqual(parseCommanderShortcut("/414"), {
      kind: "query",
      query: "ร้อย414",
      labelTh: "หน่วย 414",
    });
    assert.deepEqual(parseCommanderShortcut("/41"), {
      kind: "query",
      query: "กก41",
      labelTh: "หน่วย 41",
    });
    const promo = parseCommanderShortcut("/promotion");
    assert.equal(promo.kind, "query");
    assert.ok(promo.kind === "query" && promo.query === COMMANDER_QUERIES.promotion);
    assert.equal(parseCommanderShortcut("/retirement").kind, "query");
    assert.equal(parseCommanderShortcut("/training").kind, "query");
    assert.equal(parseCommanderShortcut("/documents").kind, "query");
    assert.equal(parseCommanderShortcut("/dashboard").kind, "dashboard");
    assert.equal(parseCommanderShortcut("/favorites").kind, "favorites");
    assert.equal(parseCommanderShortcut("/recent").kind, "recent");
  });
});

describe("quick actions & callbacks", () => {
  it("parses quick and favorites callbacks", () => {
    assert.deepEqual(parseCallbackData(CALLBACK.QUICK_PROMOTION), {
      kind: "quick",
      action: "promotion",
    });
    assert.deepEqual(parseCallbackData(CALLBACK.MENU_FAVORITES), { kind: "menu", menu: "favorites" });
    assert.deepEqual(parseCallbackData(CALLBACK.recentOpen(2)), { kind: "recent_open", index: 2 });
    assert.deepEqual(parseCallbackData(CALLBACK.favoriteOpen(1)), { kind: "favorite_open", index: 1 });
  });

  it("quick promotion invokes Personnel Search API once", async () => {
    const calls: string[] = [];
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(
      {
        update_id: 1,
        callback_query: {
          id: "c1",
          from: { id: 9 },
          message: { message_id: 1, date: 0, chat: { id: 9, type: "private" } },
          data: CALLBACK.QUICK_PROMOTION,
        },
      },
      {
        config: loadTelegramPersonnelSearchConfig({}),
        sessions: createMemoryTelegramSessionStoreV2(),
        resolvePrincipal: boundPrincipal(),
        apiClient: async (call) => {
          calls.push(call.query);
          return okResponse({
            intent: "PROMOTION_SEARCH",
            resultType: "promotion_list",
            totalCount: 0,
            items: [],
            actions: [],
            clarification: null,
            permissionScope: [],
            disclosureLevel: 2,
            audit: {
              query: call.query,
              intent: "PROMOTION_SEARCH",
              timestampIso: "2026-07-25T00:00:00.000Z",
              permissionScope: [],
              client: "telegram",
              persistReady: false,
            },
          });
        },
        send: async (_c, m) => {
          sent.push(m);
        },
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );
    assert.deepEqual(calls, [COMMANDER_QUERIES.promotion]);
    assert.equal(sent.length, 1);
  });

  it("shortcut /414 invokes API with unit query", async () => {
    const calls: string[] = [];
    await dispatchTelegramUpdate(
      {
        update_id: 2,
        message: {
          message_id: 2,
          date: 0,
          chat: { id: 8, type: "private" },
          from: { id: 8 },
          text: "/414",
        },
      },
      {
        config: loadTelegramPersonnelSearchConfig({}),
        sessions: createMemoryTelegramSessionStoreV2(),
        resolvePrincipal: boundPrincipal(),
        apiClient: async (call) => {
          calls.push(call.query);
          return okResponse({
            intent: "UNIT_LOOKUP",
            resultType: "unit_summary",
            totalCount: 1,
            items: [unitItem()],
            actions: [],
            clarification: null,
            permissionScope: [],
            disclosureLevel: 2,
            audit: {
              query: call.query,
              intent: "UNIT_LOOKUP",
              timestampIso: "2026-07-25T00:00:00.000Z",
              permissionScope: [],
              client: "telegram",
              persistReady: false,
            },
          });
        },
        send: async () => {},
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );
    assert.deepEqual(calls, ["ร้อย414"]);
  });

  it("quick actions keyboard is presentation-only", () => {
    const session = createFreshSession(1, 1, 2);
    session.conversationContext = {
      organization: { level: "company", publicCode: "414", displayName: "ร้อย 414" },
    };
    const msg = buildQuickActionsMessage(session);
    assert.ok(msg.text.includes("Quick Actions"));
    const labels = msg.reply_markup!.inline_keyboard.flat().map((b) => b.text);
    assert.ok(labels.some((t) => t.includes("Promotion Queue")));
    assert.ok(labels.some((t) => t.includes("My Company")));
  });
});

describe("notification contracts", () => {
  it("exposes reusable event types without scheduling", () => {
    assert.ok(COMMANDER_NOTIFICATION_EVENT_TYPES.includes("PROMOTION_READY"));
    assert.ok(COMMANDER_NOTIFICATION_EVENT_TYPES.includes("BIRTHDAY"));
    assert.ok(isCommanderNotificationEventType("TRANSFER"));
    assert.equal(isCommanderNotificationEventType("UNKNOWN"), false);
    const contract = buildNotificationContract({
      eventType: "DOCUMENT_EXPIRING",
      severity: "attention",
      titleTh: "เอกสารใกล้หมดอายุ",
      bodyTh: "มีเอกสารที่ควรตรวจสอบ",
      suggestedQuery: COMMANDER_QUERIES.documents,
      occurredAtIso: "2026-07-25T00:00:00.000Z",
      subjectRef: { kind: "company", id: "414", labelTh: "ร้อย 414" },
    });
    assert.equal(contract.schemaVersion, 1);
    assert.equal(contract.eventType, "DOCUMENT_EXPIRING");
  });
});
