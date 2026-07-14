/**
 * Officer Profile Workspace API validation (Phase 23A, Zod; Phase 23B relaxed
 * to accept real OCR-imported data).
 *
 * Validates the batched-save request body for PATCH /api/officers/{id}. Every
 * section (profile/timeline/education/training) is optional so a save from
 * one card never requires the others; when a section IS present, timeline/
 * education/training arrays are validated in full since they REPLACE the
 * persisted rows.
 *
 * Phase 23B fix: the original schema validated as if every value were freshly
 * typed via the UI dropdowns — rejecting the messy but legitimate data the OCR
 * import produced (empty rank/name on low-confidence records, career years
 * stored as ranges like "2567-ปัจจุบัน" or full Thai dates like "1 ก.พ. 2532",
 * ranks OCR captured outside the closed list). That made the ~94 import-damaged
 * records — the ones that MOST need human editing — impossible to save at all,
 * and blocked every officer whose timeline used a year range. Validation now
 * checks STRUCTURE (right keys, right types, bounded lengths) but tolerates the
 * free-form CONTENT of existing fields. The UI still offers the standard
 * dropdown options as suggestions for new rows; it just no longer forces them.
 *
 * Pure schema definitions — no I/O.
 */

import { z } from "zod";
import { isValidDay, isValidMonth, isValidYearBE, toEffectiveDate } from "@/lib/officer_profile/thai_date";
import { isValidTimelineVerificationStatus } from "@/lib/officer_profile/verification_options";
import { SALARY_STEP_OPTIONS } from "@/lib/officer_profile/salary_step_options";
import { isPositionLevel } from "@/lib/commander_query/position_level";

/** Reasonable upper bound so a field can't be used to store megabytes, without rejecting real Thai text. */
const MAX_FIELD = 500;

/** A free-form, optional text field: trims, caps length, treats "" as null (not-set), never rejects legitimate content. */
const optionalText = z
  .string()
  .trim()
  .max(MAX_FIELD)
  .nullable()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

/**
 * PATCH body: officer profile fields (all optional — only supplied keys are
 * updated). rank/firstName/lastName are free-form here so an import-damaged
 * record (blank rank/name) can still be saved after a human fills in the rest;
 * forcing them non-empty was the primary cause of "Invalid officer profile
 * save request".
 */
export const officerProfilePatchSchema = z.object({
  rank: z.string().trim().max(MAX_FIELD).optional(),
  firstName: z.string().trim().max(MAX_FIELD).optional(),
  lastName: z.string().trim().max(MAX_FIELD).optional(),
  currentPosition: optionalText,
  currentUnit: optionalText,
  phone: optionalText,
  // Email is only validated when a non-empty value is supplied (blank → null).
  email: z
    .string()
    .trim()
    .max(MAX_FIELD)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Invalid email address" }),
  lineId: optionalText,
  facebookUrl: optionalText,
  // Phase 26B Part 5 Part C/I: structured Current Organization hierarchy —
  // ids only, resolved client-side by OrgHierarchyPicker; never re-derived
  // from text server-side (no guessing).
  headquartersId: z.coerce.number().int().positive().nullable().optional(),
  regionId: z.coerce.number().int().positive().nullable().optional(),
  battalionId: z.coerce.number().int().positive().nullable().optional(),
  companyId: z.coerce.number().int().positive().nullable().optional(),
  nickname: optionalText,
  // Phase 26B Part 5 Part G: Personal Information.
  dateOfBirth: z.coerce.date().nullable().optional(),
  bloodGroup: optionalText,
  rh: optionalText,
  maritalStatus: optionalText,
  children: z.coerce.number().int().min(0).nullable().optional(),
  homeProvince: optionalText,
  shirtSize: optionalText,
  nationality: optionalText,
  // Phase 26B Part 5 Part O: optional additional fields.
  citizenId: optionalText,
  passportNumber: optionalText,
  employeeNumber: optionalText,
  emergencyContact: optionalText,
  emergencyPhone: optionalText,
  addressSummary: optionalText,
  currentProvince: optionalText,
  religion: optionalText,
  educationLevel: optionalText,
  weightKg: z.coerce.number().positive().nullable().optional(),
  heightCm: z.coerce.number().positive().nullable().optional(),
  uniformShoeSize: optionalText,
  hatSize: optionalText,
  jacketSize: optionalText,
});

/**
 * One Career Timeline row (Section 2). year/position are stored verbatim from
 * the source (the schema comment on Timeline.year is explicit: "stored as the
 * raw source string, never re-derived") — so they accept any non-empty text
 * (ranges, Thai dates, "ปัจจุบัน" all valid). rank/unit/source are free-form
 * and nullable; verified is free-form with a sensible default applied upstream.
 */
