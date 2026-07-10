/**
 * Position options (Phase 26B Part F — searchable Position combobox).
 *
 * Common Royal Thai Police position titles, offered as Combobox suggestions
 * — never a closed list (an officer's real position text is always
 * preserved/free-typeable, matching the existing Rank/Unit convention from
 * Phase 23A/23B). Reusable master dataset — not hardcoded inside components.
 *
 * Pure data — no I/O, no React.
 */

export const POSITION_OPTIONS: readonly string[] = [
  "ผบ.หมู่",
  "รอง สว.",
  "สว.",
  "รอง ผกก.",
  "ผกก.",
  "รอง ผบก.",
  "ผบก.",
  "รอง ผบช.",
  "ผบช.",
];
