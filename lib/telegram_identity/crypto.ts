/**
 * Token generation & hashing for Telegram binding / handoff (Phase 51.3).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokensEqual(a: string, b: string): boolean {
  const ha = Buffer.from(hashToken(a), "hex");
  const hb = Buffer.from(hashToken(b), "hex");
  if (ha.length !== hb.length) return false;
  return timingSafeEqual(ha, hb);
}
