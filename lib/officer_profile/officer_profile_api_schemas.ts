/**
 * Officer Profile Workspace API validation (Phase 23A, Zod).
 *
 * Validates the batched-save request body for PATCH /api/officers/{id}. Every
 * section (profile/timeline/education/training) is optional so a save from
 * one card never requires the others; when a section IS present, timeline/
 * education/training arrays are validated in full since they REPLACE the
 * persisted rows. Year/rank/source/verified are validated against the same
 * option lists the UI dropdowns use, so an invalid value (e.g. "31" instead
 * of "2531") is rejected before it reaches the database.
 *
 * Pure schema definitions — no I/O.
 */

import { z } from "zod";
import { isValidRank } from "@/lib/officer_profile/rank_options";
import { isValidTimelineYear } from "@/lib/officer_profile/year_options";
import {
  isValidTimelineSource,
  isValidTimelineVerifiedStatus,
} from "@/lib/officer_profile/timeline_status_options";

const rankSchema = z.string().trim().min(1).refine(isValidRank, { message: "Not a recognized rank" });
const yearSchema = z.string().refine(isValidTimelineYear, { message: "Year must be a valid พ.ศ. 2531-2575 value" });
const sourceSchema = z
  .string()
  .refine(isValidTimelineSource, { message: "Not a recognized data source" })
  .nullable();
const verifiedSchema = z
  .string()
  .refine(isValidTimelineVerifiedStatus, { message: "Not a recognized verification status" });

/** PATCH body: officer profile fields (all optional — only supplied keys are updated). */
export const officerProfilePatchSchema = z.object({
  rank: rankSchema.optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  currentPosition: z.string().trim().min(1).nullable().optional(),
  currentUnit: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  lineId: z.string().trim().min(1).nullable().optional(),
  facebookUrl: z.string().trim().url().nullable().optional(),
});

const timelineRankSchema = z
  .string()
  .refine(isValidRank, { message: "Not a recognized rank" })
  .nullable();

/** One Career Timeline row (Section 2) — year/rank use dropdown-backed enums, unit is free text (autocomplete, never forced). */
export const timelineRowSchema = z.object({
  sequence: z.coerce.number().int().min(0),
  year: yearSchema,
  yearValue: z.coerce.number().int().nullable(),
  rank: timelineRankSchema,
  position: z.string().trim().min(1),
  unit: z.string().trim().min(1).nullable(),
  source: sourceSchema,
  verified: verifiedSchema,
});

/**
 * One Education row (Section 3). `institution` is required; year/degree/
 * notes are nullable but NOT optional — since a save REPLACES the full row
 * list, every row must explicitly state null rather than omit the key.
 */
export const educationRowSchema = z.object({
  year: z.string().trim().min(1).nullable(),
  institution: z.string().trim().min(1),
  degree: z.string().trim().min(1).nullable(),
  notes: z.string().trim().nullable(),
});

/** One Training row (Section 4). Same nullable-but-required convention as Education. */
export const trainingRowSchema = z.object({
  year: z.string().trim().min(1).nullable(),
  course: z.string().trim().min(1),
  organization: z.string().trim().min(1).nullable(),
  notes: z.string().trim().nullable(),
});

/** The full batched-save request body — every section optional. */
export const officerProfileSaveSchema = z.object({
  profile: officerProfilePatchSchema.optional(),
  timeline: z.array(timelineRowSchema).optional(),
  education: z.array(educationRowSchema).optional(),
  training: z.array(trainingRowSchema).optional(),
});

export type OfficerProfileSaveBody = z.infer<typeof officerProfileSaveSchema>;
