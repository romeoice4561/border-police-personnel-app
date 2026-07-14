/**
 * Position Level — canonical, structured, BPP-scoped (Phase 41 Part 1).
 *
 * `Timeline.positionLevel` is the AUTHORITATIVE, system-wide source of truth
 * for an officer's position level. Commander Search, Commander Dashboard,
 * Statistics, Charts, Timeline Intelligence and Promotion Intelligence all
 * read this structured value. After Phase 41 nothing derives a level from the
 * free-text `position` at RUNTIME again — `mapPositionTextToLevel` below
 * exists ONLY for the one-time backfill migration and as a default suggestion
 * when a human adds a brand-new timeline row (they can always override it).
 *
 * Scope: this project is for the Border Patrol Police (BPP). The highest
 * command level currently needed for commander analytics is รองผู้บัญชาการ.
 * Higher Royal Thai Police levels are intentionally out of scope and can be
 * APPENDED later without breaking existing data, APIs, searches, charts, or
 * reports — hence the level is a plain string (never a DB enum) and every
 * reader treats an unknown/absent value as UNKNOWN rather than failing.
 *
 * Pure data + pure functions — no I/O, no React, no database.
 */

/** The explicit "not yet classified" sentinel — an unmapped or un-migrated row. Always FIRST so it sorts below every real level. */
export const UNKNOWN_POSITION_LEVEL = "Unknown";

/**
 * The ordered, closed set of position levels, lowest → highest. Order is
 * meaningful: `POSITION_LEVEL_ORDER` / `nextPositionLevel` rely on it for
 * "eligible to advance to the next level" logic. Append higher levels to the
 * END only — never reorder or rename an existing entry (existing stored rows
 * reference these exact strings).
 */
export const POSITION_LEVELS = [
  UNKNOWN_POSITION_LEVEL,
  "รองสารวัตร",
  "สารวัตร",
  "รองผู้กำกับการ",
  "ผู้กำกับการ",
  "รองผู้บังคับการ",
  "ผู้บังคับการ",
  "รองผู้บัญชาการ",
] as const;

export type PositionLevel = (typeof POSITION_LEVELS)[number];

/** The real (non-Unknown) levels, in order — used to populate dropdowns/cards where "Unknown" is not a selectable target. */
export const RANKED_POSITION_LEVELS = POSITION_LEVELS.filter(
  (level): level is Exclude<PositionLevel, typeof UNKNOWN_POSITION_LEVEL> => level !== UNKNOWN_POSITION_LEVEL
);

/** Zero-based rank of each level (Unknown = 0). Higher number = higher command. */
export const POSITION_LEVEL_ORDER: Record<string, number> = Object.fromEntries(
  POSITION_LEVELS.map((level, index) => [level, index])
);

/** Type guard: is `value` one of the canonical level strings? */
export function isPositionLevel(value: string | null | undefined): value is PositionLevel {
  return value != null && (POSITION_LEVELS as readonly string[]).includes(value);
}

/** Normalizes any stored/absent value to a canonical level — null/blank/unrecognized → Unknown. Never throws; the single choke-point every reader uses so an unexpected legacy string can never break search/charts. */
export function normalizePositionLevel(value: string | null | undefined): PositionLevel {
  return isPositionLevel(value) ? value : UNKNOWN_POSITION_LEVEL;
}

/** The level immediately above `level`, or null when already at the top (or Unknown). Used for "eligible to advance to the next level". */
export function nextPositionLevel(level: PositionLevel): PositionLevel | null {
  if (level === UNKNOWN_POSITION_LEVEL) return null;
  const index = POSITION_LEVEL_ORDER[level];
  const next = POSITION_LEVELS[index + 1];
  return next ?? null;
}

/**
 * Maps a free-text position/title to a structured level. Used ONLY by the
 * one-time backfill migration and as a default suggestion for a NEW timeline
 * row — never at runtime for search (that always reads the stored
 * `positionLevel`). Recognizes both the abbreviated forms (รอง สว., ผกก., …)
 * and the full official names. Longest/most-specific patterns are checked
 * first so "รองผู้กำกับการ" is never mis-matched as "ผู้กำกับการ". Returns
 * Unknown when nothing matches — never guesses.
 */
export function mapPositionTextToLevel(position: string | null | undefined): PositionLevel {
  const value = position?.replace(/[\s.]+/g, "").trim();
  if (!value) return UNKNOWN_POSITION_LEVEL;

  // Ordered so a "รอง" (deputy) variant is always tested BEFORE its base
  // level, and the higher command levels before the lower ones — otherwise
  // "รองผู้กำกับการ" would mis-match the "ผกก" of "ผู้กำกับการ". Each pattern
  // is matched (whitespace/dot-stripped) via includes(). Covers both the
  // abbreviated forms (รองสว, ผกก, …) and the full official names.
  const RULES: Array<[Exclude<PositionLevel, typeof UNKNOWN_POSITION_LEVEL>, string[]]> = [
    ["รองผู้บัญชาการ", ["รองผู้บัญชาการ", "รองผบช"]],
    ["รองผู้บังคับการ", ["รองผู้บังคับการ", "รองผบก"]],
    ["รองผู้กำกับการ", ["รองผู้กำกับการ", "รองผกก"]],
    ["รองสารวัตร", ["รองสารวัตร", "รองสว"]],
    ["ผู้บังคับการ", ["ผู้บังคับการ", "ผบก"]],
    ["ผู้กำกับการ", ["ผู้กำกับการ", "ผกก"]],
    ["สารวัตร", ["สารวัตร", "สว"]],
  ];

  for (const [level, patterns] of RULES) {
    if (patterns.some((pattern) => value.includes(pattern.replace(/[\s.]+/g, "")))) {
      return level;
    }
  }
  return UNKNOWN_POSITION_LEVEL;
}
