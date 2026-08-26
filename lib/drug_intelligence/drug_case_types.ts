/**
 * Drug Intelligence domain types (Phase DI-1).
 *
 * The shape of one "Create Case" submission from the future Create Case
 * form (Round 2 UI) — every section (persons/phones/devices/vehicles/
 * seizedItems/locations) is an array so the form's "+ เพิ่มรายการ" pattern
 * (Section 17) maps directly onto these without transformation. All
 * sections are optional/empty-array-safe: a case can be created with just
 * the required arrest-info fields and sections filled in later through a
 * future edit path (DI-1 does not build a full edit workspace — see the
 * final report's "deferred to DI-2+" list).
 *
 * Pure domain typing — no I/O, no Prisma import.
 */

export interface DrugPersonNetworkRoleInput {
  role: string;
  source: string | null;
  verificationStatus: string;
  note: string | null;
}

export interface DrugPersonNetworkMembershipInput {
  networkGroupId: string | null;
  networkGroupName: string;
  source: string | null;
  note: string | null;
}

export interface DrugCasePersonInput {
  /** Either an existing DrugPerson id (chosen from a duplicate-check result the caller already resolved) OR a brand-new person's identity fields — exactly one of `existingPersonId` or `newPerson` is set. */
  existingPersonId?: string;
  newPerson?: {
    primaryFullName: string;
    /** DI-7.2: dedicated "ชื่อเล่น" — separate from aliases. */
    nickname?: string | null;
    nationality: string | null;
    /** DI-7.2: MALE / FEMALE / UNKNOWN. */
    sex?: string | null;
    dateOfBirth: Date | null;
    /** DI-7.2: only when dateOfBirth is unknown. */
    approximateAge?: number | null;
    notes: string | null;
    /** DI-7.1 fix: secondary aliases — each maps to a DrugPersonAlias row (isPrimary=false). */
    aliases?: Array<{ fullName: string }>;
    identifiers: Array<{ type: string; value: string; notes: string | null }>;
    /** DI-7.3: network-role assertions, each with provenance. */
    networkRoles?: DrugPersonNetworkRoleInput[];
    /** DI-7.2: network/group memberships. */
    networkMemberships?: DrugPersonNetworkMembershipInput[];
  };
  role: string;
  linkedOfficerId: string | null;
  notes: string | null;
  /** Phones/SIMs/devices/vehicles this specific person is linked to WITHIN this case submission (Section 5-9's combined case+person edges). */
  phones: Array<{ rawInput: string; firstSeenAt: Date | null; lastSeenAt: Date | null; notes: string | null }>;
  sims: Array<{ iccid: string | null; imsi: string | null; carrier: string | null; firstSeenAt: Date | null; lastSeenAt: Date | null; notes: string | null }>;
  devices: Array<{
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    imei1: string | null;
    imei2: string | null;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    notes: string | null;
  }>;
  vehicles: Array<{
    registrationNumber: string | null;
    registrationProvince: string | null;
    vehicleType: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    vin: string | null;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    notes: string | null;
  }>;
}

export interface DrugCaseSeizedItemInput {
  /** Canonical analytics key (Phase DI-3.1) — never inferred from drugType. */
  drugCategory: string;
  /** Populated only when drugCategory = "OTHER". */
  otherDrugCategoryLabel: string | null;
  /** COUNT ⇄ quantity or MASS ⇄ weightGrams — enforced server-side (drug_case_api_schemas.ts). */
  measurementKind: string;
  drugType: string;
  subtype: string | null;
  quantity: number | null;
  unit: string | null;
  weightGrams: number | null;
  packageCount: number | null;
  notes: string | null;
}

export interface DrugCaseLocationInput {
  name: string | null;
  addressText: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  latitude: number | null;
  longitude: number | null;
  role: string;
  notes: string | null;
}

/** Phase DI-7.6 Section 8: หน่วยร่วมจับกุม input — canonical org id(s) plus an always-populated display unitText (manual fallback text, or the picker's resolved canonical label — mirrors reportingUnitText/leadUnitText's convention). */
export interface DrugCaseParticipatingUnitInput {
  headquartersId: number | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  unitText: string | null;
  role: string;
  note: string | null;
}

/** Phase DI-7.6 Section 6/9: ชุดจับกุม member input — EITHER officerId (Officer.officerId business key) OR manual external fields. */
export interface DrugCaseOfficerInput {
  officerId: string | null;
  manualRank: string | null;
  manualFullName: string | null;
  manualPosition: string | null;
  manualUnitText: string | null;
  role: string;
  note: string | null;
}

/** One Create Case submission. */
export interface DrugCaseCreateRequest {
  caseNumber: string;
  title: string;
  status: string;
  arrestDate: Date | null;
  arrestTime: string | null;
  headquartersId: number | null;
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
  reportingUnitText: string | null;
  /** Phase DI-7.6: หน่วยจับกุมหลัก — distinct from the reporting-unit fields above. Optional (defaults to null/[]) so pre-DI-7.6 callers/tests keep compiling unchanged (Section 18/26AD: old cases without team data must keep working). */
  leadHeadquartersId?: number | null;
  leadRegionId?: number | null;
  leadBattalionId?: number | null;
  leadCompanyId?: number | null;
  leadUnitText?: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  narrative: string | null;
  persons: DrugCasePersonInput[];
  seizedItems: DrugCaseSeizedItemInput[];
  locations: DrugCaseLocationInput[];
  /** Phase DI-7.6: participating units and arrest team — both optional (Section 9/18). */
  participatingUnits?: DrugCaseParticipatingUnitInput[];
  officers?: DrugCaseOfficerInput[];
  actorId: string;
  actorName: string;
}

export interface DrugCaseCreateResult {
  caseId: string;
}

/** Section 14: thrown when a candidate duplicate PERSON is found and the caller didn't explicitly choose to link the existing record. Blocks creation — never auto-merges. */
export class DrugDuplicatePersonError extends Error {
  constructor(
    public readonly personIndex: number,
    public readonly candidates: Array<{ personId: string; primaryFullName: string; reasons: string[] }>
  ) {
    super("Possible duplicate person found — creation blocked pending review");
    this.name = "DrugDuplicatePersonError";
  }
}

/** Section 18: thrown when the Person Detail Drawer's target person doesn't exist. */
export class DrugPersonNotFoundError extends Error {
  constructor(personId: string) {
    super(`Drug person '${personId}' not found`);
    this.name = "DrugPersonNotFoundError";
  }
}

export class DrugCaseNotFoundError extends Error {
  constructor(caseId: string) {
    super(`Drug case '${caseId}' not found`);
    this.name = "DrugCaseNotFoundError";
  }
}
