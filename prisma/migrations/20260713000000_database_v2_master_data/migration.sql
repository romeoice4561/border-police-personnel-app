-- Phase 24A: Database V2 Foundation — Master Data (additive, non-destructive).
--
-- Creates the normalized V2 master tables defined by DATABASE_V2_DESIGN.md,
-- MASTER_DATA.md, and ER_DIAGRAM.md. These live ALONGSIDE the existing
-- Phase 20A Region/Battalion/Company (Int PK) tables — nothing existing is
-- renamed, altered, dropped, or repointed. No DROP TABLE, no data migration,
-- no FK repointing: that is a later, dedicated phase. Existing application
-- behavior is unchanged.
--
-- V2 conventions (per the authoritative docs):
--   • UUID primary keys, DB-generated via gen_random_uuid() (Principle 3 /
--     UUID Policy: "UUID สร้างโดย Database").
--   • snake_case tables + columns.
--   • Standard columns on every table: status, version, is_deleted,
--     deleted_at, created_by, updated_by, created_at, updated_at (§6).
--   • Every relationship by UUID FK; ON DELETE RESTRICT (soft-delete only,
--     no cascade — ER_DIAGRAM Cascade Rules).
--   • TIMESTAMPTZ for all datetimes (UTC storage — §12).
--
-- gen_random_uuid() is provided by the built-in pgcrypto since PostgreSQL 13
-- (Supabase ships it enabled); the extension guard below is a safety net.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── master_regions (§17) ────────────────────────────────────────────────────
CREATE TABLE "master_regions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_regions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_regions_code_key" ON "master_regions"("code");
CREATE INDEX "master_regions_is_active_idx" ON "master_regions"("is_active");
CREATE INDEX "master_regions_is_deleted_idx" ON "master_regions"("is_deleted");

-- ── master_commands (§18) ───────────────────────────────────────────────────
CREATE TABLE "master_commands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_commands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_commands_code_key" ON "master_commands"("code");
CREATE INDEX "master_commands_region_id_idx" ON "master_commands"("region_id");
CREATE INDEX "master_commands_is_active_idx" ON "master_commands"("is_active");
CREATE INDEX "master_commands_is_deleted_idx" ON "master_commands"("is_deleted");

-- ── master_subdivisions (§19) ───────────────────────────────────────────────
CREATE TABLE "master_subdivisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "command_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "province" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_subdivisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_subdivisions_code_key" ON "master_subdivisions"("code");
CREATE INDEX "master_subdivisions_command_id_idx" ON "master_subdivisions"("command_id");
CREATE INDEX "master_subdivisions_is_active_idx" ON "master_subdivisions"("is_active");
CREATE INDEX "master_subdivisions_is_deleted_idx" ON "master_subdivisions"("is_deleted");

-- ── master_companies (§20) ──────────────────────────────────────────────────
CREATE TABLE "master_companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subdivision_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "company_no" TEXT,
    "short_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "location" TEXT,
    "province" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_companies_code_key" ON "master_companies"("code");
CREATE INDEX "master_companies_subdivision_id_idx" ON "master_companies"("subdivision_id");
CREATE INDEX "master_companies_is_active_idx" ON "master_companies"("is_active");
CREATE INDEX "master_companies_is_deleted_idx" ON "master_companies"("is_deleted");

-- ── master_ranks (§22) ──────────────────────────────────────────────────────
CREATE TABLE "master_ranks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "abbreviation" TEXT,
    "level" INTEGER NOT NULL,
    "group_name" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_ranks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_ranks_code_key" ON "master_ranks"("code");
CREATE INDEX "master_ranks_level_idx" ON "master_ranks"("level");
CREATE INDEX "master_ranks_is_active_idx" ON "master_ranks"("is_active");
CREATE INDEX "master_ranks_is_deleted_idx" ON "master_ranks"("is_deleted");

-- ── master_positions (§23) ──────────────────────────────────────────────────
CREATE TABLE "master_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "position_group" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_positions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_positions_code_key" ON "master_positions"("code");
CREATE INDEX "master_positions_is_active_idx" ON "master_positions"("is_active");
CREATE INDEX "master_positions_is_deleted_idx" ON "master_positions"("is_deleted");

-- ── master_timeline_types (§38) ─────────────────────────────────────────────
CREATE TABLE "master_timeline_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_timeline_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_timeline_types_code_key" ON "master_timeline_types"("code");
CREATE INDEX "master_timeline_types_is_active_idx" ON "master_timeline_types"("is_active");
CREATE INDEX "master_timeline_types_is_deleted_idx" ON "master_timeline_types"("is_deleted");

-- ── master_asset_types (§51) ────────────────────────────────────────────────
CREATE TABLE "master_asset_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_asset_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_asset_types_code_key" ON "master_asset_types"("code");
CREATE INDEX "master_asset_types_is_active_idx" ON "master_asset_types"("is_active");
CREATE INDEX "master_asset_types_is_deleted_idx" ON "master_asset_types"("is_deleted");

-- ── master_document_types (§52) ─────────────────────────────────────────────
CREATE TABLE "master_document_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "name_en" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "master_document_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_document_types_code_key" ON "master_document_types"("code");
CREATE INDEX "master_document_types_is_active_idx" ON "master_document_types"("is_active");
CREATE INDEX "master_document_types_is_deleted_idx" ON "master_document_types"("is_deleted");

-- ── Foreign keys (organization tree; ON DELETE RESTRICT — no cascade) ────────
ALTER TABLE "master_commands"
    ADD CONSTRAINT "master_commands_region_id_fkey"
    FOREIGN KEY ("region_id") REFERENCES "master_regions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_subdivisions"
    ADD CONSTRAINT "master_subdivisions_command_id_fkey"
    FOREIGN KEY ("command_id") REFERENCES "master_commands"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_companies"
    ADD CONSTRAINT "master_companies_subdivision_id_fkey"
    FOREIGN KEY ("subdivision_id") REFERENCES "master_subdivisions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
