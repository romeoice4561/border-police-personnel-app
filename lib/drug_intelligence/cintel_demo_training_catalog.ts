/**
 * C-INTEL training-video demo dataset catalog.
 *
 * Synthetic records only. Maps CASE 001–006 onto fields that already exist.
 * Does not invent schema. Does not change product behavior.
 */

export const CINTEL_DEMO_DATASET = "CINTEL-DEMO-TRAINING-2569" as const;

export const CINTEL_DEMO_BANNER = [
  "DEMO DATA — C-INTEL TRAINING",
  "ข้อมูลสมมติสำหรับสาธิตระบบเท่านั้น",
  "ห้ามนำไปใช้ในการปฏิบัติจริง",
  CINTEL_DEMO_DATASET,
].join("\n");

export const CINTEL_DEMO_ACTOR_ID = "mock:admin";
export const CINTEL_DEMO_ACTOR_NAME = "Administrator";

export const CINTEL_DEMO_CASE_NUMBERS = [
  "DI-TEST-001",
  "DI-TEST-002",
  "DI-TEST-003",
  "DI-TEST-004",
  "DI-TEST-005",
  "DI-TEST-006",
] as const;

export const CINTEL_DEMO_PERSON_IDENTIFIERS = [
  "TEST-PERSON-001",
  "TEST-PERSON-002",
  "TEST-PERSON-003",
  "TEST-PERSON-004",
  "TEST-PERSON-005",
  "TEST-PERSON-006",
] as const;

/** Raw Thai mobiles. Matching key = 66 + digits after leading 0. */
export const CINTEL_DEMO_PHONE_RAW = [
  "0900001001",
  "0900001002",
  "0900001003",
  "0900001004",
  "0900001005",
  "0900001006",
  "0900001007",
] as const;

export const CINTEL_DEMO_SIM_ICCIDS = [
  "89000000000000000001",
  "89000000000000000002",
  "89000000000000000006",
] as const;

export const CINTEL_DEMO_DEVICE_IMEIS = [
  "000000000000001",
  "000000000000002",
  "000000000000004",
  "000000000000006",
  "000000000000008",
] as const;

export const CINTEL_DEMO_VEHICLE_PLATES = [
  { registrationNumber: "TEST-4141", registrationProvince: "ชุมพร" },
  { registrationNumber: "TEST-9009", registrationProvince: "สุราษฎร์ธานี" },
  { registrationNumber: "TEST-MC-100", registrationProvince: "ชุมพร" },
] as const;

export const CINTEL_DEMO_LOCATION_NAME = "จุดพักสินค้า TEST-A";
export const CINTEL_DEMO_NETWORK_GROUP_NAME = "TEST NETWORK — เครือข่ายก้องใต้";

export const CINTEL_DEMO_QA_CASE_NUMBERS = [
  "QA-001",
  "QA-002",
  "QA-003",
  "QA-004",
  "QA-005",
  "QA-DI76-001",
  "QA-MAP-001",
  "QA-MAP-002",
  "QA-MAP-003",
] as const;

export const CINTEL_DEMO_QA_PERSON_A_ID = "b9a6c674-db36-4f40-a7de-4c9a727c37a7";
export const CINTEL_DEMO_QA_PERSON_F_ID = "1f230a17-8055-4905-9e01-d24fde3b08ec";

export const CINTEL_DEMO_TABLET_COUNTS = {
  "DI-TEST-001": 4000,
  "DI-TEST-002": 2000,
  "DI-TEST-003": 20000,
  "DI-TEST-004": 1500,
  "DI-TEST-005": 10000,
} as const;

export const CINTEL_DEMO_ICE_GRAMS = {
  "DI-TEST-002": 120,
  "DI-TEST-003": 1200,
  "DI-TEST-006": 500,
} as const;

export const CINTEL_DEMO_CASE001_METH_MASS_GRAMS = 50;

export const CINTEL_DEMO_EXPECTED_TABLET_TOTAL = 37500;
export const CINTEL_DEMO_EXPECTED_ICE_TOTAL_GRAMS = 1820;

export const CINTEL_DEMO_FIELD_MAPPING = {
  caseNumber: "SUPPORTED",
  title: "SUPPORTED",
  arrestDate: "SUPPORTED",
  arrestTime: "SUPPORTED",
  reportingUnitText: "SUPPORTED",
  province: "SUPPORTED",
  district: "SUPPORTED",
  caseCoordinates: "SUPPORTED",
  personName: "SUPPORTED",
  nickname: "SUPPORTED",
  aliases: "SUPPORTED",
  dateOfBirth: "SUPPORTED",
  nationality: "SUPPORTED",
  identifierOther: "SUPPORTED WITH CURRENT EQUIVALENT",
  caseRole: "SUPPORTED",
  networkRole: "SUPPORTED WITH CURRENT EQUIVALENT",
  networkGroup: "SUPPORTED",
  phone: "SUPPORTED",
  telLabel: "SUPPORTED WITH CURRENT EQUIVALENT",
  simIccid: "SUPPORTED",
  deviceImei: "SUPPORTED",
  vehicle: "SUPPORTED",
  seizureCountMass: "SUPPORTED",
  locationEntity: "SUPPORTED",
  locationTypeRestArea: "SUPPORTED WITH CURRENT EQUIVALENT",
  suppliedByRelationship: "SUPPORTED WITH CURRENT EQUIVALENT",
  reportedVsConfirmed: "SUPPORTED",
  unknownLegalName: "SUPPORTED WITH CURRENT EQUIVALENT",
  graphSuppliedByEdge: "NOT CURRENTLY MODELED",
  simDeviceHistoryUi: "SUPPORTED WITH CURRENT EQUIVALENT",
} as const;

export function tabletTotal(): number {
  return Object.values(CINTEL_DEMO_TABLET_COUNTS).reduce((sum, n) => sum + n, 0);
}

export function iceTotalGrams(): number {
  return Object.values(CINTEL_DEMO_ICE_GRAMS).reduce((sum, n) => sum + n, 0);
}

export function demoNarrative(caseSpecific: string): string {
  return `${CINTEL_DEMO_BANNER}\n\n${caseSpecific}`;
}

export function demoNotes(extra?: string): string {
  return extra ? `${CINTEL_DEMO_BANNER}\n${extra}` : CINTEL_DEMO_BANNER;
}
