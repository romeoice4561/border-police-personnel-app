/**
 * DI-11C — pure Analyst Notes view helpers (no React, no fetch).
 */

import { ApiClientError } from "@/lib/ui/api_client";
import { ANALYST_NOTE_BODY_MAX } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { AnalystNoteDto } from "@/lib/drug_intelligence/drug_collaboration_types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export { ANALYST_NOTE_BODY_MAX };

export type AnalystNotesErrorKind =
  | "mismatch"
  | "merged"
  | "unauthenticated"
  | "forbidden"
  | "validation"
  | "load"
  | "save"
  | "network";

export interface MergedPersonDetails {
  personId: string;
  survivorPersonId: string | null;
}

export function validateNoteBody(
  raw: string,
  max = ANALYST_NOTE_BODY_MAX
): { ok: true; body: string } | { ok: false; reason: "empty" | "too_long"; length: number } {
  const body = raw.trim();
  if (!body) return { ok: false, reason: "empty", length: 0 };
  if (body.length > max) return { ok: false, reason: "too_long", length: body.length };
  return { ok: true, body };
}

export function noteWasEdited(
  note: Pick<AnalystNoteDto, "createdAt" | "updatedAt" | "updatedByName" | "updatedByActorId">
): boolean {
  if (note.updatedByName || note.updatedByActorId) return true;
  return note.updatedAt !== note.createdAt;
}

export function parseMergedPersonDetails(details: unknown): MergedPersonDetails | null {
  if (!details || typeof details !== "object") return null;
  const rec = details as Record<string, unknown>;
  if (typeof rec.personId !== "string" || rec.personId.trim() === "") return null;
  const survivor = rec.survivorPersonId;
  return {
    personId: rec.personId,
    survivorPersonId: typeof survivor === "string" && survivor.trim() !== "" ? survivor : null,
  };
}

export function classifyAnalystNotesError(
  error: unknown,
  mode: "load" | "save"
): { kind: AnalystNotesErrorKind; survivorPersonId: string | null } {
  if (!(error instanceof ApiClientError)) {
    return { kind: mode === "load" ? "load" : "save", survivorPersonId: null };
  }
  if (error.status === 0 || error.code === "NETWORK_ERROR") {
    return { kind: "network", survivorPersonId: null };
  }
  if (error.status === 401 || error.code === "UNAUTHENTICATED") {
    return { kind: "unauthenticated", survivorPersonId: null };
  }
  if (error.status === 403 || error.code === "FORBIDDEN") {
    return { kind: "forbidden", survivorPersonId: null };
  }
  if (error.status === 400 || error.code === "BAD_REQUEST") {
    return { kind: "validation", survivorPersonId: null };
  }
  if (error.status === 409 || error.code === "CONFLICT") {
    const merged = parseMergedPersonDetails(error.details);
    if (merged) return { kind: "merged", survivorPersonId: merged.survivorPersonId };
    return { kind: "mismatch", survivorPersonId: null };
  }
  return { kind: mode === "load" ? "load" : "save", survivorPersonId: null };
}

export function analystNotesErrorMessageKey(kind: AnalystNotesErrorKind): TranslationKey {
  if (kind === "mismatch") return "di.collaboration.actorMismatch";
  if (kind === "merged") return "di.collaboration.mergedPerson";
  if (kind === "unauthenticated") return "di.collaboration.unauthenticated";
  if (kind === "forbidden") return "di.error.permissionDenied";
  if (kind === "validation") return "di.error.validation";
  if (kind === "network" || kind === "load") return "di.collaboration.loadError";
  return "di.collaboration.saveError";
}

/** Panel visibility: failure must never look like empty, and page-change placeholders must keep the list. */
export function analystNotesListVisibility(input: {
  hasData: boolean;
  isPending: boolean;
  isError: boolean;
  itemCount: number;
  composing: boolean;
}): { showLoading: boolean; showError: boolean; showEmpty: boolean; showList: boolean } {
  return {
    showLoading: input.isPending && !input.hasData,
    showError: input.isError,
    showEmpty: input.hasData && !input.isError && input.itemCount === 0 && !input.composing,
    showList: input.hasData && input.itemCount > 0,
  };
}
