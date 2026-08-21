-- Phase DI-1 — Drug Intelligence Core Data Model & Case Workspace
--
-- Purely additive: 5 new enums, 22 new Drug* tables, their indexes, and
-- foreign keys. DrugCase references the EXISTING legacy Region/Battalion/
-- Company/Headquarters tables (Phase 20A/26B) via nullable FK — no columns
-- on any pre-existing table are added, altered, renamed, or dropped, and no
-- pre-existing table's data is touched. Reuses the same PostgreSQL database
-- and Prisma client as the rest of the app (no second database).
--
-- No production personal data — this migration creates schema only.

-- CreateEnum
CREATE TYPE "DrugRelationshipStatus" AS ENUM ('CONFIRMED', 'OBSERVED', 'REPORTED', 'SYSTEM_SUGGESTED');

-- CreateEnum
CREATE TYPE "DrugCasePersonRole" AS ENUM ('SUSPECT', 'ACCUSED', 'ARRESTED_PERSON', 'ASSOCIATED_PERSON', 'WITNESS', 'OTHER');

-- CreateEnum
CREATE TYPE "DrugPersonIdentifierType" AS ENUM ('THAI_ID', 'PASSPORT', 'ALIEN_ID', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DrugLocationRole" AS ENUM ('ARREST_LOCATION', 'RESIDENCE', 'STORAGE_LOCATION', 'MEETING_POINT', 'OTHER');

-- CreateEnum
CREATE TYPE "DrugCaseStatus" AS ENUM ('OPEN', 'UNDER_INVESTIGATION', 'CLOSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "DrugCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DrugCaseStatus" NOT NULL DEFAULT 'OPEN',
    "arrestDate" DATE,
    "arrestTime" TEXT,
    "headquartersId" INTEGER,
    "regionId" INTEGER,
    "battalionId" INTEGER,
    "companyId" INTEGER,
    "reportingUnitText" TEXT,
    "province" TEXT,
    "district" TEXT,
    "subdistrict" TEXT,
    "locationName" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "narrative" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugPerson" (
    "id" TEXT NOT NULL,
    "primaryFullName" TEXT NOT NULL,
    "nationality" TEXT,
    "dateOfBirth" DATE,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugPersonIdentifier" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" "DrugPersonIdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugPersonIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugPersonAlias" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugPersonAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugCasePerson" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "DrugCasePersonRole" NOT NULL,
    "linkedOfficerId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugCasePerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugPhoneNumber" (
    "id" TEXT NOT NULL,
    "normalizedNumber" TEXT NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugPhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugCasePhone" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "originalInput" TEXT,
    "status" "DrugRelationshipStatus" NOT NULL DEFAULT 'REPORTED',
    "firstSeenAt" DATE,
    "lastSeenAt" DATE,
    "confidence" INTEGER,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugCasePhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugSim" (
    "id" TEXT NOT NULL,
    "iccid" TEXT,
    "imsi" TEXT,
    "carrier" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugSim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugSimPhoneHistory" (
    "id" TEXT NOT NULL,
    "simId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "validFrom" DATE,
    "validTo" DATE,
    "sourceCaseId" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugSimPhoneHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugCaseSim" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "personId" TEXT,
    "simId" TEXT NOT NULL,
    "status" "DrugRelationshipStatus" NOT NULL DEFAULT 'REPORTED',
    "firstSeenAt" DATE,
    "lastSeenAt" DATE,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugCaseSim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugDevice" (
    "id" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "imei1" TEXT,
    "imei2" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugPersonDevice" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "DrugRelationshipStatus" NOT NULL DEFAULT 'REPORTED',
    "firstSeenAt" DATE,
    "lastSeenAt" DATE,
    "sourceCaseId" TEXT,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugPersonDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugSimDeviceHistory" (
    "id" TEXT NOT NULL,
    "simId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "validFrom" DATE,
    "validTo" DATE,
    "sourceCaseId" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugSimDeviceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugCaseDevice" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "personId" TEXT,
    "deviceId" TEXT NOT NULL,
    "status" "DrugRelationshipStatus" NOT NULL DEFAULT 'REPORTED',
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugCaseDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugVehicle" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "registrationProvince" TEXT,
    "vehicleType" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "color" TEXT,
    "vin" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugPersonVehicle" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "DrugRelationshipStatus" NOT NULL DEFAULT 'REPORTED',
    "firstSeenAt" DATE,
    "lastSeenAt" DATE,
    "sourceCaseId" TEXT,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugPersonVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugCaseVehicle" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "personId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "status" "DrugRelationshipStatus" NOT NULL DEFAULT 'REPORTED',
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugCaseVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "addressText" TEXT,
    "province" TEXT,
    "district" TEXT,
    "subdistrict" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugCaseLocation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "role" "DrugLocationRole" NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugCaseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugSeizedItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "drugType" TEXT NOT NULL,
    "subtype" TEXT,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "weightGrams" DECIMAL(12,3),
    "packageCount" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugSeizedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugRelationship" (
    "id" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "status" "DrugRelationshipStatus" NOT NULL DEFAULT 'SYSTEM_SUGGESTED',
    "firstSeenAt" DATE,
    "lastSeenAt" DATE,
    "confidence" INTEGER,
    "recordedBy" TEXT NOT NULL,
    "notes" TEXT,
    "sourceCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrugCase_caseNumber_idx" ON "DrugCase"("caseNumber");

-- CreateIndex
CREATE INDEX "DrugCase_status_idx" ON "DrugCase"("status");

-- CreateIndex
CREATE INDEX "DrugCase_arrestDate_idx" ON "DrugCase"("arrestDate");

-- CreateIndex
CREATE INDEX "DrugCase_province_idx" ON "DrugCase"("province");

-- CreateIndex
CREATE INDEX "DrugCase_headquartersId_idx" ON "DrugCase"("headquartersId");

-- CreateIndex
CREATE INDEX "DrugCase_regionId_idx" ON "DrugCase"("regionId");

-- CreateIndex
CREATE INDEX "DrugCase_battalionId_idx" ON "DrugCase"("battalionId");

-- CreateIndex
CREATE INDEX "DrugCase_companyId_idx" ON "DrugCase"("companyId");

-- CreateIndex
CREATE INDEX "DrugCase_createdBy_idx" ON "DrugCase"("createdBy");

-- CreateIndex
CREATE INDEX "DrugPerson_primaryFullName_idx" ON "DrugPerson"("primaryFullName");

-- CreateIndex
CREATE INDEX "DrugPerson_dateOfBirth_idx" ON "DrugPerson"("dateOfBirth");

-- CreateIndex
CREATE INDEX "DrugPersonIdentifier_personId_idx" ON "DrugPersonIdentifier"("personId");

-- CreateIndex
CREATE INDEX "DrugPersonIdentifier_type_value_idx" ON "DrugPersonIdentifier"("type", "value");

-- CreateIndex
CREATE INDEX "DrugPersonAlias_personId_idx" ON "DrugPersonAlias"("personId");

-- CreateIndex
CREATE INDEX "DrugPersonAlias_fullName_idx" ON "DrugPersonAlias"("fullName");

-- CreateIndex
CREATE INDEX "DrugCasePerson_caseId_idx" ON "DrugCasePerson"("caseId");

-- CreateIndex
CREATE INDEX "DrugCasePerson_personId_idx" ON "DrugCasePerson"("personId");

-- CreateIndex
CREATE INDEX "DrugCasePerson_linkedOfficerId_idx" ON "DrugCasePerson"("linkedOfficerId");

-- CreateIndex
CREATE UNIQUE INDEX "DrugCasePerson_caseId_personId_key" ON "DrugCasePerson"("caseId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "DrugPhoneNumber_normalizedNumber_key" ON "DrugPhoneNumber"("normalizedNumber");

-- CreateIndex
CREATE INDEX "DrugPhoneNumber_normalizedNumber_idx" ON "DrugPhoneNumber"("normalizedNumber");

-- CreateIndex
CREATE INDEX "DrugCasePhone_caseId_idx" ON "DrugCasePhone"("caseId");

-- CreateIndex
CREATE INDEX "DrugCasePhone_personId_idx" ON "DrugCasePhone"("personId");

-- CreateIndex
CREATE INDEX "DrugCasePhone_phoneNumberId_idx" ON "DrugCasePhone"("phoneNumberId");

-- CreateIndex
CREATE INDEX "DrugCasePhone_status_idx" ON "DrugCasePhone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DrugSim_iccid_key" ON "DrugSim"("iccid");

-- CreateIndex
CREATE INDEX "DrugSim_iccid_idx" ON "DrugSim"("iccid");

-- CreateIndex
CREATE INDEX "DrugSim_imsi_idx" ON "DrugSim"("imsi");

-- CreateIndex
CREATE INDEX "DrugSimPhoneHistory_simId_idx" ON "DrugSimPhoneHistory"("simId");

-- CreateIndex
CREATE INDEX "DrugSimPhoneHistory_phoneNumberId_idx" ON "DrugSimPhoneHistory"("phoneNumberId");

-- CreateIndex
CREATE INDEX "DrugCaseSim_caseId_idx" ON "DrugCaseSim"("caseId");

-- CreateIndex
CREATE INDEX "DrugCaseSim_personId_idx" ON "DrugCaseSim"("personId");

-- CreateIndex
CREATE INDEX "DrugCaseSim_simId_idx" ON "DrugCaseSim"("simId");

-- CreateIndex
CREATE INDEX "DrugDevice_imei1_idx" ON "DrugDevice"("imei1");

-- CreateIndex
CREATE INDEX "DrugDevice_imei2_idx" ON "DrugDevice"("imei2");

-- CreateIndex
CREATE INDEX "DrugDevice_serialNumber_idx" ON "DrugDevice"("serialNumber");

-- CreateIndex
CREATE INDEX "DrugPersonDevice_personId_idx" ON "DrugPersonDevice"("personId");

-- CreateIndex
CREATE INDEX "DrugPersonDevice_deviceId_idx" ON "DrugPersonDevice"("deviceId");

-- CreateIndex
CREATE INDEX "DrugSimDeviceHistory_simId_idx" ON "DrugSimDeviceHistory"("simId");

-- CreateIndex
CREATE INDEX "DrugSimDeviceHistory_deviceId_idx" ON "DrugSimDeviceHistory"("deviceId");

-- CreateIndex
CREATE INDEX "DrugCaseDevice_caseId_idx" ON "DrugCaseDevice"("caseId");

-- CreateIndex
CREATE INDEX "DrugCaseDevice_personId_idx" ON "DrugCaseDevice"("personId");

-- CreateIndex
CREATE INDEX "DrugCaseDevice_deviceId_idx" ON "DrugCaseDevice"("deviceId");

-- CreateIndex
CREATE INDEX "DrugVehicle_registrationNumber_idx" ON "DrugVehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "DrugVehicle_vin_idx" ON "DrugVehicle"("vin");

-- CreateIndex
CREATE INDEX "DrugPersonVehicle_personId_idx" ON "DrugPersonVehicle"("personId");

-- CreateIndex
CREATE INDEX "DrugPersonVehicle_vehicleId_idx" ON "DrugPersonVehicle"("vehicleId");

-- CreateIndex
CREATE INDEX "DrugCaseVehicle_caseId_idx" ON "DrugCaseVehicle"("caseId");

-- CreateIndex
CREATE INDEX "DrugCaseVehicle_personId_idx" ON "DrugCaseVehicle"("personId");

-- CreateIndex
CREATE INDEX "DrugCaseVehicle_vehicleId_idx" ON "DrugCaseVehicle"("vehicleId");

-- CreateIndex
CREATE INDEX "DrugLocation_province_idx" ON "DrugLocation"("province");

-- CreateIndex
CREATE INDEX "DrugLocation_district_idx" ON "DrugLocation"("district");

-- CreateIndex
CREATE INDEX "DrugCaseLocation_caseId_idx" ON "DrugCaseLocation"("caseId");

-- CreateIndex
CREATE INDEX "DrugCaseLocation_locationId_idx" ON "DrugCaseLocation"("locationId");

-- CreateIndex
CREATE INDEX "DrugCaseLocation_role_idx" ON "DrugCaseLocation"("role");

-- CreateIndex
CREATE INDEX "DrugSeizedItem_caseId_idx" ON "DrugSeizedItem"("caseId");

-- CreateIndex
CREATE INDEX "DrugSeizedItem_drugType_idx" ON "DrugSeizedItem"("drugType");

-- CreateIndex
CREATE INDEX "DrugRelationship_fromType_fromId_idx" ON "DrugRelationship"("fromType", "fromId");

-- CreateIndex
CREATE INDEX "DrugRelationship_toType_toId_idx" ON "DrugRelationship"("toType", "toId");

-- CreateIndex
CREATE INDEX "DrugRelationship_relationshipType_idx" ON "DrugRelationship"("relationshipType");

-- CreateIndex
CREATE INDEX "DrugRelationship_sourceCaseId_idx" ON "DrugRelationship"("sourceCaseId");

-- CreateIndex
CREATE INDEX "DrugRelationship_status_idx" ON "DrugRelationship"("status");

-- CreateIndex
CREATE INDEX "DrugAuditLog_entityType_entityId_idx" ON "DrugAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DrugAuditLog_actorId_idx" ON "DrugAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "DrugAuditLog_createdAt_idx" ON "DrugAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "DrugCase" ADD CONSTRAINT "DrugCase_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCase" ADD CONSTRAINT "DrugCase_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCase" ADD CONSTRAINT "DrugCase_battalionId_fkey" FOREIGN KEY ("battalionId") REFERENCES "Battalion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCase" ADD CONSTRAINT "DrugCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonIdentifier" ADD CONSTRAINT "DrugPersonIdentifier_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonAlias" ADD CONSTRAINT "DrugPersonAlias_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCasePerson" ADD CONSTRAINT "DrugCasePerson_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCasePerson" ADD CONSTRAINT "DrugCasePerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCasePhone" ADD CONSTRAINT "DrugCasePhone_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCasePhone" ADD CONSTRAINT "DrugCasePhone_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCasePhone" ADD CONSTRAINT "DrugCasePhone_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "DrugPhoneNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugSimPhoneHistory" ADD CONSTRAINT "DrugSimPhoneHistory_simId_fkey" FOREIGN KEY ("simId") REFERENCES "DrugSim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugSimPhoneHistory" ADD CONSTRAINT "DrugSimPhoneHistory_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "DrugPhoneNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseSim" ADD CONSTRAINT "DrugCaseSim_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseSim" ADD CONSTRAINT "DrugCaseSim_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseSim" ADD CONSTRAINT "DrugCaseSim_simId_fkey" FOREIGN KEY ("simId") REFERENCES "DrugSim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonDevice" ADD CONSTRAINT "DrugPersonDevice_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonDevice" ADD CONSTRAINT "DrugPersonDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DrugDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugSimDeviceHistory" ADD CONSTRAINT "DrugSimDeviceHistory_simId_fkey" FOREIGN KEY ("simId") REFERENCES "DrugSim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugSimDeviceHistory" ADD CONSTRAINT "DrugSimDeviceHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DrugDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseDevice" ADD CONSTRAINT "DrugCaseDevice_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseDevice" ADD CONSTRAINT "DrugCaseDevice_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseDevice" ADD CONSTRAINT "DrugCaseDevice_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DrugDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonVehicle" ADD CONSTRAINT "DrugPersonVehicle_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonVehicle" ADD CONSTRAINT "DrugPersonVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "DrugVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseVehicle" ADD CONSTRAINT "DrugCaseVehicle_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseVehicle" ADD CONSTRAINT "DrugCaseVehicle_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseVehicle" ADD CONSTRAINT "DrugCaseVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "DrugVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseLocation" ADD CONSTRAINT "DrugCaseLocation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseLocation" ADD CONSTRAINT "DrugCaseLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "DrugLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugSeizedItem" ADD CONSTRAINT "DrugSeizedItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugRelationship" ADD CONSTRAINT "DrugRelationship_sourceCaseId_fkey" FOREIGN KEY ("sourceCaseId") REFERENCES "DrugCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugRelationship" ADD CONSTRAINT "DrugRelationship_fromPerson_fkey" FOREIGN KEY ("fromId") REFERENCES "DrugPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

