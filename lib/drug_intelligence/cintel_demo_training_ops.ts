/**
 * Targeted lookup/cleanup helpers for the C-INTEL training demo dataset.
 * Deletes only exact catalog identifiers — never by date, province, or "TEST".
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";
import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";
import {
  CINTEL_DEMO_CASE_NUMBERS,
  CINTEL_DEMO_DATASET,
  CINTEL_DEMO_DEVICE_IMEIS,
  CINTEL_DEMO_LOCATION_NAME,
  CINTEL_DEMO_NETWORK_GROUP_NAME,
  CINTEL_DEMO_PERSON_IDENTIFIERS,
  CINTEL_DEMO_PHONE_RAW,
  CINTEL_DEMO_QA_CASE_NUMBERS,
  CINTEL_DEMO_QA_PERSON_A_ID,
  CINTEL_DEMO_QA_PERSON_F_ID,
  CINTEL_DEMO_SIM_ICCIDS,
  CINTEL_DEMO_VEHICLE_PLATES,
} from "@/lib/drug_intelligence/cintel_demo_training_catalog";

export interface DemoCleanupPlan {
  caseIds: string[];
  personIds: string[];
  phoneIds: string[];
  simIds: string[];
  deviceIds: string[];
  vehicleIds: string[];
  locationIds: string[];
  networkGroupIds: string[];
  relationshipIds: string[];
  analystNoteIds: string[];
  investigationTaskIds: string[];
  alertIds: string[];
}

export interface QaFixtureSnapshot {
  qaCaseCounts: Record<string, number>;
  personA: { id: string; status: string; mergedIntoPersonId: string | null } | null;
  personF: { id: string; status: string; mergedIntoPersonId: string | null } | null;
  mergeCountAF: number;
}

export function demoPhoneMatchingKeys(): string[] {
  return CINTEL_DEMO_PHONE_RAW.map((raw) => normalizePhoneMatchingKey(raw));
}

export function assertDemoWriteAllowed(connectionString: string): void {
  let host = "";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error("C-INTEL demo refused: DATABASE_URL is not a valid URL");
  }
  const local = host === "localhost" || host === "127.0.0.1";
  if (!local && process.env.CINTEL_DEMO_ALLOW_REMOTE !== "1") {
    throw new Error(
      `C-INTEL demo refused write to ${host}. Local/safe DB only unless CINTEL_DEMO_ALLOW_REMOTE=1 after explicit approval.`,
    );
  }
}

export async function snapshotQaFixtures(db: PrismaClient): Promise<QaFixtureSnapshot> {
  const qaCaseCounts: Record<string, number> = {};
  for (const caseNumber of CINTEL_DEMO_QA_CASE_NUMBERS) {
    qaCaseCounts[caseNumber] = await db.drugCase.count({ where: { caseNumber } });
  }
  const [personA, personF, merges] = await Promise.all([
    db.drugPerson.findUnique({
      where: { id: CINTEL_DEMO_QA_PERSON_A_ID },
      select: { id: true, status: true, mergedIntoPersonId: true },
    }),
    db.drugPerson.findUnique({
      where: { id: CINTEL_DEMO_QA_PERSON_F_ID },
      select: { id: true, status: true, mergedIntoPersonId: true },
    }),
    db.drugPersonMerge.findMany({
      where: {
        OR: [
          { survivorPersonId: { in: [CINTEL_DEMO_QA_PERSON_A_ID, CINTEL_DEMO_QA_PERSON_F_ID] } },
          { mergedPersonId: { in: [CINTEL_DEMO_QA_PERSON_A_ID, CINTEL_DEMO_QA_PERSON_F_ID] } },
        ],
      },
      select: { id: true },
    }),
  ]);
  return { qaCaseCounts, personA, personF, mergeCountAF: merges.length };
}

export function qaFixturesIntact(before: QaFixtureSnapshot, after: QaFixtureSnapshot): boolean {
  for (const caseNumber of CINTEL_DEMO_QA_CASE_NUMBERS) {
    if (before.qaCaseCounts[caseNumber] !== after.qaCaseCounts[caseNumber]) return false;
  }
  if (before.personA?.status !== after.personA?.status) return false;
  if (before.personF?.status !== after.personF?.status) return false;
  if (before.personA?.mergedIntoPersonId !== after.personA?.mergedIntoPersonId) return false;
  if (before.personF?.mergedIntoPersonId !== after.personF?.mergedIntoPersonId) return false;
  if (before.mergeCountAF !== after.mergeCountAF) return false;
  return true;
}

export async function collectDemoCleanupPlan(db: PrismaClient): Promise<DemoCleanupPlan> {
  const cases = await db.drugCase.findMany({
    where: {
      caseNumber: { in: [...CINTEL_DEMO_CASE_NUMBERS] },
      narrative: { contains: CINTEL_DEMO_DATASET },
    },
    select: { id: true },
  });
  const identifiers = await db.drugPersonIdentifier.findMany({
    where: { type: "OTHER", value: { in: [...CINTEL_DEMO_PERSON_IDENTIFIERS] } },
    select: { personId: true },
  });
  const phones = await db.drugPhoneNumber.findMany({
    where: { normalizedNumber: { in: demoPhoneMatchingKeys() } },
    select: { id: true },
  });
  const sims = await db.drugSim.findMany({
    where: { iccid: { in: [...CINTEL_DEMO_SIM_ICCIDS] } },
    select: { id: true },
  });
  const devices = await db.drugDevice.findMany({
    where: { imei1: { in: [...CINTEL_DEMO_DEVICE_IMEIS] } },
    select: { id: true },
  });
  const vehicles: { id: string }[] = [];
  for (const plate of CINTEL_DEMO_VEHICLE_PLATES) {
    const rows = await db.drugVehicle.findMany({
      where: {
        registrationNumber: plate.registrationNumber,
        registrationProvince: plate.registrationProvince,
      },
      select: { id: true },
    });
    vehicles.push(...rows);
  }
  const locations = await db.drugLocation.findMany({
    where: {
      name: CINTEL_DEMO_LOCATION_NAME,
      notes: { contains: CINTEL_DEMO_DATASET },
    },
    select: { id: true },
  });
  const groups = await db.drugNetworkGroup.findMany({
    where: {
      name: CINTEL_DEMO_NETWORK_GROUP_NAME,
      OR: [{ note: { contains: CINTEL_DEMO_DATASET } }, { description: { contains: CINTEL_DEMO_DATASET } }],
    },
    select: { id: true },
  });
  const caseIds = cases.map((row) => row.id);
  const personIds = [...new Set(identifiers.map((row) => row.personId))];
  const relationships = await db.drugRelationship.findMany({
    where: {
      OR: [
        { notes: { contains: CINTEL_DEMO_DATASET }, relationshipType: "SUPPLIED_BY" },
        ...(personIds.length > 0 ? [{ fromId: { in: personIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const noteWhere =
    caseIds.length > 0 || personIds.length > 0
      ? {
          OR: [
            ...(caseIds.length > 0 ? [{ caseId: { in: caseIds } }] : []),
            ...(personIds.length > 0 ? [{ personId: { in: personIds } }] : []),
          ],
        }
      : { id: { in: [] as string[] } };
  const notes = await db.drugAnalystNote.findMany({ where: noteWhere, select: { id: true } });
  const noteIds = notes.map((row) => row.id);
  const taskOr = [
    ...(caseIds.length > 0 ? [{ caseId: { in: caseIds } }] : []),
    ...(personIds.length > 0 ? [{ personId: { in: personIds } }] : []),
    ...(noteIds.length > 0 ? [{ sourceNoteId: { in: noteIds } }] : []),
  ];
  const tasks =
    taskOr.length > 0
      ? await db.drugInvestigationTask.findMany({ where: { OR: taskOr }, select: { id: true } })
      : [];
  const collectedForAlerts = [
    ...caseIds,
    ...personIds,
    ...phones.map((row) => row.id),
    ...sims.map((row) => row.id),
    ...devices.map((row) => row.id),
    ...vehicles.map((row) => row.id),
    ...locations.map((row) => row.id),
  ];
  const alerts =
    collectedForAlerts.length > 0
      ? await db.drugIntelligenceAlert.findMany({
          where: {
            OR: [{ entityId: { in: collectedForAlerts } }, { currentCaseId: { in: caseIds } }],
          },
          select: { id: true },
        })
      : [];

  return {
    caseIds,
    personIds,
    phoneIds: phones.map((row) => row.id),
    simIds: sims.map((row) => row.id),
    deviceIds: devices.map((row) => row.id),
    vehicleIds: [...new Set(vehicles.map((row) => row.id))],
    locationIds: locations.map((row) => row.id),
    networkGroupIds: groups.map((row) => row.id),
    relationshipIds: [...new Set(relationships.map((row) => row.id))],
    analystNoteIds: noteIds,
    investigationTaskIds: tasks.map((row) => row.id),
    alertIds: alerts.map((row) => row.id),
  };
}

export function formatCleanupSummary(plan: DemoCleanupPlan): string {
  const lines = [
    `C-INTEL demo cleanup scope (${CINTEL_DEMO_DATASET})`,
    `cases: ${plan.caseIds.length}`,
    `persons: ${plan.personIds.length}`,
    `phones: ${plan.phoneIds.length}`,
    `sims: ${plan.simIds.length}`,
    `devices: ${plan.deviceIds.length}`,
    `vehicles: ${plan.vehicleIds.length}`,
    `locations: ${plan.locationIds.length}`,
    `network groups: ${plan.networkGroupIds.length}`,
    `supplied-by / demo-person relationships: ${plan.relationshipIds.length}`,
    `analyst notes: ${plan.analystNoteIds.length}`,
    `investigation tasks: ${plan.investigationTaskIds.length}`,
    `alerts scoped to demo entity ids: ${plan.alertIds.length}`,
    `caseIds: ${plan.caseIds.join(", ") || "(none)"}`,
    `personIds: ${plan.personIds.join(", ") || "(none)"}`,
  ];
  return lines.join("\n");
}

export async function deleteDemoDataset(db: PrismaClient, plan: DemoCleanupPlan): Promise<void> {
  const allEntityIds = [
    ...plan.caseIds,
    ...plan.personIds,
    ...plan.phoneIds,
    ...plan.simIds,
    ...plan.deviceIds,
    ...plan.vehicleIds,
    ...plan.locationIds,
    ...plan.networkGroupIds,
    ...plan.relationshipIds,
    ...plan.analystNoteIds,
    ...plan.investigationTaskIds,
    ...plan.alertIds,
  ];

  // Restrict FKs: tasks → notes → cases/persons. Delete exact collected ids only.
  if (plan.investigationTaskIds.length > 0) {
    await db.drugInvestigationTask.deleteMany({ where: { id: { in: plan.investigationTaskIds } } });
  }
  if (plan.analystNoteIds.length > 0) {
    await db.drugAnalystNote.deleteMany({ where: { id: { in: plan.analystNoteIds } } });
  }
  if (plan.alertIds.length > 0) {
    await db.drugIntelligenceAlert.deleteMany({ where: { id: { in: plan.alertIds } } });
  }
  if (plan.relationshipIds.length > 0) {
    await db.drugRelationship.deleteMany({ where: { id: { in: plan.relationshipIds } } });
  }
  if (plan.simIds.length > 0) {
    await db.drugSimPhoneHistory.deleteMany({ where: { simId: { in: plan.simIds } } });
    await db.drugSimDeviceHistory.deleteMany({ where: { simId: { in: plan.simIds } } });
  }
  if (plan.caseIds.length > 0) {
    await db.drugCase.deleteMany({ where: { id: { in: plan.caseIds } } });
  }
  if (plan.personIds.length > 0) {
    await db.drugPersonNetworkRole.deleteMany({ where: { personId: { in: plan.personIds } } });
    await db.drugPersonNetworkMembership.deleteMany({ where: { personId: { in: plan.personIds } } });
    await db.drugPersonDevice.deleteMany({ where: { personId: { in: plan.personIds } } });
    await db.drugPersonVehicle.deleteMany({ where: { personId: { in: plan.personIds } } });
    await db.drugPerson.deleteMany({ where: { id: { in: plan.personIds } } });
  }
  if (plan.networkGroupIds.length > 0) {
    await db.drugPersonNetworkMembership.deleteMany({ where: { networkGroupId: { in: plan.networkGroupIds } } });
    await db.drugNetworkGroup.deleteMany({ where: { id: { in: plan.networkGroupIds } } });
  }
  if (plan.phoneIds.length > 0) {
    const stillLinked = await db.drugCasePhone.findMany({
      where: { phoneNumberId: { in: plan.phoneIds } },
      select: { phoneNumberId: true },
    });
    const linked = new Set(stillLinked.map((row) => row.phoneNumberId));
    const orphanPhones = plan.phoneIds.filter((id) => !linked.has(id));
    if (orphanPhones.length > 0) {
      await db.drugSimPhoneHistory.deleteMany({ where: { phoneNumberId: { in: orphanPhones } } });
      await db.drugPhoneNumber.deleteMany({ where: { id: { in: orphanPhones } } });
    }
  }
  if (plan.simIds.length > 0) {
    const stillLinked = await db.drugCaseSim.findMany({
      where: { simId: { in: plan.simIds } },
      select: { simId: true },
    });
    const linked = new Set(stillLinked.map((row) => row.simId));
    const orphans = plan.simIds.filter((id) => !linked.has(id));
    if (orphans.length > 0) await db.drugSim.deleteMany({ where: { id: { in: orphans } } });
  }
  if (plan.deviceIds.length > 0) {
    const stillLinked = await db.drugCaseDevice.findMany({
      where: { deviceId: { in: plan.deviceIds } },
      select: { deviceId: true },
    });
    const linked = new Set(stillLinked.map((row) => row.deviceId));
    const orphans = plan.deviceIds.filter((id) => !linked.has(id));
    if (orphans.length > 0) {
      await db.drugSimDeviceHistory.deleteMany({ where: { deviceId: { in: orphans } } });
      await db.drugPersonDevice.deleteMany({ where: { deviceId: { in: orphans } } });
      await db.drugDevice.deleteMany({ where: { id: { in: orphans } } });
    }
  }
  if (plan.vehicleIds.length > 0) {
    const stillLinked = await db.drugCaseVehicle.findMany({
      where: { vehicleId: { in: plan.vehicleIds } },
      select: { vehicleId: true },
    });
    const linked = new Set(stillLinked.map((row) => row.vehicleId));
    const orphans = plan.vehicleIds.filter((id) => !linked.has(id));
    if (orphans.length > 0) {
      await db.drugPersonVehicle.deleteMany({ where: { vehicleId: { in: orphans } } });
      await db.drugVehicle.deleteMany({ where: { id: { in: orphans } } });
    }
  }
  if (plan.locationIds.length > 0) {
    const stillLinked = await db.drugCaseLocation.findMany({
      where: { locationId: { in: plan.locationIds } },
      select: { locationId: true },
    });
    const linked = new Set(stillLinked.map((row) => row.locationId));
    const orphans = plan.locationIds.filter((id) => !linked.has(id));
    if (orphans.length > 0) await db.drugLocation.deleteMany({ where: { id: { in: orphans } } });
  }
  if (allEntityIds.length > 0) {
    await db.drugAuditLog.deleteMany({ where: { entityId: { in: allEntityIds } } });
  }
}

export function cleanupUsesBroadMatchers(source: string): boolean {
  return /deleteMany\(\s*\{\s*\}\s*\)/.test(source) || /TRUNCATE/i.test(source) || /db push/i.test(source);
}
