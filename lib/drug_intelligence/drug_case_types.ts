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

export interface DrugCasePersonInput {
  /** Either an existing DrugPerson id (chosen from a duplicate-check result the caller already resolved) OR a brand-new person's identity fields — exactly one of `existingPersonId` or `newPerson` is set. */
  existingPersonId?: string;
  newPerson?: {
    primaryFullName: string;
    nationality: string | null;
    dateOfBirth: Date | null;
    notes: string | null;
    identifiers: Array<{ type: string; value: string; notes: string | null }>;
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
