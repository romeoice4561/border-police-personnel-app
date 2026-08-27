/**
 * Drug Intelligence API validation (Phase DI-1, Zod).
 *
 * Validates POST /api/drug-intelligence/cases. Only the arrest-info fields
 * required by Section 4 are mandatory (caseNumber/title); every other
 * section is optional/empty-array-safe, matching Section 17's "อย่าสร้าง
 * wizard ที่ทำให้เพิ่มข้อมูลย้อนหลังลำบาก" instruction — a case can be created
 * minimally and filled in later.
 *
 * Pure schema definitions — no I/O.
 */

import { z } from "zod";
import { parseThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";
import { DRUG_CASE_STATUSES } from "@/lib/drug_intelligence/drug_case_options";
import { DRUG_CASE_PERSON_ROLES, DRUG_NETWORK_ROLE_VERIFICATION_STATUSES } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_PERSON_IDENTIFIER_TYPES } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_LOCATION_ROLES } from "@/lib/drug_intelligence/drug_location_options";
import { DRUG_CATEGORIES, DRUG_MEASUREMENT_KINDS } from "@/lib/drug_intelligence/drug_seized_item_options";
import { DRUG_CASE_OFFICER_ROLES, DRUG_CASE_UNIT_ROLES } from "@/lib/drug_intelligence/drug_case_officer_options";
import { withCoordinatePair } from "@/lib/drug_intelligence/drug_coordinate_validation";

const MAX_FIELD = 500;

const optionalText = z
  .string()
  .trim()
  .max(MAX_FIELD)
  .nullable()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const thaiPersonnelDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === "") return null;
    const parsed = parseThaiPersonnelDate(v);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid Buddhist-Era date. Use DD/MM/YYYY (พ.ศ.)." });
      return z.NEVER;
    }
    return parsed;
  });

const identifierSchema = z.object({
  type: z.enum(DRUG_PERSON_IDENTIFIER_TYPES),
  value: z.string().trim().min(1).max(MAX_FIELD),
  notes: optionalText,
});

const phoneSchema = z.object({
  rawInput: z.string().trim().min(1).max(50),
  firstSeenAt: thaiPersonnelDate,
  lastSeenAt: thaiPersonnelDate,
  notes: optionalText,
});

const simSchema = z.object({
  iccid: optionalText,
  imsi: optionalText,
  carrier: optionalText,
  firstSeenAt: thaiPersonnelDate,
  lastSeenAt: thaiPersonnelDate,
  notes: optionalText,
});

const deviceSchema = z.object({
  brand: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  imei1: optionalText,
  imei2: optionalText,
  firstSeenAt: thaiPersonnelDate,
  lastSeenAt: thaiPersonnelDate,
  notes: optionalText,
});

const vehicleSchema = z.object({
  registrationNumber: optionalText,
  registrationProvince: optionalText,
  vehicleType: optionalText,
  brand: optionalText,
  model: optionalText,
  color: optionalText,
  vin: optionalText,
  firstSeenAt: thaiPersonnelDate,
  lastSeenAt: thaiPersonnelDate,
  notes: optionalText,
});

const networkRoleInputSchema = z.object({
  role: z.string().trim().min(1).max(MAX_FIELD),
  source: optionalText,
  verificationStatus: z.enum(DRUG_NETWORK_ROLE_VERIFICATION_STATUSES).default("UNVERIFIED"),
  note: optionalText,
});

const networkMembershipInputSchema = z.object({
  networkGroupId: z.string().trim().min(1).max(MAX_FIELD).nullable().optional().transform((v) => v ?? null),
  networkGroupName: z.string().trim().min(1).max(MAX_FIELD),
  source: optionalText,
  note: optionalText,
});

const aliasSchema = z.object({
  fullName: z.string().trim().min(1).max(MAX_FIELD),
});

const newPersonSchema = z
  .object({
    primaryFullName: z.string().trim().min(1).max(MAX_FIELD),
    nickname: optionalText,
    nationality: optionalText,
    sex: optionalText,
    dateOfBirth: thaiPersonnelDate,
    approximateAge: z.coerce.number().int().min(0).max(150).nullable().optional().transform((v) => v ?? null),
    notes: optionalText,
    aliases: z.array(aliasSchema).default([]),
    identifiers: z.array(identifierSchema).default([]),
    networkRoles: z.array(networkRoleInputSchema).default([]),
    networkMemberships: z.array(networkMembershipInputSchema).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.dateOfBirth !== null && val.approximateAge !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approximateAge"],
        message: "approximateAge must be null when dateOfBirth is provided — do not supply both simultaneously",
      });
    }
    if (val.approximateAge !== null && val.approximateAge < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approximateAge"],
        message: "approximateAge must be a non-negative integer",
      });
    }
  });

