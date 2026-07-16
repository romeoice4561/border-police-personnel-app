/**
 * ThemeProvider — the app-wide appearance/theme context (Phase 48A foundation).
 *
 * Modelled directly on LanguageProvider (components/i18n/language_provider.tsx):
 * ONE provider for the whole app, owns the active `theme` + `setTheme()`,
 * persists to localStorage (survives refresh/sessions), and is hydration-safe
 * (server + first client render use the default theme so markup matches; a
 * post-mount external-store read then adopts the stored choice with no
 * full-page refresh or flash).
 *
 * Sets `data-theme` on <html> — app/globals.css keys its token blocks off that
 * attribute. Today only `navy-command` has real tokens (an exact alias of the
 * pre-existing design tokens, so this phase changes nothing visually); the
 * other three themes are selectable and persist correctly, ready for a future
 * phase to give them real CSS with no provider change.
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_THEME, isTheme, type Theme } from "@/lib/theme/theme_config";

const STORAGE_KEY = "bpp.theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── External store over localStorage (same shape as LanguageProvider) ──────

const listeners = new Set<() => void>();

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return DEFAULT_THEME;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Cross-tab: another tab changing the theme updates this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStoredTheme(next: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore persistence failures — the in-memory choice still applies via listeners.
  }
  listeners.forEach((fn) => fn());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Server + first client render return DEFAULT_THEME (getServerSnapshot), so
  // hydration matches; the client then re-reads the stored value.
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => DEFAULT_THEME);

  const setTheme = useCallback((next: Theme) => {
    writeStoredTheme(next);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * The active theme + setter. Falls back to a read-only default when used
 * outside a provider (e.g. a component rendered in isolation or in a test),
 * so nothing crashes — it just behaves as the default theme.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return { theme: DEFAULT_THEME, setTheme: () => {} };
}
