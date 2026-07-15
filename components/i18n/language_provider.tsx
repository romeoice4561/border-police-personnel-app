/**
 * LanguageProvider — the single, app-wide language context (Phase 43).
 *
 * ONE provider for the whole app (mounted in components/layout/providers.tsx),
 * so every page/component shares one language state — never duplicated. It
 * owns:
 *   • the active `language` and `setLanguage()`,
 *   • persistence to localStorage (survives refresh AND sessions),
 *   • hydration-safe restore: server + first client render use the default
 *     language (Thai) so markup matches; a post-mount effect then adopts the
 *     stored choice with no full-page refresh.
 *
 * Consumers use the hooks below rather than reading context directly:
 *   • useLanguage()      → { language, setLanguage }
 *   • useT()             → t(key) bound to the active language + the language
 *   • useBilingualText() → (BilingualText) => the active-language string
 *
 * Language-agnostic: everything is typed against the open `Language` union in
 * the dictionary, so adding a language needs no change here. Framework code
 * that must localize OUTSIDE React (report/PDF/print templates, AI summaries)
 * imports the pure `translate(key, lang)` from the dictionary and passes the
 * language it reads from here — no duplicate resolution logic.
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  translate,
  type Language,
  type TranslationKey,
} from "@/lib/i18n/dictionary";
import type { BilingualText } from "@/lib/i18n/bilingual_label";

const STORAGE_KEY = "bpp.language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ── External store over localStorage ──────────────────────────────────────
// Using useSyncExternalStore (rather than useEffect + setState) keeps the read
// SSR-safe (server snapshot = default → markup matches first client render) and
// avoids a synchronous setState-in-effect. A module-level listener set lets
// every provider instance and tab stay in sync.

const listeners = new Set<() => void>();

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return DEFAULT_LANGUAGE;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Cross-tab: another tab changing the language updates this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStoredLanguage(next: Language) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore persistence failures — the in-memory choice still applies via listeners.
  }
  listeners.forEach((fn) => fn());
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server + first client render return DEFAULT_LANGUAGE (getServerSnapshot),
  // so hydration matches; the client then re-reads the stored value.
  const language = useSyncExternalStore(subscribe, readStoredLanguage, () => DEFAULT_LANGUAGE);

  const setLanguage = useCallback((next: Language) => {
    writeStoredLanguage(next);
    if (typeof document !== "undefined") document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * The active language + setter. Falls back to a read-only default when used
 * outside a provider (e.g. a component rendered in isolation or in a test),
 * so nothing crashes — it just behaves as the default language.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (ctx) return ctx;
  return { language: DEFAULT_LANGUAGE, setLanguage: () => {} };
}

/** `t(key)` bound to the active language, plus the language itself for conditional formatting (dates, etc.). */
export function useT(): { t: (key: TranslationKey) => string; language: Language } {
  const { language } = useLanguage();
  const t = useCallback((key: TranslationKey) => translate(key, language), [language]);
  return { t, language };
}

/** Returns a function that renders any `BilingualText` in the active language — the runtime replacement for the old always-"th / en" rendering. */
export function useBilingualText(): (text: BilingualText) => string {
  const { language } = useLanguage();
  return useCallback((text: BilingualText) => text[language] ?? text[DEFAULT_LANGUAGE], [language]);
}