const personSchema = z
  .object({
    existingPersonId: z.string().trim().min(1).optional(),
    newPerson: newPersonSchema.optional(),
    role: z.enum(DRUG_CASE_PERSON_ROLES),
    linkedOfficerId: optionalText,
    notes: optionalText,
    phones: z.array(phoneSchema).default([]),
    sims: z.array(simSchema).default([]),
    devices: z.array(deviceSchema).default([]),
    vehicles: z.array(vehicleSchema).default([]),
  })
  .refine((v) => Boolean(v.existingPersonId) !== Boolean(v.newPerson), {
    message: "Exactly one of existingPersonId or newPerson must be set",
  });

/**
 * Phase DI-3.1: drugCategory/measurementKind are the CANONICAL analytics
 * keys (Section 3/4) — validated server-side against the closed enum sets
 * regardless of what the UI dropdown offered, since a UI constraint alone
 * is never a security/data-integrity boundary in this codebase's
 * convention. The superRefine below enforces the COUNT ⇄ quantity / MASS ⇄
 * weightGrams pairing (Section 8) — an ambiguous or contradictory
 * combination (e.g. MASS row with no weightGrams, or a COUNT row that also
 * sets weightGrams) is rejected before it ever reaches the repository,
 * never silently coerced.
 */
const seizedItemSchema = z
  .object({
    drugCategory: z.enum(DRUG_CATEGORIES),
    otherDrugCategoryLabel: optionalText,
    measurementKind: z.enum(DRUG_MEASUREMENT_KINDS),
    drugType: z.string().trim().min(1).max(MAX_FIELD),
    subtype: optionalText,
    quantity: z.coerce.number().nonnegative().nullable().optional().transform((v) => v ?? null),
    unit: optionalText,
    weightGrams: z.coerce.number().nonnegative().nullable().optional().transform((v) => v ?? null),
    packageCount: z.coerce.number().int().nonnegative().nullable().optional().transform((v) => v ?? null),
    notes: optionalText,
  })
  .superRefine((item, ctx) => {
    if (item.drugCategory === "OTHER" && !item.otherDrugCategoryLabel) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherDrugCategoryLabel"], message: "otherDrugCategoryLabel is required when drugCategory is OTHER" });
    }
    if (item.measurementKind === "COUNT") {
      if (item.quantity === null || item.quantity <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "quantity must be > 0 when measurementKind is COUNT" });
      }
      if (item.weightGrams !== null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weightGrams"], message: "weightGrams must not be set when measurementKind is COUNT" });
      }
    }
    if (item.measurementKind === "MASS") {
      if (item.weightGrams === null || item.weightGrams <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weightGrams"], message: "weightGrams must be > 0 when measurementKind is MASS" });
      }
      if (item.quantity !== null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "quantity must not be set when measurementKind is MASS" });
      }
    }
  });

/**
 * Phase DI-7.6 Section 8: หน่วยร่วมจับกุม — canonical org id(s) plus an
 * always-populated unitText display label (mirrors reportingUnitText's
 * convention: the client sends either manual fallback text or the picker's
 * resolved canonical label, never both merged, never left empty). The
 * superRefine rejects a row with no unitText at all, matching the
 * seizedItem/location schemas' pattern for ambiguous/empty input.
 */
const participatingUnitSchema = z
  .object({
    headquartersId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
    regionId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
    battalionId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
    companyId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
    unitText: optionalText,
    role: z.enum(DRUG_CASE_UNIT_ROLES).default("PARTICIPATING"),
    note: optionalText,
  })
  .superRefine((v, ctx) => {
    if (!v.headquartersId && !v.regionId && !v.battalionId && !v.companyId && !v.unitText) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Either a canonical org id or unitText must be provided" });
    }
  });

/**
 * Phase DI-7.6 Section 6/9: ชุดจับกุม member — EITHER an internal officerId
 * (Officer.officerId business key, never a numeric id) OR manual external
 * fields. Same XOR-shaped validation convention as personSchema's
 * existingPersonId/newPerson pair.
 */
const caseOfficerSchema = z
  .object({
    officerId: optionalText,
    manualRank: optionalText,
    manualFullName: optionalText,
    manualPosition: optionalText,
    manualUnitText: optionalText,
    role: z.enum(DRUG_CASE_OFFICER_ROLES),
    note: optionalText,
  })
  .superRefine((v, ctx) => {
    if (!v.officerId && !v.manualFullName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Either officerId or manualFullName must be provided" });
    }
  });

