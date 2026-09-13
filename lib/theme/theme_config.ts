/**
 * Appearance system — theme configuration (Phase 48A foundation).
 *
 * Pure data: the selectable theme ids plus the default. Modelled exactly
 * like `lib/i18n/dictionary.ts`'s LANGUAGES / DEFAULT_LANGUAGE — a closed,
 * typed union with one validator — so ThemeProvider can reuse the same
 * persisted-preference pattern as LanguageProvider.
 *
 * Each id has a matching `[data-theme="..."]` token block in app/globals.css.
 * Adding another theme is one more id here plus one more CSS block.
 */

export const THEMES = ["navy-command", "border-patrol-green", "classic-white", "midnight-black", "c-intel-purple"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "navy-command";

/**
 * localStorage key holding the selected theme id. Shared by ThemeProvider
 * (the React-side read/write) AND the blocking bootstrap script injected via
 * ThemeBootstrap / useServerInsertedHTML that sets `data-theme` before paint —
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
  "c-intel-purple": { th: "C-INTEL ม่วงดำ", en: "C-INTEL Purple" },
};

export function isTheme(value: string | null | undefined): value is Theme {
  return value != null && (THEMES as readonly string[]).includes(value);
}
