/**
 * Phase 51.2 — Telegram adapter presentation tests (mocked API client).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersonnelSearchApiResponse } from "@/lib/personnel_search_api/contracts";
import { parseCallbackData, CALLBACK } from "@/lib/personnel_search_telegram/callback_codes";
import { buildHomeMessage, HOME_MENU_TITLE } from "@/lib/personnel_search_telegram/home_menu";
import { formatPersonnelSearchResultText } from "@/lib/personnel_search_telegram/formatter";
import { buildResultKeyboard } from "@/lib/personnel_search_telegram/keyboard";
import { dispatchTelegramUpdate } from "@/lib/personnel_search_telegram/dispatcher";
import { createMemoryTelegramSessionStore, createFreshSession } from "@/lib/personnel_search_telegram/session";
import { loadTelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import type { PersonnelSearchResult } from "@/lib/personnel_search/contracts";
import type { TelegramOutgoingMessage, TelegramUpdate } from "@/lib/personnel_search_telegram/types";

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
  it("parses home menu and action indices", () => {
    assert.equal(parseCallbackData(CALLBACK.HOME).kind, "home");
    assert.deepEqual(parseCallbackData(CALLBACK.MENU_UNIT), { kind: "menu", menu: "unit" });
    assert.deepEqual(parseCallbackData(CALLBACK.action(2)), { kind: "action", index: 2 });
    assert.deepEqual(parseCallbackData(CALLBACK.PAGE_NEXT), { kind: "page", direction: "next" });
  });
});

describe("telegram home menu", () => {
  it("includes all eight home entries", () => {
    const msg = buildHomeMessage();
    assert.ok(msg.text.includes(HOME_MENU_TITLE.split("\n")[0]));
    const flat = msg.reply_markup!.inline_keyboard.flat().map((b) => b.text);
    assert.ok(flat.some((t) => t.includes("ค้นหากำลังพล")));
    assert.ok(flat.some((t) => t.includes("ค้นหาหน่วย")));
    assert.ok(flat.some((t) => t.includes("เลื่อนตำแหน่ง")));
    assert.ok(flat.some((t) => t.includes("เกษียณ")));
    assert.ok(flat.some((t) => t.includes("หลักสูตร")));
    assert.ok(flat.some((t) => t.includes("เอกสาร")));
    assert.ok(flat.some((t) => t.includes("Dashboard")));
    assert.ok(flat.some((t) => t.includes("วิธีใช้งาน")));
  });
});

describe("telegram formatter + keyboard", () => {
  it("formats unit summary and builds suggestion buttons", () => {
    const result = unitResult();
    const text = formatPersonnelSearchResultText(result);
    assert.ok(text.includes("ร้อย ตชด.414"));
    assert.ok(text.includes("414"));

    const kb = buildResultKeyboard({ result, nextCursor: null, hasPrevious: false });
    const labels = kb.inline_keyboard.flat().map((b) => b.text);
    assert.ok(labels.some((t) => t.includes("กำลังพล")));
    assert.ok(labels.some((t) => t.includes("พร้อมเลื่อน")));
    assert.ok(labels.some((t) => t.includes("เกษียณ")));
    assert.ok(labels.some((t) => t.includes("หลักสูตร")));
    assert.ok(labels.some((t) => t.includes("เอกสาร")));
    assert.ok(labels.some((t) => t.includes("Dashboard")));
    assert.ok(labels.some((t) => t.includes("เมนูหลัก")));
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

describe("telegram dispatcher", () => {
  it("/start shows home menu without calling search API", async () => {
    const sent: TelegramOutgoingMessage[] = [];
    let apiCalls = 0;
    const sessions = createMemoryTelegramSessionStore();
    const config = loadTelegramPersonnelSearchConfig({
      TELEGRAM_SERVICE_USERNAME: "bpp414",
      TELEGRAM_SERVICE_PASSWORD: "414",
    });

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
      apiClient: async () => {
        apiCalls += 1;
        return okResponse(unitResult());
      },
      send: async (_chatId, message) => {
        sent.push(message);
      },
      answerCallback: async () => {},
    });

    assert.equal(apiCalls, 0);
    assert.equal(sent.length, 1);
    assert.ok(sent[0].reply_markup);
    assert.ok(sent[0].text.includes("กำลังพล") || sent[0].text.includes("ผู้ช่วย"));
  });

  it("free-text 414 calls API with client telegram and renders unit buttons", async () => {
    const sent: TelegramOutgoingMessage[] = [];
    const calls: unknown[] = [];
    const sessions = createMemoryTelegramSessionStore();
    const config = loadTelegramPersonnelSearchConfig({
      TELEGRAM_SERVICE_USERNAME: "bpp414",
      TELEGRAM_SERVICE_PASSWORD: "414",
    });

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
        apiClient: async (call) => {
          calls.push(call);
          return okResponse(unitResult());
        },
        send: async (_c, message) => {
          sent.push(message);
        },
        answerCallback: async () => {},
      }
    );

    assert.equal(calls.length, 1);
    assert.equal((calls[0] as { query: string }).query, "414");
    assert.ok(sent[0].text.includes("ร้อย ตชด.414"));
    const labels = sent[0].reply_markup!.inline_keyboard.flat().map((b) => b.text);
    assert.ok(labels.some((t) => t.includes("พร้อมเลื่อน")));

    const session = sessions.get(200);
    assert.ok(session);
    assert.equal(session!.conversationContext.organization?.publicCode, "414");
  });

  it("action callback follows up via API using unit scope from session", async () => {
    const sessions = createMemoryTelegramSessionStore();
    const session = createFreshSession(300, 300, 2);
    session.lastActions = unitResult().actions;
    session.conversationContext = {
      organization: { level: "company", publicCode: "414", displayName: "ร้อย ตชด.414" },
    };
    sessions.set(session);

    const calls: Array<{ query: string; unitScope?: { companyCode?: string } }> = [];
    const config = loadTelegramPersonnelSearchConfig({
      TELEGRAM_SERVICE_USERNAME: "bpp414",
      TELEGRAM_SERVICE_PASSWORD: "414",
    });

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
          data: CALLBACK.action(1), // promotion
        },
      },
      {
        config,
        sessions,
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
      TELEGRAM_SERVICE_USERNAME: "bpp414",
      TELEGRAM_SERVICE_PASSWORD: "414",
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
        sessions: createMemoryTelegramSessionStore(),
        apiClient: async () => okResponse(unitResult()),
        send: async (_c, m) => {
          sent.push(m);
        },
        answerCallback: async () => {},
      }
    );

    assert.equal(sent[0].text.includes("สิทธิ์"), true);
  });

  it("paginates with next cursor via callback", async () => {
    const sessions = createMemoryTelegramSessionStore();
    const session = createFreshSession(400, 400, 2);
    session.lastQuery = "พร้อมเลื่อนปีนี้";
    session.lastNextCursor = "CUR2";
    session.lastCursor = null;
    sessions.set(session);

    const cursors: Array<string | undefined> = [];
    const config = loadTelegramPersonnelSearchConfig({
      TELEGRAM_SERVICE_USERNAME: "bpp414",
      TELEGRAM_SERVICE_PASSWORD: "414",
    });

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
        apiClient: async (call) => {
          cursors.push(call.cursor);
          return okResponse(unitResult(), "CUR3");
        },
        send: async () => {},
        answerCallback: async () => {},
      }
    );

    assert.deepEqual(cursors, ["CUR2"]);
    assert.ok(sessions.get(400)!.cursorStack.length >= 1);
  });
});
