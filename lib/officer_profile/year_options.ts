/**
 * Timeline year options (Phase 23A — Officer Profile Workspace, Section 2).
 *
 * The Career Timeline's Year field must be a dropdown, not free text (the
 * spec explicitly forbids entering "31"/"32"/"33" instead of "2531"/"2532"/
 * "2533"). Range: พ.ศ. 2531–2575, shared between the Zod schema (server) and
 * the Year Select control (client).
 *
 * Pure data — no I/O, no React.
 */

const MIN_YEAR = 2531;
const MAX_YEAR = 2575;

/** Every valid timeline year, descending (most recent first) for the dropdown. */
export const YEAR_OPTIONS: readonly string[] = Array.from(
  { length: MAX_YEAR - MIN_YEAR + 1 },
  (_, i) => String(MAX_YEAR - i)
);

const YEAR_OPTION_SET = new Set(YEAR_OPTIONS);

/** True when `value` is a valid Buddhist-Era year string in the [2531, 2575] range. */
export function isValidTimelineYear(value: string): boolean {
  return YEAR_OPTION_SET.has(value);
}
