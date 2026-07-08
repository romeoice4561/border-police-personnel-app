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
});

/**
 * One Career Timeline row (Section 2). year/position are stored verbatim from
 * the source (the schema comment on Timeline.year is explicit: "stored as the
 * raw source string, never re-derived") — so they accept any non-empty text
 * (ranges, Thai dates, "ปัจจุบัน" all valid). rank/unit/source are free-form
 * and nullable; verified is free-form with a sensible default applied upstream.
 */
export const timelineRowSchema = z.object({
  sequence: z.coerce.number().int().min(0),
  year: z.string().trim().min(1).max(MAX_FIELD),
  yearValue: z.coerce.number().int().nullable(),
  rank: z.string().trim().max(MAX_FIELD).nullable(),
  position: z.string().trim().min(1).max(MAX_FIELD),
  unit: z.string().trim().max(MAX_FIELD).nullable().transform((v) => (v && v.length > 0 ? v : null)),
  source: z.string().trim().max(MAX_FIELD).nullable().transform((v) => (v && v.length > 0 ? v : null)),
  verified: z.string().trim().min(1).max(MAX_FIELD),
});

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

/** The full batched-save request body — every section optional. */
export const officerProfileSaveSchema = z.object({
  profile: officerProfilePatchSchema.optional(),
  timeline: z.array(timelineRowSchema).optional(),
  education: z.array(educationRowSchema).optional(),
  training: z.array(trainingRowSchema).optional(),
});

export type OfficerProfileSaveBody = z.infer<typeof officerProfileSaveSchema>;