// Phase DI-8 Section 8: shared coordinate-pair rule (range + both-or-neither) — see drug_coordinate_validation.ts.
const locationSchema = withCoordinatePair({
  name: optionalText,
  addressText: optionalText,
  province: optionalText,
  district: optionalText,
  subdistrict: optionalText,
  role: z.enum(DRUG_LOCATION_ROLES),
  notes: optionalText,
});

// Phase DI-8 Section 8: shared coordinate-pair rule applied to the case's own top-level latitude/longitude (see drug_coordinate_validation.ts).
export const drugCaseCreateSchema = withCoordinatePair({
  caseNumber: z.string().trim().min(1, "Case number is required").max(MAX_FIELD),
  title: z.string().trim().min(1, "Title is required").max(MAX_FIELD),
  status: z.enum(DRUG_CASE_STATUSES).default("OPEN"),
  arrestDate: thaiPersonnelDate,
  arrestTime: optionalText,
  headquartersId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  regionId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  battalionId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  companyId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  reportingUnitText: optionalText,
  // Phase DI-7.6: หน่วยจับกุมหลัก — distinct from the reporting-unit fields above.
  leadHeadquartersId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  leadRegionId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  leadBattalionId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  leadCompanyId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  leadUnitText: optionalText,
  province: optionalText,
  district: optionalText,
  subdistrict: optionalText,
  locationName: optionalText,
  narrative: optionalText,
  persons: z.array(personSchema).default([]),
  seizedItems: z.array(seizedItemSchema).default([]),
  locations: z.array(locationSchema).default([]),
  // Phase DI-7.6: participating units and arrest team — both optional/empty-array-safe (Section 9/18: old cases/flows without team data must keep working).
  participatingUnits: z.array(participatingUnitSchema).default([]),
  officers: z.array(caseOfficerSchema).default([]),
});

export type DrugCaseCreateBody = z.infer<typeof drugCaseCreateSchema>;

export const drugCaseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  /** Section 5's single search box — matches case number/title, person name/alias, or phone number. */
  query: z.string().trim().optional(),
  caseNumber: z.string().trim().optional(),
  status: z.enum(DRUG_CASE_STATUSES).optional(),
  province: z.string().trim().optional(),
  headquartersId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  battalionId: z.coerce.number().int().positive().optional(),
  companyId: z.coerce.number().int().positive().optional(),
  arrestDateFrom: z.string().trim().optional(),
  arrestDateTo: z.string().trim().optional(),
  // Phase DI-7.6 Section 13: backend filter foundation for the future Commander Dashboard.
  leadHeadquartersId: z.coerce.number().int().positive().optional(),
  leadRegionId: z.coerce.number().int().positive().optional(),
  leadBattalionId: z.coerce.number().int().positive().optional(),
  leadCompanyId: z.coerce.number().int().positive().optional(),
  participatingUnitCompanyId: z.coerce.number().int().positive().optional(),
  officerId: z.string().trim().optional(),
  officerRole: z.enum(DRUG_CASE_OFFICER_ROLES).optional(),
});

/**
 * Phase DI-8, Section 11/32: GET /api/drug-intelligence/map query params.
 * Extends the case-list filter surface with district, drugCategory, and
 * personId (Section 21's deep-link) — every filter persists in the URL
 * (Section 29), so this schema is also the single source of truth for
 * which query keys the map page reads/writes.
 */
export const drugGeoQuerySchema = z.object({
  status: z.enum(DRUG_CASE_STATUSES).optional(),
  province: z.string().trim().optional(),
  district: z.string().trim().optional(),
  headquartersId: z.coerce.number().int().positive().optional(),
  regionId: z.coerce.number().int().positive().optional(),
  battalionId: z.coerce.number().int().positive().optional(),
  companyId: z.coerce.number().int().positive().optional(),
  arrestDateFrom: z.string().trim().optional(),
  arrestDateTo: z.string().trim().optional(),
  leadHeadquartersId: z.coerce.number().int().positive().optional(),
  leadRegionId: z.coerce.number().int().positive().optional(),
  leadBattalionId: z.coerce.number().int().positive().optional(),
  leadCompanyId: z.coerce.number().int().positive().optional(),
  participatingUnitCompanyId: z.coerce.number().int().positive().optional(),
  officerId: z.string().trim().optional(),
  officerRole: z.enum(DRUG_CASE_OFFICER_ROLES).optional(),
  drugCategory: z.enum(DRUG_CATEGORIES).optional(),
  personId: z.string().trim().optional(),
});
