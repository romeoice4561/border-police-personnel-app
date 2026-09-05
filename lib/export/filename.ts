/**
 * Safe export filenames (DI-10B).
 *
 * Builds on `toDownloadName()` (Thai-safe, strips `\ / : * ? " < > |`)
 * and additionally rejects control characters, Windows reserved device
 * names, leading/trailing dots/spaces, and over-long names.
 * Never put phones / IMSI / IMEI / national IDs in a filename.
 */

import { toDownloadName } from "@/lib/ui/download_file";

export const EXPORT_FILENAME_MAX_LENGTH = 120;

const WINDOWS_RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "");
}

function stemIsReserved(stem: string): boolean {
  const bare = stem.split(".")[0] ?? stem;
  return WINDOWS_RESERVED.has(bare.toUpperCase());
}

export function sanitizeExportFilename(raw: string, ext: string): string {
  const cleanedExt = (ext.startsWith(".") ? ext.slice(1) : ext).replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const withoutControls = stripControlChars(raw).replace(/\.\.+/g, ".");
  const named = toDownloadName(withoutControls, { ext: cleanedExt });
  const lastDot = named.lastIndexOf(".");
  let stem = lastDot > 0 ? named.slice(0, lastDot) : named;
  stem = stem.replace(/^[.\s]+|[.\s]+$/g, "");
  if (!stem || stemIsReserved(stem)) stem = "export";
  const maxStem = EXPORT_FILENAME_MAX_LENGTH - cleanedExt.length - 1;
  if (stem.length > maxStem) stem = stem.slice(0, Math.max(1, maxStem));
  const result = `${stem}.${cleanedExt}`;
  if (result.includes("..") || result.includes("/") || result.includes("\\")) return `export.${cleanedExt}`;
  return result;
}

export function formatExportDateStamp(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function buildDrugExportFilename(parts: {
  kind: string;
  fiscalYearBe?: number;
  caseNumber?: string;
  boardTitle?: string;
  ext: string;
  now?: Date;
}): string {
  const stamp = formatExportDateStamp(parts.now ?? new Date());
  const tokens = [parts.kind];
  if (parts.fiscalYearBe != null) tokens.push(`fy${parts.fiscalYearBe}`);
  if (parts.caseNumber) tokens.push(parts.caseNumber);
  if (parts.boardTitle) tokens.push(parts.boardTitle);
  tokens.push(stamp);
  return sanitizeExportFilename(tokens.join("-"), parts.ext);
}
