-- Phase DI-7.2/7.3 — Person Intelligence Expansion & Network Role Classification
--
-- ADDITIVE ONLY. No DROP TABLE, no DROP COLUMN, no destructive ALTER.
-- No existing rows are touched; all new columns are nullable.
--
-- Tables added:   DrugNetworkGroup, DrugPersonNetworkMembership, DrugPersonNetworkRole
-- Columns added:  DrugPerson.nickname, DrugPerson.sex, DrugPerson.approximateAge
-- Indexes added:  see below
-- Constraints:    FK with ON DELETE CASCADE/SET NULL matching DI-1 conventions

-- AlterTable: additive new intelligence fields on DrugPerson
ALTER TABLE "DrugPerson" ADD COLUMN "nickname"        TEXT;
ALTER TABLE "DrugPerson" ADD COLUMN "sex"             TEXT;
ALTER TABLE "DrugPerson" ADD COLUMN "approximateAge"  INTEGER;

-- CreateTable: canonical shared network/group entity
CREATE TABLE "DrugNetworkGroup" (
    "id"          TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "aliases"     TEXT,
    "description" TEXT,
    "note"        TEXT,
    "createdBy"   TEXT        NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugNetworkGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable: person ↔ network membership with provenance
CREATE TABLE "DrugPersonNetworkMembership" (
    "id"             TEXT        NOT NULL,
    "personId"       TEXT        NOT NULL,
    "networkGroupId" TEXT        NOT NULL,
    "source"         TEXT,
    "status"         TEXT,
    "note"           TEXT,
    "firstObservedAt" DATE,
    "lastObservedAt"  DATE,
    "createdBy"      TEXT        NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugPersonNetworkMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable: network-role assertion per person (append-only, provenance-tracked)
CREATE TABLE "DrugPersonNetworkRole" (
    "id"                 TEXT        NOT NULL,
    "personId"           TEXT        NOT NULL,
    "sourceCaseId"       TEXT,
    "role"               TEXT        NOT NULL,
    "source"             TEXT,
    "verificationStatus" TEXT        NOT NULL DEFAULT 'UNVERIFIED',
    "note"               TEXT,
    "createdBy"          TEXT        NOT NULL,
    "createdByName"      TEXT        NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugPersonNetworkRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrugNetworkGroup_name_idx" ON "DrugNetworkGroup"("name");

CREATE INDEX "DrugPersonNetworkMembership_personId_idx"       ON "DrugPersonNetworkMembership"("personId");
CREATE INDEX "DrugPersonNetworkMembership_networkGroupId_idx" ON "DrugPersonNetworkMembership"("networkGroupId");

CREATE INDEX "DrugPersonNetworkRole_personId_idx"           ON "DrugPersonNetworkRole"("personId");
CREATE INDEX "DrugPersonNetworkRole_sourceCaseId_idx"       ON "DrugPersonNetworkRole"("sourceCaseId");
CREATE INDEX "DrugPersonNetworkRole_verificationStatus_idx" ON "DrugPersonNetworkRole"("verificationStatus");
CREATE INDEX "DrugPersonNetworkRole_role_idx"               ON "DrugPersonNetworkRole"("role");

CREATE INDEX "DrugPerson_nickname_idx" ON "DrugPerson"("nickname");
CREATE INDEX "DrugPerson_sex_idx"      ON "DrugPerson"("sex");

-- AddForeignKey
ALTER TABLE "DrugPersonNetworkMembership" ADD CONSTRAINT "DrugPersonNetworkMembership_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DrugPersonNetworkMembership" ADD CONSTRAINT "DrugPersonNetworkMembership_networkGroupId_fkey"
    FOREIGN KEY ("networkGroupId") REFERENCES "DrugNetworkGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DrugPersonNetworkRole" ADD CONSTRAINT "DrugPersonNetworkRole_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DrugPersonNetworkRole" ADD CONSTRAINT "DrugPersonNetworkRole_sourceCaseId_fkey"
    FOREIGN KEY ("sourceCaseId") REFERENCES "DrugCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
