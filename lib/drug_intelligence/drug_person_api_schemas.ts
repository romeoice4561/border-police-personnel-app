/**
 * Zod schemas for the DI-2 Person/Matching/Review/Merge API surface.
 * Mirrors drug_case_api_schemas.ts's conventions exactly (MAX_FIELD cap,
 * trimmed strings, explicit `.default([])` on arrays).
 */

import { z } from "zod";

const MAX_FIELD = 500;

export const drugPersonDirectoryQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(MAX_FIELD).optional(),
});

export const drugPersonProfileUpdateSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
  primaryFullName: z.string().trim().min(1).max(MAX_FIELD).optional(),
  nationality: z.string().trim().max(MAX_FIELD).nullable().optional(),
  dateOfBirth: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const drugPersonAddAliasSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
  fullName: z.string().trim().min(1).max(MAX_FIELD),
});

export const drugPersonAddIdentifierSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
  type: z.enum(["THAI_ID", "PASSPORT", "ALIEN_ID", "OTHER", "UNKNOWN"]),
  value: z.string().trim().min(1).max(MAX_FIELD),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const drugPersonMatchReviewDecisionSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
  personAId: z.string().trim().min(1),
  personBId: z.string().trim().min(1),
  decision: z.enum(["CONFIRMED_DUPLICATE", "NOT_SAME"]),
  signals: z.unknown().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const drugPersonMergeRequestSchema = z.object({
  actorId: z.string().trim().min(1),
  actorName: z.string().trim().min(1),
  survivorPersonId: z.string().trim().min(1),
  mergedPersonId: z.string().trim().min(1),
  reason: z.string().trim().max(2000).nullable().optional(),
});

export const drugPersonMergePreviewQuerySchema = z.object({
  actorId: z.string().trim().min(1),
  survivorPersonId: z.string().trim().min(1),
  mergedPersonId: z.string().trim().min(1),
});

/**
 * Section 21/28: Create Case's richer real-time duplicate-candidate check —
 * the Round A matching engine (signals + confidence), NOT DI-1's simpler
 * check-duplicate endpoint. Deliberately a SEPARATE endpoint from
 * check-duplicate (see drug_case_api_schemas.ts's personDuplicateCheckSchema)
 * rather than a replacement, so createCase()'s existing submit-time block —
 * covered by DI-1's passing tests — is never touched by this addition.
 */
export const drugPersonMatchCandidatesForDraftSchema = z.object({
  actorId: z.string().trim().min(1),
  primaryFullName: z.string().trim().max(MAX_FIELD).default(""),
  dateOfBirth: z.string().trim().nullable().optional(),
  identifiers: z.array(z.object({ type: z.string().trim().min(1), value: z.string().trim().min(1) })).default([]),
  phones: z.array(z.string().trim().min(1)).default([]),
  deviceImeis: z.array(z.string().trim().min(1)).default([]),
  vehicleVins: z.array(z.string().trim().min(1)).default([]),
});
