/**
 * Phase 51.2 / 51.3 — Telegram adapter presentation tests (mocked API + principal).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";
import { actorFromAuthUser } from "@/lib/personnel_intelligence_service/permissions";
import { defaultPermissionsForRole } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";
import { parseCallbackData, CALLBACK } from "@/lib/personnel_search_telegram/callback_codes";
import { buildHomeMessage, HOME_MENU_TITLE } from "@/lib/personnel_search_telegram/home_menu";
import { formatPersonnelSearchResultText } from "@/lib/personnel_search_telegram/formatter";
import { buildResultKeyboard } from "@/lib/personnel_search_telegram/keyboard";
import { dispatchTelegramUpdate } from "@/lib/personnel_search_telegram/dispatcher";
import { createFreshSession } from "@/lib/personnel_search_telegram/session";
import { loadTelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import { UNBOUND_MESSAGE_TH } from "@/lib/personnel_search_telegram/unbound";
import type { PersonnelSearchResult } from "@/lib/personnel_search/contracts";
import type { TelegramOutgoingMessage, TelegramUpdate } from "@/lib/personnel_search_telegram/types";
import { createMemoryTelegramSessionStoreV2 } from "@/lib/telegram_identity/session_store";
import { noopTelegramIdentityAuditSink } from "@/lib/telegram_identity/audit";

function mockUser(role: AuthUser["role"]): AuthUser {
  return {
    id: `mock:${role}`,
    username: role,
    displayName: role,
    role,
    permissions: defaultPermissionsForRole(role),
    officerId: role === "officer" ? "ภาค4/79" : null,
    mustChangePassword: false,
    isActive: true,
  };
}

function boundPrincipal(role: AuthUser["role"] = "commander") {
  return async () =>
    ({
      ok: true as const,
      actor: actorFromAuthUser(mockUser(role)),
      bindingId: "bind-1",
    }) as const;
}

function unboundPrincipal(code: "UNBOUND" | "REVOKED" = "UNBOUND") {
  return async () => ({ ok: false as const, code });
}

function unitResult(): PersonnelSearchResult {
  return {
    intent: "UNIT_LOOKUP",
    resultType: "unit_summary",
    totalCount: 3,
    items: [
      {
        kind: "unit",
        level: "company",
        key: "company:414",
        labelTh: "ร้อย ตชด.414",
        publicCode: "414",
        commanderName: "พ.ต.ท. ทดสอบ",
        deputyNames: [],
        officerCount: 3,
        policeCount: 2,
        promotionReadyCount: 1,
        retirementNearCount: 0,
        incompleteDataCount: 0,
        topContacts: [],
      },
    ],
    actions: [
      {
        type: "view_unit",
        labelTh: "ดูกำลังพล",
        labelEn: "View",
        payload: { publicCode: "414", intentHint: "UNIT_LOOKUP" },
      },
      {
        type: "view_promotion",
        labelTh: "ดูผู้พร้อมเลื่อน",
        labelEn: "Promo",
        payload: { publicCode: "414", intentHint: "PROMOTION_SEARCH" },
      },
      {
        type: "refine_query",
        labelTh: "ดูเกษียณ",
        labelEn: "Retire",
        payload: { publicCode: "414", intentHint: "RETIREMENT_SEARCH", queryHint: "ใกล้เกษียณ" },
      },
      {
        type: "view_training",
        labelTh: "ดูหลักสูตร",
        labelEn: "Train",
        payload: { publicCode: "414", intentHint: "TRAINING_SEARCH" },
      },
      {
        type: "view_documents",
        labelTh: "ดูเอกสาร",
        labelEn: "Docs",
        payload: { publicCode: "414", intentHint: "DOCUMENT_SEARCH" },
      },
      {
        type: "open_dashboard",
        labelTh: "เปิด Dashboard",
        labelEn: "Dash",
        payload: { href: "/commander-promotion", publicCode: "414" },
      },
    ],
    clarification: null,
    permissionScope: ["search"],
    disclosureLevel: 2,
    audit: {
      query: "414",
      intent: "UNIT_LOOKUP",
      timestampIso: "2026-07-25T00:00:00.000Z",
      permissionScope: ["search"],
      client: "telegram",
      persistReady: false,
    },
  };
}

function okResponse(result: PersonnelSearchResult, nextCursor: string | null = null): PersonnelSearchApiResponse {
  return {
    ok: true,
    requestId: "req-1",
    result,
    meta: {
      generatedAt: "2026-07-25T00:00:00.000Z",
      client: "telegram",
      disclosureLevel: 2,
      nextCursor,
      resultCount: result.items.length,
      totalCount: result.totalCount,
    },
  };
}

describe("telegram callback codes", () => {
  it("parses home and menu codes", () => {
    assert.deepEqual(parseCallbackData(CALLBACK.HOME), { kind: "home" });
    assert.deepEqual(parseCallbackData(CALLBACK.MENU_UNIT), { kind: "menu", menu: "unit" });
    assert.deepEqual(parseCallbackData(CALLBACK.action(2)), { kind: "action", index: 2 });
    assert.deepEqual(parseCallbackData(CALLBACK.BIND_HELP), { kind: "bind", action: "help" });
  });
});

describe("telegram home + formatter", () => {
  it("builds home menu", () => {
    const msg = buildHomeMessage();
    assert.ok(msg.text.includes(HOME_MENU_TITLE.split("\n")[0].slice(0, 8)) || msg.text.includes("กำลังพล"));
    assert.ok(msg.reply_markup);
  });

  it("formats unit summary without dumping raw JSON", () => {
    const text = formatPersonnelSearchResultText(unitResult());
    assert.ok(text.includes("ร้อย ตชด.414"));
    assert.ok(!text.includes('"kind"'));
  });

  it("adds next/prev pagination buttons", () => {
    const kb = buildResultKeyboard({
      result: unitResult(),
      nextCursor: "cursor-2",
      hasPrevious: true,
    });
    const labels = kb.inline_keyboard.flat().map((b) => b.text);
    assert.ok(labels.some((t) => t.includes("ถัดไป")));
    assert.ok(labels.some((t) => t.includes("ก่อนหน้า")));
  });
});

describe("telegram dispatcher (bound principal)", () => {
  it("/start shows home menu without calling search API", async () => {
    const sent: TelegramOutgoingMessage[] = [];
    let apiCalls = 0;
    const sessions = createMemoryTelegramSessionStoreV2();
    const config = loadTelegramPersonnelSearchConfig({});

    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 100, type: "private" },
        from: { id: 100 },
        text: "/start",
      },
    };

    await dispatchTelegramUpdate(update, {
      config,
      sessions,
      resolvePrincipal: boundPrincipal("commander"),
      apiClient: async () => {
        apiCalls += 1;
        return okResponse(unitResult());
      },
      send: async (_chatId, message) => {
        sent.push(message);
      },
      answerCallback: async () => {},
      auditSink: noopTelegramIdentityAuditSink,
    });

    assert.equal(apiCalls, 0);
    assert.equal(sent.length, 1);
    assert.ok(sent[0].reply_markup);
    assert.ok(sent[0].text.includes("กำลังพล") || sent[0].text.includes("ผู้ช่วย"));
  });

  it("unbound /start does not call search API", async () => {
    const sent: TelegramOutgoingMessage[] = [];
    let apiCalls = 0;
    await dispatchTelegramUpdate(
      {
        update_id: 10,
        message: {
          message_id: 10,
          date: 0,
          chat: { id: 10, type: "private" },
          from: { id: 10 },
          text: "/start",
        },
      },
      {
        config: loadTelegramPersonnelSearchConfig({ TELEGRAM_APP_BASE_URL: "https://app.example" }),
        sessions: createMemoryTelegramSessionStoreV2(),
        resolvePrincipal: unboundPrincipal(),
        apiClient: async () => {
          apiCalls += 1;
          return okResponse(unitResult());
        },
        send: async (_c, m) => {
          sent.push(m);
        },
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );
    assert.equal(apiCalls, 0);
    assert.ok(sent[0].text.includes(UNBOUND_MESSAGE_TH));
  });

  it("free-text 414 calls API once with bound actor (no shared service account)", async () => {
    const sent: TelegramOutgoingMessage[] = [];
    const actors: string[] = [];
    const sessions = createMemoryTelegramSessionStoreV2();
    const config = loadTelegramPersonnelSearchConfig({});

    await dispatchTelegramUpdate(
      {
        update_id: 2,
        message: {
          message_id: 2,
          date: 0,
          chat: { id: 200, type: "private" },
          from: { id: 200 },
          text: "414",
        },
      },
      {
        config,
        sessions,
        resolvePrincipal: boundPrincipal("commander"),
        apiClient: async (call, actor) => {
          actors.push(actor.id);
          assert.equal(call.query, "414");
          return okResponse(unitResult());
        },
        send: async (_c, message) => {
          sent.push(message);
        },
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );

    assert.deepEqual(actors, ["mock:commander"]);
    assert.ok(sent[0].text.includes("ร้อย ตชด.414"));
    const session = await sessions.get("200");
    assert.ok(session);
    assert.equal(session!.conversationContext.organization?.publicCode, "414");
  });

  it("unbound search never invokes API", async () => {
    let apiCalls = 0;
    const sent: TelegramOutgoingMessage[] = [];
    await dispatchTelegramUpdate(
      {
        update_id: 11,
        message: {
          message_id: 11,
          date: 0,
          chat: { id: 11, type: "private" },
          from: { id: 11 },
          text: "414",
        },
      },
      {
        config: loadTelegramPersonnelSearchConfig({}),
        sessions: createMemoryTelegramSessionStoreV2(),
        resolvePrincipal: unboundPrincipal(),
        apiClient: async () => {
          apiCalls += 1;
          return okResponse(unitResult());
        },
        send: async (_c, m) => {
          sent.push(m);
        },
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );
    assert.equal(apiCalls, 0);
    assert.ok(sent[0].text.includes(UNBOUND_MESSAGE_TH));
  });

  it("action callback follows up via API using unit scope from session", async () => {
    const sessions = createMemoryTelegramSessionStoreV2();
    const session = createFreshSession(300, 300, 2);
    session.lastActions = unitResult().actions;
    session.conversationContext = {
      organization: { level: "company", publicCode: "414", displayName: "ร้อย ตชด.414" },
    };
    await sessions.set(session, 3600);

    const calls: Array<{ query: string; unitScope?: { companyCode?: string } }> = [];
    const config = loadTelegramPersonnelSearchConfig({});

    await dispatchTelegramUpdate(
      {
        update_id: 3,
        callback_query: {
          id: "cb1",
          from: { id: 300 },
          message: {
            message_id: 3,
            date: 0,
            chat: { id: 300, type: "private" },
            text: "prev",
          },
          data: CALLBACK.action(1),
        },
      },
      {
        config,
        sessions,
        resolvePrincipal: boundPrincipal("commander"),
        apiClient: async (call) => {
          calls.push(call);
          return okResponse({
            ...unitResult(),
            intent: "PROMOTION_SEARCH",
            resultType: "promotion_list",
            items: [],
            totalCount: 0,
            actions: [],
          });
        },
        send: async () => {},
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].query, "ครบคุณสมบัติมาแล้ว");
    assert.equal(calls[0].unitScope?.companyCode, "414");
  });

  it("rejects users not on the allow-list", async () => {
    const sent: TelegramOutgoingMessage[] = [];
    const config = loadTelegramPersonnelSearchConfig({
      TELEGRAM_ALLOWED_USER_IDS: "999",
    });

    await dispatchTelegramUpdate(
      {
        update_id: 4,
        message: {
          message_id: 4,
          date: 0,
          chat: { id: 1, type: "private" },
          from: { id: 1 },
          text: "414",
        },
      },
      {
        config,
        sessions: createMemoryTelegramSessionStoreV2(),
        resolvePrincipal: boundPrincipal(),
        apiClient: async () => okResponse(unitResult()),
        send: async (_c, m) => {
          sent.push(m);
        },
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );

    assert.equal(sent[0].text.includes("สิทธิ์"), true);
  });

  it("paginates with next cursor via callback", async () => {
    const sessions = createMemoryTelegramSessionStoreV2();
    const session = createFreshSession(400, 400, 2);
    session.lastQuery = "พร้อมเลื่อนปีนี้";
    session.lastNextCursor = "CUR2";
    session.lastCursor = null;
    await sessions.set(session, 3600);

    const cursors: Array<string | undefined> = [];
    const config = loadTelegramPersonnelSearchConfig({});

    await dispatchTelegramUpdate(
      {
        update_id: 5,
        callback_query: {
          id: "cb2",
          from: { id: 400 },
          message: { message_id: 5, date: 0, chat: { id: 400, type: "private" } },
          data: CALLBACK.PAGE_NEXT,
        },
      },
      {
        config,
        sessions,
        resolvePrincipal: boundPrincipal(),
        apiClient: async (call) => {
          cursors.push(call.cursor);
          return okResponse(unitResult(), "CUR3");
        },
        send: async () => {},
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );

    assert.deepEqual(cursors, ["CUR2"]);
    const next = await sessions.get("400");
    assert.ok(next!.cursorStack.length >= 1);
  });

  it("callback cannot use another user's session", async () => {
    const sessions = createMemoryTelegramSessionStoreV2();
    const victim = createFreshSession(1, 111, 2);
    victim.lastQuery = "secret";
    victim.lastNextCursor = "CURX";
    await sessions.set(victim, 3600);

    let apiCalls = 0;
    await dispatchTelegramUpdate(
      {
        update_id: 6,
        callback_query: {
          id: "cb3",
          from: { id: 222 },
          message: { message_id: 6, date: 0, chat: { id: 1, type: "private" } },
          data: CALLBACK.PAGE_NEXT,
        },
      },
      {
        config: loadTelegramPersonnelSearchConfig({}),
        sessions,
        resolvePrincipal: boundPrincipal(),
        apiClient: async () => {
          apiCalls += 1;
          return okResponse(unitResult());
        },
        send: async () => {},
        answerCallback: async () => {},
        auditSink: noopTelegramIdentityAuditSink,
      }
    );
    // Attacker has empty session → expired pagination, no API call.
    assert.equal(apiCalls, 0);
  });
});
