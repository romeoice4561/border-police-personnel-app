/**
 * Pure helpers for e-PF Create/Upload mode (Phase 49A.3).
 *
 * Keeps file-selection / submit-gate logic out of the drawer so it can be
 * unit-tested without a React harness. UI must open Create mode (not the
 * details-only drawer) before these helpers run.
 */

import {
  ALLOWED_DOCUMENT_MIME,
  MAX_DOCUMENT_BYTES,
  validateDocument,
  type DocumentValidationResult,
} from "@/lib/document/document_validation";
import { categoryForTypeCode } from "@/lib/document/document_categories";
import { getDocumentTypeLabel } from "@/lib/document/document_type_labels";
import type { Language } from "@/lib/i18n/dictionary";

/** MIME accept attribute for the create-mode file input. */
export const EPF_CREATE_UPLOAD_ACCEPT = Object.keys(ALLOWED_DOCUMENT_MIME).join(",");

export type EpfCreateUploadMode = "create" | "details" | "replace" | "metadata_edit";

export interface EpfCreateUploadDraft {
  typeCode: string;
  file: File | null;
  title: string;
  description: string;
  issueDate: string;
  expiryDate: string;
  renewalDate: string;
  busy: boolean;
}

export type EpfCreateUploadDisabledReason =
  | "no_file"
  | "busy"
  | "invalid_file"
  | "empty_title"
  | null;

/** Prefill title from the locale-aware document-type registry. */
export function defaultTitleForTypeCode(typeCode: string, locale: Language = "en"): string {
  return getDocumentTypeLabel(typeCode, locale);
}

/** Category code bound to a type — used to assert category binding in tests. */
export function categoryCodeForType(typeCode: string): string {
  return categoryForTypeCode(typeCode).code;
}

export function validateSelectedFile(file: File | null): DocumentValidationResult | { ok: false; code: "NO_FILE"; message: string } {
  if (!file) {
    return { ok: false, code: "NO_FILE", message: "No file selected." };
  }
  return validateDocument({ mimeType: file.type || "application/octet-stream", byteLength: file.size });
}

export function createUploadDisabledReason(draft: Pick<EpfCreateUploadDraft, "file" | "title" | "busy">): EpfCreateUploadDisabledReason {
  if (draft.busy) return "busy";
  if (!draft.file) return "no_file";
  const validation = validateSelectedFile(draft.file);
  if (!validation.ok) return "invalid_file";
  if (!(draft.title ?? "").trim()) return "empty_title";
  return null;
}

export function canSubmitCreateUpload(draft: Pick<EpfCreateUploadDraft, "file" | "title" | "busy">): boolean {
  return createUploadDisabledReason(draft) === null;
}

export function formatFileSizeBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileTypeLabel(file: File): string {
  const ext = ALLOWED_DOCUMENT_MIME[(file.type || "").toLowerCase()];
  if (ext) return ext.toUpperCase();
  const nameExt = file.name.includes(".") ? file.name.split(".").pop() : null;
  return (nameExt ?? (file.type || "FILE")).toUpperCase();
}

/** Builds multipart FormData for POST /api/officers/:id/documents. */
export function buildCreateUploadFormData(input: {
  file: File;
  documentType: string;
  title: string;
  description?: string | null;
}): FormData {
  const form = new FormData();
  form.append("file", input.file, input.file.name);
  form.append("documentType", input.documentType);
  form.append("title", input.title.trim());
  const description = (input.description ?? "").trim();
  if (description) form.append("description", description);
  return form;
}

/**
 * True when Create/Upload mode should open (no persisted document yet).
 * Details mode is for an existing active document only.
 */
export function resolveEpfDrawerMode(hasPersistedDocument: boolean, requested: "create" | "details"): EpfCreateUploadMode {
  if (requested === "create") return "create";
  return hasPersistedDocument ? "details" : "create";
}

export { MAX_DOCUMENT_BYTES, ALLOWED_DOCUMENT_MIME };
