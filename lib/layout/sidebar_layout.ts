/**
 * Sidebar layout constants (Phase 48A.1 — Enterprise Sidebar Redesign).
 *
 * The single source of truth for the sidebar's width in both states, so
 * AppShell and any future consumer (a fixed-position element, a print
 * stylesheet, a second layout variant) read the same value instead of a
 * bare Tailwind literal repeated in multiple files — the exact gap flagged
 * in the Phase 48A architecture audit ("sidebar width is a bare literal,
 * not a named token").
 *
 * Expressed both as a Tailwind arbitrary-value class (for the `className`)
 * and as a raw pixel number (for anything that needs the number itself,
 * e.g. a future CSS custom property or JS-side layout calculation).
 */

/** Expanded sidebar width — 272px, within the requested 260–280px range. */
export const SIDEBAR_WIDTH_EXPANDED_PX = 272;
export const SIDEBAR_WIDTH_EXPANDED_CLASS = "md:w-[272px]";

/** Collapsed sidebar width — icon rail only. */
export const SIDEBAR_WIDTH_COLLAPSED_PX = 72;
export const SIDEBAR_WIDTH_COLLAPSED_CLASS = "md:w-[72px]";

/** localStorage key for the persisted collapsed/expanded preference (mirrors LanguageProvider/ThemeProvider's persistence convention). */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = "bpp.sidebarCollapsed";
