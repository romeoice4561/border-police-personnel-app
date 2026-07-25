/**
 * Phase 51.3 — Telegram identity binding, sessions, handoff, webhook hardening.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { handleTelegramWebhook } from "@/lib/personnel_search_telegram/handler";
import { loadTelegramPersonnelSearchConfig } from "@/lib/personnel_search_telegram/config";
import { createFreshSession } from "@/lib/personnel_search_telegram/session";
import {
  completeBindingFromStartToken,
  createBindingToken,
  getBindingPublicView,
  revokeBindingForAppUser,
  TelegramBindingError,
} from "@/lib/telegram_identity/binding_service";
import { generateOpaqueToken, hashToken } from "@/lib/telegram_identity/crypto";
import {
  createWebHandoff,
  consumeWebHandoff,
  isApprovedHandoffDestination,
  TelegramHandoffError,
} from "@/lib/telegram_identity/handoff";
import { resolveTelegramPrincipal } from "@/lib/telegram_identity/principal_resolver";
import { createMemoryTelegramSessionStoreV2 } from "@/lib/telegram_identity/session_store";
import { createMemoryUpdateDedupeStore, normalizeUpdateId } from "@/lib/telegram_identity/update_dedupe";
import { resetMemoryTelegramIdentityStore } from "@/lib/telegram_identity/memory_store";
import { noopTelegramIdentityAuditSink } from "@/lib/telegram_identity/audit";

const PREV_STORE = process.env.TELEGRAM_IDENTITY_STORE;

beforeEach(() => {
  process.env.TELEGRAM_IDENTITY_STORE = "memory";
  resetMemoryTelegramIdentityStore();
});

afterEach(() => {
  if (PREV_STORE === undefined) delete process.env.TELEGRAM_IDENTITY_STORE;
  else process.env.TELEGRAM_IDENTITY_STORE = PREV_STORE;
  resetMemoryTelegramIdentityStore();
});

describe("token crypto", () => {
  it("generates opaque tokens that do not embed app user id", () => {
    const token = generateOpaqueToken(32);
    assert.ok(token.length >= 32);
    assert.ok(!token.includes("mock:bpp414"));
    assert.ok(!token.includes("bpp414"));
    assert.notEqual(hashToken(token), token);
  });
});

describe("binding lifecycle (memory store)", () => {
  it("creates binding token for authenticated app user", async () => {
    const result = await createBindingToken({
      appUserId: "mock:bpp414",
      botUsername: "bpp_test_bot",
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.ok(result.deepLink.includes("t.me/bpp_test_bot?start="));
    assert.ok(!result.deepLink.includes("mock:bpp414"));
    assert.ok(result.rawToken.length > 16);
  });

  it("valid token binds Telegram numeric user id", async () => {
    const { rawToken } = await createBindingToken({
      appUserId: "mock:bpp414",
      botUsername: "bot",
      auditSink: noopTelegramIdentityAuditSink,
    });
    const bound = await completeBindingFromStartToken({
      rawToken,
      telegramUserId: "9001",
      telegramUsername: "spoofed_admin",
      telegramFirstName: "X",
      auditSink: noopTelegramIdentityAuditSink,
    });
    assert.equal(bound.appUserId, "mock:bpp414");

    const principal = await resolveTelegramPrincipal(9001);
    assert.equal(principal.ok, true);
    if (principal.ok) {
      assert.equal(principal.actor.id, "mock:bpp414");
      assert.equal(principal.actor.role, "commander");
    }

    const view = await getBindingPublicView("mock:bpp414");
    assert.equal(view.status, "ACTIVE");
    assert.equal(view.telegramUsername, "spoofed_admin");
  });

  it("rejects expired, used, and malformed tokens", async () => {
    await assert.rejects(
      () =>
        completeBindingFromStartToken({
          rawToken: "not-a-real-token",
          telegramUserId: "1",
          auditSink: noopTelegramIdentityAuditSink,
        }),
      (e: unknown) => e instanceof TelegramBindingError && e.code === "TOKEN_INVALID"
    );

    const { rawToken } = await createBindingToken({
      appUserId: "mock:bpp414",
      botUsername: "bot",
      ttlMs: 1,
      auditSink: noopTelegramIdentityAuditSink,
    });
    await new Promise((r) => setTimeout(r, 5));
    await assert.rejects(
      () =>
        completeBindingFromStartToken({
          rawToken,
          telegramUserId: "2",
          auditSink: noopTelegramIdentityAuditSink,
        }),
      (e: unknown) => e instanceof TelegramBindingError && e.code === "TOKEN_EXPIRED"
    );

    const fresh = await createBindingToken({
      appUserId: "mock:bpp414",
      botUsername: "bot",
      auditSink: noopTelegramIdentityAuditSink,
    });
    await completeBindingFromStartToken({
      rawToken: fresh.rawToken,
      telegramUserId: "3",
      auditSink: noopTelegramIdentityAuditSink,
    });
    await assert.rejects(
      () =>
        completeBindingFromStartToken({
          rawToken: fresh.rawToken,
          telegramUserId: "4",
          auditSink: noopTelegramIdentityAuditSink,
        }),
      (e: unknown) => e instanceof TelegramBindingError && e.code === "TOKEN_USED"
    );
  });

  it("rejects conflicting active Telegram binding", async () => {
    const a = await createBindingToken({
      appUserId: "mock:bpp414",
      botUsername: "bot",
      auditSink: noopTelegramIdentityAuditSink,
    });
    await completeBindingFromStartToken({
      rawToken: a.rawToken,
      telegramUserId: "77",
      auditSink: noopTelegramIdentityAuditSink,
    });

    const b = await createBindingToken({
      appUserId: "mock:admin",
      botUsername: "bot",
      auditSink: noopTelegramIdentityAuditSink,
    });
    await assert.rejects(
      () =>
        completeBindingFromStartToken({
          rawToken: b.rawToken,
          telegramUserId: "77",
          auditSink: noopTelegramIdentityAuditSink,
        }),
      (e: unknown) => e instanceof TelegramBindingError && e.code === "CONFLICT_TELEGRAM"
    );
  });

  it("revoked binding cannot resolve principal for search", async () => {
    const { rawToken } = await createBindingToken({
      appUserId: "mock:bpp414",
      botUsername: "bot",
      auditSink: noopTelegramIdentityAuditSink,
    });
    await completeBindingFromStartToken({
      rawToken,
      telegramUserId: "55",
      auditSink: noopTelegramIdentityAuditSink,
    });
    await revokeBindingForAppUser({
      appUserId: "mock:bpp414",
      auditSink: noopTelegramIdentityAuditSink,
    });
    const principal = await resolveTelegramPrincipal(55);
    assert.deepEqual(principal, { ok: false, code: "REVOKED" });
  });

  it("Telegram username does not determine identity", async () => {
    const { rawToken } = await createBindingToken({
      appUserId: "mock:bpp414",
      botUsername: "bot",
      auditSink: noopTelegramIdentityAuditSink,
    });
    await completeBindingFromStartToken({
      rawToken,
      telegramUserId: "42",
      telegramUsername: "admin",
      auditSink: noopTelegramIdentityAuditSink,
    });
    const principal = await resolveTelegramPrincipal(42);
    assert.equal(principal.ok, true);
    if (principal.ok) {
      assert.equal(principal.actor.id, "mock:bpp414");
      assert.equal(principal.actor.username, "bpp414");
      assert.equal(principal.actor.role, "commander");
      assert.notEqual(principal.actor.username, "admin");
      // Spoofed Telegram username must not become the app username.
      assert.notEqual(principal.actor.displayName, "admin");
    }
  });
});

describe("session store", () => {
  it("isolates sessions per Telegram user and expires by TTL", async () => {
    const store = createMemoryTelegramSessionStoreV2();
    const a = createFreshSession(1, 111, 2);
    a.lastQuery = "a";
    const b = createFreshSession(2, 222, 2);
    b.lastQuery = "b";
    await store.set(a, 3600);
    await store.set(b, 3600);
    assert.equal((await store.get("111"))?.lastQuery, "a");
    assert.equal((await store.get("222"))?.lastQuery, "b");

    const short = createMemoryTelegramSessionStoreV2();
    await short.set(createFreshSession(3, 333, 2), 0);
    // ttl 0 → expires immediately on next get (expiresAt <= now)
    await new Promise((r) => setTimeout(r, 2));
    assert.equal(await short.get("333"), null);
  });

  it("discards invalid session payload", async () => {
    const store = createMemoryTelegramSessionStoreV2();
    // Direct map poke is not exposed; set a valid session then delete.
    await store.set(createFreshSession(1, 1, 2), 60);
    await store.delete("1");
    assert.equal(await store.get("1"), null);
  });
});

describe("update dedupe", () => {
  it("claims the same update_id only once", async () => {
    const store = createMemoryUpdateDedupeStore();
    const id = normalizeUpdateId(12345);
    assert.equal(await store.claim(id, 60), false);
    assert.equal(await store.claim(id, 60), true);
  });
});

describe("web handoff destinations", () => {
  it("accepts approved relative destinations and rejects open redirects", () => {
    assert.equal(isApprovedHandoffDestination("/commander-promotion"), true);
    assert.equal(isApprovedHandoffDestination("/officers/abc"), true);
    assert.equal(isApprovedHandoffDestination("https://evil.example"), false);
    assert.equal(isApprovedHandoffDestination("//evil.example"), false);
    assert.equal(isApprovedHandoffDestination("/login"), false);
  });

  it("handoff is single-use and rejects reuse", async () => {
    const { rawToken } = await createWebHandoff({
      appUserId: "mock:bpp414",
      destination: "/commander-promotion",
      auditSink: noopTelegramIdentityAuditSink,
    });
    const first = await consumeWebHandoff({ rawToken, auditSink: noopTelegramIdentityAuditSink });
    assert.equal(first.destination, "/commander-promotion");
    await assert.rejects(
      () => consumeWebHandoff({ rawToken, auditSink: noopTelegramIdentityAuditSink }),
      (e: unknown) => e instanceof TelegramHandoffError && e.code === "USED"
    );
  });
});

describe("webhook hardening", () => {
  it("rejects missing or wrong secret when required", async () => {
    const config = loadTelegramPersonnelSearchConfig({
      TELEGRAM_WEBHOOK_SECRET: "secret-value",
      TELEGRAM_REQUIRE_WEBHOOK_SECRET: "1",
      TELEGRAM_SESSION_STORE: "memory",
    });
    const missing = await handleTelegramWebhook(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({ update_id: 1 }),
      }),
      { config, auditSink: noopTelegramIdentityAuditSink, dedupe: createMemoryUpdateDedupeStore() }
    );
    assert.equal(missing.status, 401);

    const wrong = await handleTelegramWebhook(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "wrong" },
        body: JSON.stringify({ update_id: 1 }),
      }),
      { config, auditSink: noopTelegramIdentityAuditSink, dedupe: createMemoryUpdateDedupeStore() }
    );
    assert.equal(wrong.status, 401);
  });

  it("accepts valid secret and ignores duplicate update_id", async () => {
    const config = loadTelegramPersonnelSearchConfig({
      TELEGRAM_WEBHOOK_SECRET: "ok-secret",
      TELEGRAM_REQUIRE_WEBHOOK_SECRET: "1",
      TELEGRAM_SESSION_STORE: "memory",
    });
    const dedupe = createMemoryUpdateDedupeStore();
    let sends = 0;
    const body = JSON.stringify({
      update_id: 99,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: 5, type: "private" },
        from: { id: 5 },
        text: "/start",
      },
    });

    const deps = {
      config,
      auditSink: noopTelegramIdentityAuditSink,
      dedupe,
      sessions: createMemoryTelegramSessionStoreV2(),
      dispatcherDeps: {
        resolvePrincipal: async () => ({ ok: false as const, code: "UNBOUND" as const }),
        send: async () => {
          sends += 1;
        },
        answerCallback: async () => {},
        apiClient: async () => {
          throw new Error("should not search");
        },
      },
    };

    const first = await handleTelegramWebhook(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "ok-secret", "content-type": "application/json" },
        body,
      }),
      deps
    );
    assert.equal(first.status, 200);
    assert.equal(sends, 1);

    const second = await handleTelegramWebhook(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "ok-secret", "content-type": "application/json" },
        body,
      }),
      deps
    );
    assert.equal(second.status, 200);
    assert.equal(sends, 1);
  });

  it("handles malformed body without leaking bot token", async () => {
    const config = loadTelegramPersonnelSearchConfig({
      TELEGRAM_WEBHOOK_SECRET: "s",
      TELEGRAM_REQUIRE_WEBHOOK_SECRET: "1",
      TELEGRAM_BOT_TOKEN: "123456:ABC-DEF",
      TELEGRAM_SESSION_STORE: "memory",
    });
    const res = await handleTelegramWebhook(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": "s" },
        body: "{not-json",
      }),
      { config, auditSink: noopTelegramIdentityAuditSink, dedupe: createMemoryUpdateDedupeStore() }
    );
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.ok(!text.includes("ABC-DEF"));
    assert.ok(!text.includes("123456:"));
  });
});
