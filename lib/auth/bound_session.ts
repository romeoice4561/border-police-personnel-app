/**
 * DI-11B — signed HttpOnly actor session for collaboration routes only.
 *
 * Existing Drug Intelligence APIs still take client `actorId` after a
 * presence-only `bppis_session` cookie. Collaboration writes must not trust
 * that identity. This module issues and verifies `bppis_actor`, derived from
 * server-side credential verification, and never from request JSON.
 *
 * Not Supabase Auth. Does not rewrite the mock login model.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { BOUND_SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import type { AuthUser } from "@/lib/auth/types";

const TOKEN_VERSION = 1;
const DEV_FALLBACK_SECRET = "bppis-dev-bound-session-secret";

export class BoundSessionSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoundSessionSecretError";
  }
}

export interface BoundSessionPayload {
  v: number;
  actorId: string;
  iat: number;
}

/** Production must set BPPIS_BOUND_SESSION_SECRET. The known local fallback is never used there. */
export function boundSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.BPPIS_BOUND_SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (env.NODE_ENV === "production") {
    throw new BoundSessionSecretError("BPPIS_BOUND_SESSION_SECRET is required in production");
  }
  return DEV_FALLBACK_SECRET;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", boundSessionSecret()).update(payloadB64).digest("base64url");
}

export function signBoundSessionToken(actorId: string, issuedAt = Date.now()): string {
  const payload: BoundSessionPayload = { v: TOKEN_VERSION, actorId, iat: issuedAt };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `v1.${payloadB64}.${sign(payloadB64)}`;
}

export function verifyBoundSessionToken(token: string): BoundSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const payloadB64 = parts[1] ?? "";
  const given = parts[2] ?? "";
  const expected = sign(payloadB64);
  const givenBuf = Buffer.from(given);
  const expectedBuf = Buffer.from(expected);
  if (givenBuf.length !== expectedBuf.length || !timingSafeEqual(givenBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as BoundSessionPayload;
    if (parsed.v !== TOKEN_VERSION || typeof parsed.actorId !== "string" || parsed.actorId.trim() === "") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readCookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return rest.join("=");
  }
  return undefined;
}

export function boundSessionCookie(actorId: string, rememberMe: boolean): string {
  const token = signBoundSessionToken(actorId);
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : undefined;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAgePart = maxAge != null ? `; Max-Age=${maxAge}` : "";
  return `${BOUND_SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${maxAgePart}${secure}`;
}

export function clearBoundSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${BOUND_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function mintBoundSessionCookieHeader(actor: Pick<AuthUser, "id">): string {
  return `${BOUND_SESSION_COOKIE_NAME}=${signBoundSessionToken(actor.id)}`;
}
