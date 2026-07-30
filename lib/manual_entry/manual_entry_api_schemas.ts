/**
 * Manual Personnel Entry API validation (Phase XX — Admin Only, Zod).
 *
 * Validates the POST /api/officers request body. Only rank/firstName/
 * lastName are required (Section 3 of the spec lists many fields, but a
 * human filling the form by hand should never be blocked by a field they
 * don't yet have — matching this codebase's existing "tolerate incomplete
 * data, let the workspace fill in the rest later" philosophy).
 *
 * Pure schema definitions — no I/O.
 */

import { z } from "zod";
import { parseThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";
import { isValidAcademyClass } from "@/lib/officer_profile/academy_class_options";

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

export const manualEntryCreateSchema = z.object({
  rank: z.string().trim().min(1, "Rank is required").max(MAX_FIELD),
  firstName: z.string().trim().min(1, "First name is required").max(MAX_FIELD),
  lastName: z.string().trim().min(1, "Last name is required").max(MAX_FIELD),
  nickname: optionalText,
  policeServiceNumber: optionalText,
  citizenId: optionalText,
  academyClass: z.coerce
    .number()
    .int()
    .nullable()
    .optional()
    .refine((v) => v == null || isValidAcademyClass(v), { message: "Academy class must be between 40 and 100" }),
  currentPosition: optionalText,
  currentUnit: optionalText,
  region: optionalText,
  dateOfBirth: thaiPersonnelDate,
  appointmentDate: thaiPersonnelDate,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .max(MAX_FIELD)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Invalid email address" }),
  employmentStatus: optionalText,
});

export type ManualEntryCreateBody = z.infer<typeof manualEntryCreateSchema>;
