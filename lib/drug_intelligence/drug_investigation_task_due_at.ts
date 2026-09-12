/**
 * DI-11D.2 — Investigation Task due-date wire format.
 *
 * The picker selects a calendar day. The API stores an instant. Serialize
 * that day as end-of-day in Asia/Bangkok (UTC+7, no DST).
 */

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function serializeTaskDueAt(isoDate: string | null | undefined): string | null {
  if (isoDate == null) return null;
  const trimmed = isoDate.trim();
  if (!trimmed) return null;
  const match = ISO_DATE.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - BANGKOK_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/** Map a stored dueAt instant back to the Asia/Bangkok calendar day (yyyy-mm-dd). */
export function taskDueAtToPickerValue(iso: string | null | undefined): string {
  if (iso == null || iso.trim() === "") return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const bangkok = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  const year = bangkok.getUTCFullYear();
  const month = String(bangkok.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bangkok.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
