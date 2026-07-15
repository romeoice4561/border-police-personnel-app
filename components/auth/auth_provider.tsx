/**
 * AuthProvider (Phase 46 — Authentication Foundation).
 *
 * App-wide client auth context. Mock session only — persisted to localStorage
 * (Remember Me) or sessionStorage, and mirrored to a non-HttpOnly cookie so a
 * FUTURE middleware can detect presence (foundation; no enforcement now). No
 * DB, no JWT, no server session.
 *
 * Depends ONLY on the provider-agnostic AuthBackend (getAuthBackend), so
 * swapping the mock for Supabase/AD/SSO/custom-API needs no change here.
 *
 * Mounted inside LanguageProvider so login UI is bilingual. Additive — it gates
 * nothing (soft guard; see RequireAuth + AUTH_ENFORCED). Existing pages behave
 * exactly as today.
 */
"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { getAuthBackend } from "@/lib/auth/mock_auth_backend";
import { SESSION_STORAGE_KEY, SESSION_COOKIE_NAME } from "@/lib/auth/auth_config";
import { hasPermission as hasPerm, type Permission } from "@/lib/auth/roles";
import type { AuthResult, AuthUser, Session } from "@/lib/auth/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** Authenticate via the active backend; on success the session is persisted. */
  login: (username: string, password: string, rememberMe: boolean) => Promise<AuthResult>;
  logout: () => void;
  /** Capability check — the UI's ONE authorization primitive (never role names). */
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Session external store (localStorage/sessionStorage + cookie) ──────────
//
// Using useSyncExternalStore (rather than useEffect + setState) keeps the read
// SSR-safe — the server snapshot is always "no session", so first client render
// matches — and avoids a synchronous setState-in-effect. login()/logout() write
// storage then notify subscribers; a "storage" event syncs other tabs.

const listeners = new Set<() => void>();

function readStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY) ?? window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed?.user?.id && parsed.user.role) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Cached snapshot so getSnapshot returns a STABLE reference between changes (required by useSyncExternalStore). */
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;

function getClientSnapshot(): Session | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SESSION_STORAGE_KEY) ?? window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = readStoredSession();
  }
  return cachedSession;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SESSION_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

function writeStoredSession(session: Session, rememberMe: boolean): void {
  const raw = JSON.stringify(session);
  try {
    if (rememberMe) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, raw);
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, raw);
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : ""; // 30d or session
    document.cookie = `${SESSION_COOKIE_NAME}=1; path=/; samesite=lax${maxAge ? `; max-age=${maxAge}` : ""}`;
  } catch {
    // Storage unavailable (private mode) — nothing persists, but notify() below still updates this tab via the cache.
  }
  notify();
}

function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0`;
  } catch {
    // ignore
  }
  notify();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Server + first client render → null (getServerSnapshot), so hydration
  // matches; the client then adopts any stored session.
  const session = useSyncExternalStore(subscribe, getClientSnapshot, () => null);
  const user: AuthUser | null = session?.user ?? null;
  const status: AuthStatus = user ? "authenticated" : "unauthenticated";

  const login = useCallback(async (username: string, password: string, rememberMe: boolean): Promise<AuthResult> => {
    const result = await getAuthBackend().authenticate(username, password);
    if (result.ok) {
      writeStoredSession({ user: result.user, issuedAt: Date.now() }, rememberMe);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    void getAuthBackend().signOut?.();
    clearStoredSession();
  }, []);

  const can = useCallback((permission: Permission) => hasPerm(user?.permissions, permission), [user]);

  const value = useMemo<AuthContextValue>(() => ({ user, status, login, logout, can }), [user, status, login, logout, can]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Falls back to an unauthenticated read-only value when used outside the provider (safe for tests/isolated renders). */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return {
    user: null,
    status: "unauthenticated",
    login: async () => ({ ok: false, error: "UNKNOWN" }),
    logout: () => {},
    can: () => false,
  };
}
