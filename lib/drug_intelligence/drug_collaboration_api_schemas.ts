/**
 * DI-11B collaboration Zod schemas.
 *
 * Identity fields (actorId, actorName, author, createdBy) are not accepted.
 * If a client sends them they are stripped; the bound session actor wins.
 */

import { z } from "zod";
import {
  ANALYST_NOTE_BODY_MAX,
  COLLABORATION_PAGE_MAX,
  DRUG_INVESTIGATION_TASK_PRIORITIES,
  DRUG_INVESTIGATION_TASK_STATUSES,
  TASK_DESCRIPTION_MAX,
  TASK_TITLE_MAX,
} from "@/lib/drug_intelligence/drug_collaboration_options";

const ID_SAFE = /^[A-Za-z0-9_-]{1,64}$/;

export const collaborationResourceIdSchema = z.string().trim().regex(ID_SAFE, "Invalid id");

export const collaborationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(COLLABORATION_PAGE_MAX).optional(),
});

export const analystNoteCreateSchema = z.object({
  body: z.string().trim().min(1).max(ANALYST_NOTE_BODY_MAX),
  sourceTaskId: collaborationResourceIdSchema.optional().nullable(),
});

export const analystNoteUpdateSchema = z.object({
  body: z.string().trim().min(1).max(ANALYST_NOTE_BODY_MAX),
});

const dueAtSchema = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid datetime" });
      return z.NEVER;
    }
    return parsed;
  });

export const investigationTaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(TASK_TITLE_MAX),
  description: z.string().trim().max(TASK_DESCRIPTION_MAX).optional().nullable(),
  assignedActorId: z.string().trim().min(1).optional().nullable(),
  dueAt: dueAtSchema,
  priority: z.enum(DRUG_INVESTIGATION_TASK_PRIORITIES).optional(),
  sourceNoteId: collaborationResourceIdSchema.optional().nullable(),
});

export const investigationTaskPatchSchema = z.object({
  title: z.string().trim().min(1).max(TASK_TITLE_MAX).optional(),
  description: z.string().trim().max(TASK_DESCRIPTION_MAX).optional().nullable(),
  assignedActorId: z.string().trim().min(1).optional().nullable(),
  dueAt: dueAtSchema,
  priority: z.enum(DRUG_INVESTIGATION_TASK_PRIORITIES).optional(),
  status: z.enum(DRUG_INVESTIGATION_TASK_STATUSES).optional(),
});

export const investigationTaskListQuerySchema = collaborationListQuerySchema.extend({
  status: z.enum(DRUG_INVESTIGATION_TASK_STATUSES).optional(),
  assignedActorId: z.string().trim().min(1).optional(),
  priority: z.enum(DRUG_INVESTIGATION_TASK_PRIORITIES).optional(),
  overdue: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === "true" ? true : value === "false" ? false : undefined)),
});
