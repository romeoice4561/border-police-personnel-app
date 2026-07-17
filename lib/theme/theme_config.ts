/**
 * Appearance system — theme configuration (Phase 48A foundation).
 *
 * Pure data: the four theme ids the product will eventually ship, plus the
 * default. Modelled exactly like `lib/i18n/dictionary.ts`'s LANGUAGES/
 * DEFAULT_LANGUAGE — a closed, typed union with one validator — so
 * ThemeProvider can reuse the same persisted-preference pattern as
 * LanguageProvider.
 *
 * Only `navy-command` has real CSS tokens today (see app/globals.css); the
 * other three are valid, selectable, and persisted, but are visual no-ops
 * (fall back to the base tokens) until a future phase defines their palettes.
 * No other code changes when that happens — just a new `[data-theme="..."]`
 * block in globals.css.
 */

export const THEMES = ["navy-command", "border-patrol-green", "classic-white", "midnight-black"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "navy-command";

/**
 * localStorage key holding the selected theme id. Shared by ThemeProvider
 * (the React-side read/write) AND the blocking inline script in the root
 * layout's <head> (app/layout.tsx) that sets `data-theme` before hydration —
 * both MUST read the same key, so it lives here rather than being duplicated
 * as a string literal in two files.
 */
export const THEME_STORAGE_KEY = "bpp.theme";

/** Bilingual display label per theme, for the Appearance picker. */
export const THEME_LABELS: Record<Theme, { th: string; en: string }> = {
  "navy-command": { th: "กองบัญชาการนาวี", en: "Navy Command" },
  "border-patrol-green": { th: "ตำรวจตระเวนชายแดนสีเขียว", en: "Border Patrol Green" },
  "classic-white": { th: "คลาสสิกขาว", en: "Classic White" },
  "midnight-black": { th: "มิดไนท์แบล็ก", en: "Midnight Black" },
};

export function isTheme(value: string | null | undefined): value is Theme {
  return value != null && (THEMES as readonly string[]).includes(value);
}
