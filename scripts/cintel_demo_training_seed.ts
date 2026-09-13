/**
 * Idempotent C-INTEL training demo seed (CASE 001–006).
 * Refuses remote writes unless CINTEL_DEMO_ALLOW_REMOTE=1.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createDatabaseClient } from "../lib/database/database";
import type { DatabaseClient } from "../lib/database/database_types";
import type { PrismaClient } from "../lib/generated/prisma/client";
import type { DrugCasePersonRole } from "../lib/generated/prisma/enums";
import { DrugCaseService } from "../lib/drug_intelligence/drug_case_service";
import { DrugPersonRepository } from "../lib/database/repositories/drug_person_repository";
import { DrugEntityRepository } from "../lib/database/repositories/drug_entity_repository";
import { DrugPersonNetworkRoleRepository } from "../lib/database/repositories/drug_person_network_role_repository";
import { DrugNetworkGroupRepository } from "../lib/database/repositories/drug_network_group_repository";
import {
  CINTEL_DEMO_ACTOR_ID,
  CINTEL_DEMO_ACTOR_NAME,
  CINTEL_DEMO_BANNER,
  CINTEL_DEMO_CASE001_METH_MASS_GRAMS,
  CINTEL_DEMO_DATASET,
  CINTEL_DEMO_ICE_GRAMS,
  CINTEL_DEMO_LOCATION_NAME,
  CINTEL_DEMO_NETWORK_GROUP_NAME,
  CINTEL_DEMO_TABLET_COUNTS,
  demoNarrative,
  demoNotes,
} from "../lib/drug_intelligence/cintel_demo_training_catalog";
import { assertDemoWriteAllowed, qaFixturesIntact, snapshotQaFixtures } from "../lib/drug_intelligence/cintel_demo_training_ops";
import type { DrugCaseCreateRequest, DrugCasePersonInput } from "../lib/drug_intelligence/drug_case_types";

const ACTOR = { actorId: CINTEL_DEMO_ACTOR_ID, actorName: CINTEL_DEMO_ACTOR_NAME };

function seizedCount(quantity: number, drugType = "ยาบ้า") {
  return {
    drugCategory: "METHAMPHETAMINE_TABLET",
    otherDrugCategoryLabel: null,
    measurementKind: "COUNT",
    drugType,
    subtype: null,
    quantity,
    unit: "เม็ด",
    weightGrams: null,
    packageCount: null,
    notes: demoNotes(),
  };
}

function seizedMass(weightGrams: number, drugType = "ไอซ์") {
  return {
    drugCategory: "CRYSTAL_METHAMPHETAMINE",
    otherDrugCategoryLabel: null,
    measurementKind: "MASS",
    drugType,
    subtype: null,
    quantity: null,
    unit: null,
    weightGrams,
    packageCount: null,
    notes: demoNotes(),
  };
}

async function findPersonId(db: PrismaClient, identifier: string): Promise<string | null> {
  const rows = await db.drugPersonIdentifier.findMany({ where: { type: "OTHER", value: identifier } });
  return rows[0]?.personId ?? null;
}

async function findDemoCaseId(db: PrismaClient, caseNumber: string): Promise<string | null> {
  const row = await db.drugCase.findFirst({
    where: { caseNumber, narrative: { contains: CINTEL_DEMO_DATASET } },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function ensurePersonOnCase(
  db: PrismaClient,
  caseId: string,
  personId: string,
  role: DrugCasePersonRole,
): Promise<void> {
  const existing = await db.drugCasePerson.findUnique({ where: { caseId_personId: { caseId, personId } } });
  if (existing) return;
  await db.drugCasePerson.create({
    data: { caseId, personId, role, linkedOfficerId: null, notes: demoNotes(), createdBy: ACTOR.actorId },
  });
}

async function main() {
  const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
  if (!connectionString) throw new Error("No DATABASE_URL / DIRECT_URL");
  assertDemoWriteAllowed(connectionString);

  const db = createDatabaseClient();
  const services = db as unknown as DatabaseClient;
  const caseService = new DrugCaseService({ db: services });
  const personRepo = new DrugPersonRepository(services);
  const entityRepo = new DrugEntityRepository(services);
  const roleRepo = new DrugPersonNetworkRoleRepository(services);
  const groupRepo = new DrugNetworkGroupRepository(services);

  const qaBefore = await snapshotQaFixtures(db);
  console.log("QA snapshot before seed:", JSON.stringify(qaBefore, null, 2));

  const ids: Record<string, string> = {};

  async function personInput(opts: {
    identifier: string;
    primaryFullName: string;
    nickname?: string | null;
    aliases?: string[];
    nationality?: string | null;
    dateOfBirth?: Date | null;
    role: string;
    networkRoles?: NonNullable<NonNullable<DrugCasePersonInput["newPerson"]>["networkRoles"]>;
    phones?: DrugCasePersonInput["phones"];
    sims?: DrugCasePersonInput["sims"];
    devices?: DrugCasePersonInput["devices"];
    vehicles?: DrugCasePersonInput["vehicles"];
    caseNotes?: string | null;
  }): Promise<DrugCasePersonInput> {
    const existingPersonId = await findPersonId(db, opts.identifier);
    const shared = {
      role: opts.role,
      linkedOfficerId: null,
      notes: opts.caseNotes ?? demoNotes(),
      phones: opts.phones ?? [],
      sims: opts.sims ?? [],
      devices: opts.devices ?? [],
      vehicles: opts.vehicles ?? [],
    };
    if (existingPersonId) return { existingPersonId, ...shared };
    return {
      newPerson: {
        primaryFullName: opts.primaryFullName,
        nickname: opts.nickname ?? null,
        nationality: opts.nationality ?? "Thai",
        sex: null,
        dateOfBirth: opts.dateOfBirth ?? null,
        approximateAge: null,
        notes: demoNotes(),
        aliases: (opts.aliases ?? []).map((fullName) => ({ fullName })),
        identifiers: [{ type: "OTHER", value: opts.identifier, notes: demoNotes() }],
        networkRoles: opts.networkRoles ?? [],
      },
      ...shared,
    };
  }

  async function createIfMissing(input: DrugCaseCreateRequest): Promise<string> {
    const existing = await findDemoCaseId(db, input.caseNumber);
    if (existing) {
      console.log(`reuse case ${input.caseNumber} ${existing}`);
      return existing;
    }
    const created = await caseService.createCase(input);
    console.log(`created case ${input.caseNumber} ${created.caseId}`);
    return created.caseId;
  }

  // ── CASE 001 ──────────────────────────────────────────────────────────
  ids.CASE001 = await createIfMissing({
    caseNumber: "DI-TEST-001",
    title: "จับกุมเครือข่ายทดสอบ — บอล",
    status: "OPEN",
    arrestDate: new Date("2026-08-01"),
    arrestTime: "21:30",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "ร้อย ตชด.414",
    province: "ชุมพร",
    district: "ท่าแซะ",
    subdistrict: null,
    locationName: "อ.ท่าแซะ จ.ชุมพร",
    latitude: 10.6801,
    longitude: 99.1801,
    narrative: demoNarrative("P001 ให้ข้อมูลว่าได้รับยาเสพติดจากบุคคลชื่อเฮียก้อง ติดต่อผ่านหมายเลข 0900001001 (TEL001). ข้อมูลจากการให้การ — ยังไม่ยืนยันอิสระ."),
    persons: [
      await personInput({
        identifier: "TEST-PERSON-001",
        primaryFullName: "นายธนกร ทดสอบระบบ",
        nickname: "บอล",
        aliases: ["บอลใต้"],
        dateOfBirth: new Date("1992-03-15"),
        role: "SUSPECT",
        networkRoles: [{ role: "COURIER", source: "DIRECT_ARREST", verificationStatus: "CONFIRMED", note: demoNotes("transporter") }],
        phones: [{ rawInput: "0900001002", firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: demoNotes("TEL002") }],
        sims: [{ iccid: "89000000000000000002", imsi: null, carrier: null, firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: demoNotes("SIM002") }],
        devices: [{ brand: "Samsung", model: "Galaxy A54", serialNumber: null, imei1: "000000000000002", imei2: null, firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: demoNotes("DEV002") }],
        vehicles: [{ registrationNumber: "TEST-4141", registrationProvince: "ชุมพร", vehicleType: "pickup", brand: "Toyota", model: "Hilux Revo", color: "black", vin: null, firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: demoNotes("VEH001") }],
      }),
      await personInput({
        identifier: "TEST-PERSON-002",
        primaryFullName: "เฮียก้อง",
        aliases: ["เฮียก้อง"],
        nationality: null,
        dateOfBirth: null,
        role: "ASSOCIATED_PERSON",
        networkRoles: [{ role: "SUPPLIER", source: "TESTIMONY", verificationStatus: "UNVERIFIED", note: demoNotes("reported supplier/commander — not independently verified") }],
        phones: [{ rawInput: "0900001001", firstSeenAt: new Date("2026-08-01"), lastSeenAt: new Date("2026-08-01"), notes: demoNotes("TEL001") }],
        caseNotes: demoNotes("P001 ซัดทอดว่าซื้อยาเสพติดจากเฮียก้อง ผ่าน TEL001"),
      }),
    ],
    seizedItems: [
      seizedCount(CINTEL_DEMO_TABLET_COUNTS["DI-TEST-001"]),
      {
        drugCategory: "OTHER",
        otherDrugCategoryLabel: "เมทแอมเฟตามีน",
        measurementKind: "MASS",
        drugType: "เมทแอมเฟตามีน",
        subtype: null,
        quantity: null,
        unit: null,
        weightGrams: CINTEL_DEMO_CASE001_METH_MASS_GRAMS,
        packageCount: null,
        notes: demoNotes("CASE001 mass item — not Ice COUNT/MASS ice total"),
      },
    ],
    locations: [],
    ...ACTOR,
  });

  ids.P001 = (await findPersonId(db, "TEST-PERSON-001"))!;
  ids.P002 = (await findPersonId(db, "TEST-PERSON-002"))!;
  await ensurePersonOnCase(db, ids.CASE001, ids.P001, "SUSPECT");
  await ensurePersonOnCase(db, ids.CASE001, ids.P002, "ASSOCIATED_PERSON");

  // ── CASE 002 ──────────────────────────────────────────────────────────
  ids.CASE002 = await createIfMissing({
    caseNumber: "DI-TEST-002",
    title: "จับกุมเครือข่ายทดสอบ — เอก",
    status: "OPEN",
    arrestDate: new Date("2026-08-05"),
    arrestTime: "18:20",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "หน่วยทดสอบระนอง",
    province: "ระนอง",
    district: "กระบุรี",
    subdistrict: null,
    locationName: "อ.กระบุรี จ.ระนอง",
    latitude: 10.404,
    longitude: 98.772,
    narrative: demoNarrative("P004 ซัดทอดผู้จัดหาชื่อเฮียก้อง หมายเลข 0900001001 — ใช้โทรศัพท์ TEL001 ชุดเดียวกับคดี DI-TEST-001"),
    persons: [
      await personInput({
        identifier: "TEST-PERSON-004",
        primaryFullName: "นายวิชัย ทดสอบระบบ",
        nickname: "เอก",
        aliases: ["เอกเหนือ"],
        dateOfBirth: new Date("1990-06-20"),
        role: "SUSPECT",
        networkRoles: [{ role: "RETAIL_DEALER", source: "DIRECT_ARREST", verificationStatus: "CONFIRMED", note: demoNotes() }],
        phones: [{ rawInput: "0900001004", firstSeenAt: new Date("2026-08-05"), lastSeenAt: new Date("2026-08-05"), notes: demoNotes("TEL004") }],
        devices: [{ brand: null, model: null, serialNumber: null, imei1: "000000000000004", imei2: null, firstSeenAt: new Date("2026-08-05"), lastSeenAt: new Date("2026-08-05"), notes: demoNotes("DEV004") }],
      }),
      await personInput({
        identifier: "TEST-PERSON-002",
        primaryFullName: "เฮียก้อง",
        role: "ASSOCIATED_PERSON",
        phones: [{ rawInput: "0900001001", firstSeenAt: new Date("2026-08-05"), lastSeenAt: new Date("2026-08-05"), notes: demoNotes("TEL001 reuse") }],
        caseNotes: demoNotes("P004 ซัดทอดผู้จัดหาเฮียก้อง / TEL001 — ไม่สร้างเบอร์ใหม่"),
      }),
    ],
    seizedItems: [seizedCount(CINTEL_DEMO_TABLET_COUNTS["DI-TEST-002"]), seizedMass(CINTEL_DEMO_ICE_GRAMS["DI-TEST-002"])],
    locations: [],
    ...ACTOR,
  });
  ids.P004 = (await findPersonId(db, "TEST-PERSON-004"))!;
  await ensurePersonOnCase(db, ids.CASE002, ids.P004, "SUSPECT");
  await ensurePersonOnCase(db, ids.CASE002, ids.P002, "ASSOCIATED_PERSON");

  // ── CASE 003 — identify P002 ──────────────────────────────────────────
  ids.CASE003 = await createIfMissing({
    caseNumber: "DI-TEST-003",
    title: "จับกุมเครือข่ายทดสอบ — เฮียก้อง",
    status: "OPEN",
    arrestDate: new Date("2026-08-10"),
    arrestTime: "14:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "ร้อย ตชด.414",
    province: "สุราษฎร์ธานี",
    district: "เมือง",
    subdistrict: null,
    locationName: "อ.เมือง จ.สุราษฎร์ธานี",
    latitude: 9.138,
    longitude: 99.321,
    narrative: demoNarrative("ยืนยันตัวตน P002 นายกิตติศักดิ์ ทดสอบระบบ (เฮียก้อง) จากข่าวกรองคดี 001/002"),
    persons: [
      await personInput({
        identifier: "TEST-PERSON-002",
        primaryFullName: "นายกิตติศักดิ์ ทดสอบระบบ",
        nickname: "ก้อง",
        aliases: ["เฮียก้อง", "ก้อง", "ก้องใต้"],
        dateOfBirth: new Date("1985-09-09"),
        role: "ARRESTED_PERSON",
        networkRoles: [{ role: "COORDINATOR", source: "DIRECT_ARREST", verificationStatus: "CONFIRMED", note: demoNotes("ผู้สั่งการ") }],
        phones: [
          { rawInput: "0900001001", firstSeenAt: new Date("2026-08-10"), lastSeenAt: new Date("2026-08-10"), notes: demoNotes("TEL001") },
          { rawInput: "0900001005", firstSeenAt: new Date("2026-08-10"), lastSeenAt: new Date("2026-08-10"), notes: demoNotes("TEL005") },
        ],
        sims: [{ iccid: "89000000000000000001", imsi: null, carrier: null, firstSeenAt: new Date("2026-08-10"), lastSeenAt: new Date("2026-08-10"), notes: demoNotes("SIM001") }],
        devices: [{ brand: "Apple", model: "iPhone 14", serialNumber: null, imei1: "000000000000001", imei2: null, firstSeenAt: new Date("2026-08-10"), lastSeenAt: new Date("2026-08-10"), notes: demoNotes("DEV001") }],
        vehicles: [{ registrationNumber: "TEST-9009", registrationProvince: "สุราษฎร์ธานี", vehicleType: "car", brand: "Honda", model: "Civic", color: "white", vin: null, firstSeenAt: new Date("2026-08-10"), lastSeenAt: new Date("2026-08-10"), notes: demoNotes("VEH003") }],
      }),
    ],
    seizedItems: [seizedCount(CINTEL_DEMO_TABLET_COUNTS["DI-TEST-003"]), seizedMass(CINTEL_DEMO_ICE_GRAMS["DI-TEST-003"])],
    locations: [],
    ...ACTOR,
  });
  await ensurePersonOnCase(db, ids.CASE003, ids.P002, "ARRESTED_PERSON");

  const p002 = await personRepo.findById(ids.P002);
  if (p002 && p002.primaryFullName !== "นายกิตติศักดิ์ ทดสอบระบบ") {
    await db.drugPersonAlias.updateMany({ where: { personId: ids.P002, isPrimary: true }, data: { isPrimary: false } });
    const aliases = await personRepo.aliasesForPerson(ids.P002);
    const names = new Set(aliases.map((row) => row.fullName));
    if (!names.has("นายกิตติศักดิ์ ทดสอบระบบ")) {
      await personRepo.addAlias(ids.P002, "นายกิตติศักดิ์ ทดสอบระบบ", true, ACTOR.actorId);
    } else {
      const row = aliases.find((alias) => alias.fullName === "นายกิตติศักดิ์ ทดสอบระบบ");
      if (row) await db.drugPersonAlias.update({ where: { id: row.id }, data: { isPrimary: true } });
    }
    for (const name of ["เฮียก้อง", "ก้อง", "ก้องใต้"]) {
      if (!names.has(name)) await personRepo.addAlias(ids.P002, name, false, ACTOR.actorId);
    }
    await personRepo.updateProfile(
      ids.P002,
      {
        primaryFullName: "นายกิตติศักดิ์ ทดสอบระบบ",
        nickname: "ก้อง",
        nationality: "Thai",
        dateOfBirth: new Date("1985-09-09"),
        notes: demoNotes("enriched from DI-TEST-003 — same person as CASE001/002 intelligence"),
      },
      ACTOR.actorId,
      ACTOR.actorName,
    );
    console.log("enriched P002 legal name");
  }

  const p002Roles = await roleRepo.forPerson(ids.P002);
  if (!p002Roles.some((row) => row.role === "COORDINATOR" && row.sourceCaseId === ids.CASE003)) {
    await roleRepo.create({
      personId: ids.P002,
      sourceCaseId: ids.CASE003,
      role: "COORDINATOR",
      source: "DIRECT_ARREST",
      verificationStatus: "CONFIRMED",
      note: demoNotes("ผู้สั่งการ"),
      createdBy: ACTOR.actorId,
      createdByName: ACTOR.actorName,
    });
  }

  let group = (await groupRepo.findAll()).find((row) => row.name === CINTEL_DEMO_NETWORK_GROUP_NAME);
  if (!group) {
    group = await groupRepo.create({
      name: CINTEL_DEMO_NETWORK_GROUP_NAME,
      aliases: "เครือข่ายก้องใต้",
      description: demoNotes(),
      note: demoNotes(),
      createdBy: ACTOR.actorId,
    });
  }
  const memberships = await personRepo.networkMembershipsForPerson(ids.P002);
  if (!memberships.some((row) => row.networkGroupId === group!.id)) {
    await groupRepo.addMembership({
      personId: ids.P002,
      networkGroupId: group.id,
      source: "DIRECT_ARREST",
      status: "ยืนยัน",
      note: demoNotes(),
      firstObservedAt: new Date("2026-08-10"),
      lastObservedAt: null,
      createdBy: ACTOR.actorId,
    });
  }

  // ── CASE 004 ──────────────────────────────────────────────────────────
  ids.CASE004 = await createIfMissing({
    caseNumber: "DI-TEST-004",
    title: "จับกุมเครือข่ายทดสอบ — บอล (ซ้ำ)",
    status: "OPEN",
    arrestDate: new Date("2026-08-18"),
    arrestTime: "16:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "ร้อย ตชด.414",
    province: "ชุมพร",
    district: "หลังสวน",
    subdistrict: null,
    locationName: "อ.หลังสวน จ.ชุมพร",
    latitude: 9.945,
    longitude: 99.078,
    narrative: demoNarrative("P001 ปรากฏซ้ำ — นายธนกร ทดสอบระบบ / TEST-PERSON-001"),
    persons: [
      await personInput({
        identifier: "TEST-PERSON-001",
        primaryFullName: "นายธนกร ทดสอบระบบ",
        dateOfBirth: new Date("1992-03-15"),
        role: "SUSPECT",
        phones: [{ rawInput: "0900001006", firstSeenAt: new Date("2026-08-18"), lastSeenAt: new Date("2026-08-18"), notes: demoNotes("TEL006") }],
        sims: [{ iccid: "89000000000000000006", imsi: null, carrier: null, firstSeenAt: new Date("2026-08-18"), lastSeenAt: new Date("2026-08-18"), notes: demoNotes("SIM006") }],
        devices: [{ brand: null, model: null, serialNumber: null, imei1: "000000000000006", imei2: null, firstSeenAt: new Date("2026-08-18"), lastSeenAt: new Date("2026-08-18"), notes: demoNotes("DEV006") }],
        vehicles: [{ registrationNumber: "TEST-MC-100", registrationProvince: "ชุมพร", vehicleType: "motorcycle", brand: "Honda", model: "Wave", color: null, vin: null, firstSeenAt: new Date("2026-08-18"), lastSeenAt: new Date("2026-08-18"), notes: demoNotes("VEH006") }],
      }),
    ],
    seizedItems: [seizedCount(CINTEL_DEMO_TABLET_COUNTS["DI-TEST-004"])],
    locations: [],
    ...ACTOR,
  });
  await ensurePersonOnCase(db, ids.CASE004, ids.P001, "SUSPECT");

  // ── CASE 005 ──────────────────────────────────────────────────────────
  ids.CASE005 = await createIfMissing({
    caseNumber: "DI-TEST-005",
    title: "จับกุมเครือข่ายทดสอบ — ฝน / ต้น",
    status: "OPEN",
    arrestDate: new Date("2026-08-22"),
    arrestTime: "20:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "ร้อย ตชด.414",
    province: "ชุมพร",
    district: "เมือง",
    subdistrict: null,
    locationName: "อ.เมือง จ.ชุมพร",
    latitude: 10.493,
    longitude: 99.18,
    narrative: demoNarrative("ใช้ยานพาหนะ VEH003 (TEST-9009) ร่วมกับคดี DI-TEST-003 — ไม่สร้างความสัมพันธ์บุคคลโดยตรงจากรถคันเดียวกัน"),
    persons: [
      await personInput({
        identifier: "TEST-PERSON-003",
        primaryFullName: "น.ส.ปาริชาติ ทดสอบระบบ",
        nickname: "ฝน",
        aliases: ["ฝน"],
        role: "SUSPECT",
        networkRoles: [{ role: "WHOLESALE_DEALER", source: "DIRECT_ARREST", verificationStatus: "CONFIRMED", note: demoNotes("distributor") }],
        phones: [{ rawInput: "0900001003", firstSeenAt: new Date("2026-08-22"), lastSeenAt: new Date("2026-08-22"), notes: demoNotes("TEL003") }],
      }),
      await personInput({
        identifier: "TEST-PERSON-005",
        primaryFullName: "นายศุภชัย ทดสอบระบบ",
        nickname: "ต้น",
        aliases: ["ต้น"],
        role: "SUSPECT",
        networkRoles: [{ role: "VEHICLE_PROVIDER", source: "DIRECT_ARREST", verificationStatus: "CONFIRMED", note: demoNotes("driver") }],
        phones: [{ rawInput: "0900001007", firstSeenAt: new Date("2026-08-22"), lastSeenAt: new Date("2026-08-22"), notes: demoNotes("TEL007") }],
        vehicles: [{ registrationNumber: "TEST-9009", registrationProvince: "สุราษฎร์ธานี", vehicleType: "car", brand: "Honda", model: "Civic", color: "white", vin: null, firstSeenAt: new Date("2026-08-22"), lastSeenAt: new Date("2026-08-22"), notes: demoNotes("VEH003 reuse") }],
      }),
    ],
    seizedItems: [seizedCount(CINTEL_DEMO_TABLET_COUNTS["DI-TEST-005"])],
    locations: [],
    ...ACTOR,
  });
  ids.P003 = (await findPersonId(db, "TEST-PERSON-003"))!;
  ids.P005 = (await findPersonId(db, "TEST-PERSON-005"))!;
  await ensurePersonOnCase(db, ids.CASE005, ids.P003, "SUSPECT");
  await ensurePersonOnCase(db, ids.CASE005, ids.P005, "SUSPECT");

  // ── CASE 006 ──────────────────────────────────────────────────────────
  ids.CASE006 = await createIfMissing({
    caseNumber: "DI-TEST-006",
    title: "จับกุมเครือข่ายทดสอบ — นัท",
    status: "OPEN",
    arrestDate: new Date("2026-08-25"),
    arrestTime: "11:00",
    headquartersId: null,
    regionId: null,
    battalionId: null,
    companyId: null,
    reportingUnitText: "ร้อย ตชด.414",
    province: "ชุมพร",
    district: "ท่าแซะ",
    subdistrict: null,
    locationName: "อ.ท่าแซะ จ.ชุมพร",
    latitude: 10.71,
    longitude: 99.15,
    narrative: demoNarrative("พบ SIM001 (89000000000000000001) กับ DEV008 / P006 — SIM ชุดเดียวกับ P002 ในคดี 003"),
    persons: [
      await personInput({
        identifier: "TEST-PERSON-006",
        primaryFullName: "นายอานนท์ ทดสอบระบบ",
        nickname: "นัท",
        aliases: ["นัท"],
        role: "SUSPECT",
        networkRoles: [{ role: "OTHER", source: "DIRECT_ARREST", verificationStatus: "CONFIRMED", note: demoNotes("receiver") }],
        sims: [{ iccid: "89000000000000000001", imsi: null, carrier: null, firstSeenAt: new Date("2026-08-25"), lastSeenAt: new Date("2026-08-25"), notes: demoNotes("SIM001 reuse") }],
        devices: [{ brand: null, model: null, serialNumber: null, imei1: "000000000000008", imei2: null, firstSeenAt: new Date("2026-08-25"), lastSeenAt: new Date("2026-08-25"), notes: demoNotes("DEV008") }],
      }),
    ],
    seizedItems: [seizedMass(CINTEL_DEMO_ICE_GRAMS["DI-TEST-006"])],
    locations: [],
    ...ACTOR,
  });
  ids.P006 = (await findPersonId(db, "TEST-PERSON-006"))!;
  await ensurePersonOnCase(db, ids.CASE006, ids.P006, "SUSPECT");

  // Shared location — one entity, three case links. No person-person edge.
  let location = await db.drugLocation.findFirst({
    where: { name: CINTEL_DEMO_LOCATION_NAME, notes: { contains: CINTEL_DEMO_DATASET } },
  });
  if (!location) {
    location = await db.drugLocation.create({
      data: {
        name: CINTEL_DEMO_LOCATION_NAME,
        addressText: "จุดพักสินค้า TEST-A",
        province: "ชุมพร",
        district: null,
        subdistrict: null,
        latitude: 10.6,
        longitude: 99.12,
        notes: demoNotes("LOC001 — geographic context only"),
        createdBy: ACTOR.actorId,
      },
    });
  }
  for (const caseId of [ids.CASE001, ids.CASE005, ids.CASE006]) {
    const linked = await db.drugCaseLocation.findFirst({ where: { caseId, locationId: location.id } });
    if (!linked) {
      await entityRepo.linkCaseLocation({
        caseId,
        locationId: location.id,
        role: "STORAGE_LOCATION",
        recordedBy: ACTOR.actorId,
        notes: demoNotes("LOC001 shared geography — not a network edge"),
      });
    }
  }

  async function ensureSuppliedBy(fromId: string, toId: string, sourceCaseId: string, note: string) {
    const existing = await db.drugRelationship.findFirst({
      where: { fromId, toId, relationshipType: "SUPPLIED_BY", sourceCaseId },
    });
    if (existing) return;
    await db.drugRelationship.create({
      data: {
        fromType: "PERSON",
        fromId,
        toType: "PERSON",
        toId,
        relationshipType: "SUPPLIED_BY",
        status: "REPORTED",
        recordedBy: ACTOR.actorId,
        notes: demoNotes(note),
        sourceCaseId,
        firstSeenAt: null,
        lastSeenAt: null,
        confidence: null,
      },
    });
  }
  await ensureSuppliedBy(ids.P001, ids.P002, ids.CASE001, "P001 ซัดทอดว่าซื้อยาเสพติดจากเฮียก้อง ผ่าน TEL001");
  await ensureSuppliedBy(ids.P004, ids.P002, ids.CASE002, "P004 ซัดทอดผู้จัดหาเฮียก้อง / TEL001");

  const sim001 = await db.drugSim.findUnique({ where: { iccid: "89000000000000000001" } });
  const tel001 = await db.drugPhoneNumber.findUnique({ where: { normalizedNumber: "66900001001" } });
  const dev001 = (await db.drugDevice.findMany({ where: { imei1: "000000000000001" } }))[0];
  const dev008 = (await db.drugDevice.findMany({ where: { imei1: "000000000000008" } }))[0];
  if (sim001 && tel001) {
    const hist = await db.drugSimPhoneHistory.findFirst({ where: { simId: sim001.id, phoneNumberId: tel001.id } });
    if (!hist) {
      await db.drugSimPhoneHistory.create({
        data: {
          simId: sim001.id,
          phoneNumberId: tel001.id,
          validFrom: new Date("2026-08-10"),
          validTo: null,
          sourceCaseId: ids.CASE003,
          recordedBy: ACTOR.actorId,
        },
      });
    }
  }
  if (sim001 && dev001) {
    const hist = await db.drugSimDeviceHistory.findFirst({ where: { simId: sim001.id, deviceId: dev001.id } });
    if (!hist) {
      await db.drugSimDeviceHistory.create({
        data: {
          simId: sim001.id,
          deviceId: dev001.id,
          validFrom: new Date("2026-08-10"),
          validTo: new Date("2026-08-25"),
          sourceCaseId: ids.CASE003,
          recordedBy: ACTOR.actorId,
        },
      });
    }
  }
  if (sim001 && dev008) {
    const hist = await db.drugSimDeviceHistory.findFirst({ where: { simId: sim001.id, deviceId: dev008.id } });
    if (!hist) {
      await db.drugSimDeviceHistory.create({
        data: {
          simId: sim001.id,
          deviceId: dev008.id,
          validFrom: new Date("2026-08-25"),
          validTo: null,
          sourceCaseId: ids.CASE006,
          recordedBy: ACTOR.actorId,
        },
      });
    }
  }

  const qaAfter = await snapshotQaFixtures(db);
  const phones = await db.drugPhoneNumber.findMany({ where: { normalizedNumber: "66900001001" } });
  const sims = await db.drugSim.findMany({ where: { iccid: "89000000000000000001" } });
  const vehicles = await db.drugVehicle.findMany({
    where: { registrationNumber: "TEST-9009", registrationProvince: "สุราษฎร์ธานี" },
  });
  const p001Cases = await db.drugCasePerson.count({ where: { personId: ids.P001 } });
  const demoCases = await db.drugCase.count({
    where: { caseNumber: { in: ["DI-TEST-001", "DI-TEST-002", "DI-TEST-003", "DI-TEST-004", "DI-TEST-005", "DI-TEST-006"] }, narrative: { contains: CINTEL_DEMO_DATASET } },
  });

  console.log(JSON.stringify({
    dataset: CINTEL_DEMO_DATASET,
    banner: CINTEL_DEMO_BANNER,
    ids,
    tel001Count: phones.length,
    sim001Count: sims.length,
    veh003Count: vehicles.length,
    p001CaseLinks: p001Cases,
    demoCaseCount: demoCases,
    qaUnchanged: qaFixturesIntact(qaBefore, qaAfter),
  }, null, 2));

  if (!qaFixturesIntact(qaBefore, qaAfter)) {
    throw new Error("QA fixtures changed during demo seed — inspect immediately");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
