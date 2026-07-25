-- Phase 51.3 — Telegram identity binding & durable bot state

CREATE TYPE "TelegramBindingStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'REVOKED', 'DISABLED');

CREATE TABLE "telegram_identity_binding" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "status" "TelegramBindingStatus" NOT NULL,
    "telegramUsername" TEXT,
    "telegramFirstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "telegram_identity_binding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_identity_binding_telegramUserId_key" ON "telegram_identity_binding"("telegramUserId");
CREATE INDEX "telegram_identity_binding_appUserId_status_idx" ON "telegram_identity_binding"("appUserId", "status");
CREATE INDEX "telegram_identity_binding_status_idx" ON "telegram_identity_binding"("status");

CREATE TABLE "telegram_binding_token" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_binding_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_binding_token_tokenHash_key" ON "telegram_binding_token"("tokenHash");
CREATE INDEX "telegram_binding_token_appUserId_idx" ON "telegram_binding_token"("appUserId");
CREATE INDEX "telegram_binding_token_expiresAt_idx" ON "telegram_binding_token"("expiresAt");

CREATE TABLE "telegram_bot_session" (
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_bot_session_pkey" PRIMARY KEY ("telegramUserId")
);

CREATE INDEX "telegram_bot_session_expiresAt_idx" ON "telegram_bot_session"("expiresAt");

CREATE TABLE "telegram_processed_update" (
    "updateId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_processed_update_pkey" PRIMARY KEY ("updateId")
);

CREATE INDEX "telegram_processed_update_expiresAt_idx" ON "telegram_processed_update"("expiresAt");

CREATE TABLE "telegram_web_handoff" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_web_handoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_web_handoff_tokenHash_key" ON "telegram_web_handoff"("tokenHash");
CREATE INDEX "telegram_web_handoff_expiresAt_idx" ON "telegram_web_handoff"("expiresAt");