export const timelineRowSchema = z
  .object({
    sequence: z.coerce.number().int().min(0),
    year: z.string().trim().min(1).max(MAX_FIELD),
    yearValue: z.coerce.number().int().nullable(),
    rank: z.string().trim().max(MAX_FIELD).nullable(),
    position: z.string().trim().min(1).max(MAX_FIELD),
    unit: z.string().trim().max(MAX_FIELD).nullable().transform((v) => (v && v.length > 0 ? v : null)),
    // Phase 41 Part 1: structured Position Level — optional/nullable for
    // backward compatibility (a caller that predates this field, e.g. the
    // import path, simply omits it and the row keeps its existing/Unknown
    // level). When present it must be one of the canonical POSITION_LEVELS
    // strings; a blank or absent value normalizes to "Unknown" so the
    // authoritative column is never left null by an edit that went through
    // the workspace. Never re-derived from `position` text here.
    positionLevel: z
      .string()
      .trim()
      .nullable()
      .optional()
      .refine((v) => v == null || v === "" || isPositionLevel(v), { message: "Invalid position level" })
      .transform((v) => (v && v.length > 0 ? v : null)),
    source: z.string().trim().max(MAX_FIELD).nullable().transform((v) => (v && v.length > 0 ? v : null)),
    verified: z.string().trim().min(1).max(MAX_FIELD),
    // Phase 26B Part 3: structured date fields, all optional/nullable — a
    // row saved before the new editor touched it (or a caller that doesn't
    // send them) simply omits them, leaving day/month/yearBE/effectiveDate
    // null and isPresent false, exactly like the legacy `year` column always
    // behaved for un-migrated rows.
    day: z.coerce.number().int().nullable().optional().refine((v) => v == null || isValidDay(v), { message: "Invalid day" }),
    month: z.coerce.number().int().nullable().optional().refine((v) => v == null || isValidMonth(v), { message: "Invalid month" }),
    yearBE: z.coerce.number().int().nullable().optional().refine((v) => v == null || isValidYearBE(v), { message: "Invalid Buddhist-Era year" }),
    isPresent: z.boolean().optional(),
    // Phase 26B Part C: structured org hierarchy ids — all optional/nullable,
    // same "omit and it stays unset" convention as day/month/yearBE above.
    // Server never re-derives these from `unit` text (no guessing); they are
    // only ever set when the client's OrgHierarchyPicker resolved a real id.
    headquartersId: z.coerce.number().int().positive().nullable().optional(),
    regionId: z.coerce.number().int().positive().nullable().optional(),
    battalionId: z.coerce.number().int().positive().nullable().optional(),
    companyId: z.coerce.number().int().positive().nullable().optional(),
    // Phase 26B Part 5 Part D/H/M: verification triad — additive alongside
    // the existing free-text `verified` above (untouched). A true closed set
    // (unlike Rank/Position/Unit, there is no "preserve free legacy value"
    // concern — every row's verificationStatus starts unset).
    verificationStatus: z
      .string()
      .trim()
      .nullable()
      .optional()
      .refine((v) => v == null || v === "" || isValidTimelineVerificationStatus(v), { message: "Invalid verification status" })
      .transform((v) => (v && v.length > 0 ? v : null)),
    verifiedBy: z.string().trim().max(MAX_FIELD).nullable().optional().transform((v) => (v && v.length > 0 ? v : null)),
    verifiedDate: z.coerce.date().nullable().optional(),
    verificationRemark: z.string().trim().max(MAX_FIELD).nullable().optional().transform((v) => (v && v.length > 0 ? v : null)),
  })
  .transform((row) => ({
    ...row,
    // effectiveDate is ALWAYS server-derived from day/month/yearBE — never
    // trusted from the client, so it can never drift from the structured
    // fields it's supposed to summarize.
    effectiveDate: toEffectiveDate({ day: row.day ?? null, month: row.month ?? null, yearBE: row.yearBE ?? null }),
  }));

/** Nullable free-form text: caps length, normalizes "" → null. */
const nullableText = z
  .string()
  .trim()
  .max(MAX_FIELD)
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null));

/**
 * One Education row (Section 3). `institution` is the required identifying
 * field; year/degree/notes are free-form and normalize blank → null.
 */
export const educationRowSchema = z.object({
  year: nullableText,
  institution: z.string().trim().min(1).max(MAX_FIELD),
  degree: nullableText,
  notes: nullableText,
});

/** One Training row (Section 4). `course` is the required identifying field. */
export const trainingRowSchema = z.object({
  year: nullableText,
  course: z.string().trim().min(1).max(MAX_FIELD),
  organization: nullableText,
  notes: nullableText,
});

/**
 * One Salary History row (Phase 28A — Career Intelligence Foundation).
 * `salaryStep` is a true closed set (0.5/1.0/1.5/2.0 — the only 4 legal
 * results per Section 10's spec), unlike Rank/Position/Unit's
 * preserve-free-legacy-value convention; `yearBE` is validated the same way
 * Timeline's structured date fields are. `@@unique([officerId, yearBE])` at
 * the database level is the final guard against duplicate years — this
 * schema only validates a single row's shape, not cross-row uniqueness
 * within the array (the service layer's replace-all write doesn't need it,
 * since the UI itself prevents adding a duplicate year — see Part 4's "no
 * duplicate year" validation on the client).
 */
export const salaryHistoryRowSchema = z.object({
  yearBE: z.coerce.number().int().refine((v) => isValidYearBE(v), { message: "Invalid Buddhist-Era year" }),
  salaryStep: z.coerce.number().refine((v) => (SALARY_STEP_OPTIONS as readonly number[]).includes(v), {
    message: "salaryStep must be one of 0.5, 1.0, 1.5, 2.0",
  }),
  remarks: nullableText,
});

/** The full batched-save request body — every section optional. */
export const officerProfileSaveSchema = z.object({
  profile: officerProfilePatchSchema.optional(),
  timeline: z.array(timelineRowSchema).optional(),
  education: z.array(educationRowSchema).optional(),
  training: z.array(trainingRowSchema).optional(),
  salaryHistory: z.array(salaryHistoryRowSchema).optional(),
});

export type OfficerProfileSaveBody = z.infer<typeof officerProfileSaveSchema>;
