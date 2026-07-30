/**
 * Create-mode portrait helpers (Phase XX.1).
 *
 * Pending local crop result held until Manual Entry create returns an
 * officerId, then uploaded through the existing portrait API (same three-step
 * flow as PortraitManager: original → cropped → set official).
 */

import type { CroppedPortraitResult } from "@/components/officer/portrait_crop_dialog";
import { ALLOWED_PORTRAIT_MIME } from "@/lib/portrait/portrait_validation";

export interface PendingCreatePortrait {
  originalFile: File;
  originalMimeType: string;
  cropped: CroppedPortraitResult;
  /** Object URL for local preview (revoked by the caller when cleared). */
  previewUrl: string;
}

async function uploadPortraitFile(officerId: string, blob: Blob, mimeType: string, filename: string): Promise<number> {
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Upload failed (${res.status}).`);
  }
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function setOfficialPortrait(officerId: string, photoId: number): Promise<void> {
  const res = await fetch(`/api/officers/${encodeURIComponent(officerId)}/portrait/official`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Failed to set official portrait (${res.status}).`);
  }
}

/** Uploads a deferred create-mode portrait via the existing portrait pipeline. */
export async function uploadPendingCreatePortrait(officerId: string, pending: PendingCreatePortrait): Promise<void> {
  await uploadPortraitFile(
    officerId,
    pending.originalFile,
    pending.originalMimeType,
    pending.originalFile.name || "original-portrait"
  );
  const ext = ALLOWED_PORTRAIT_MIME[pending.cropped.mimeType] ?? "jpg";
  const croppedPhotoId = await uploadPortraitFile(
    officerId,
    pending.cropped.blob,
    pending.cropped.mimeType,
    `portrait-cropped.${ext}`
  );
  await setOfficialPortrait(officerId, croppedPhotoId);
}
