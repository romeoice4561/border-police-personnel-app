/**
 * Opaque cursor pagination for in-memory gateway results (Phase 51.1).
 * Cursor encodes offset + fingerprint; never embeds raw officer ids in cleartext.
 */
import { createHash } from "node:crypto";
import { PersonnelSearchApiError } from "@/lib/personnel_search_api/errors";

export interface CursorPayload {
  o: number;
  k: string;
}

export function buildSearchFingerprint(parts: {
  query: string;
  disclosureLevel: number;
  userId: string;
  regionId?: number;
  divisionId?: number;
  companyId?: number;
}): string {
  const material = [
    parts.query,
    String(parts.disclosureLevel),
    parts.userId,
    parts.regionId ?? "",
    parts.divisionId ?? "",
    parts.companyId ?? "",
  ].join("|");
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string, expectedFingerprint: string): number {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as CursorPayload;
    if (typeof parsed.o !== "number" || parsed.o < 0 || !Number.isInteger(parsed.o)) {
      throw new Error("bad offset");
    }
    if (parsed.k !== expectedFingerprint) {
      throw new Error("fingerprint mismatch");
    }
    return parsed.o;
  } catch {
    throw new PersonnelSearchApiError("INVALID_REQUEST", "Invalid cursor", 400, "cursor");
  }
}

export function nextCursorForPage(args: {
  offset: number;
  limit: number;
  totalCount: number;
  fingerprint: string;
  /** When true, do not emit next cursor (e.g. first disambiguation page). */
  suppress?: boolean;
}): string | null {
  if (args.suppress) return null;
  const nextOffset = args.offset + args.limit;
  if (nextOffset >= args.totalCount) return null;
  return encodeCursor({ o: nextOffset, k: args.fingerprint });
}
