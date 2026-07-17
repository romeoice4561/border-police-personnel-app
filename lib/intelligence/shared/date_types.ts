/**
 * Shared date-domain types (Phase 40B — Data Standardization & Thai
 * Government Date Foundation).
 *
 * Pure type declarations only — no logic, no I/O, no React. These are the
 * vocabulary every Intelligence engine (age/, service/, retirement/) and
 * every shared date utility (exact_duration.ts, thai_date.ts, fiscal_year.ts)
 * speaks, so a caller never has to guess "is this Gregorian or Buddhist
 * Era", "is this a decimal or an exact duration".
 */

/**
 * An exact calendar duration — years/months/days, never a decimal
 * approximation. This is a type alias for the existing
 * `lib/personnel_calendar` DurationYMD shape (produced by `differenceYMD`),
 * not a new calculation: Phase 40B does not reimplement date math that
 * already exists and is already correct, it gives that shape one name in
 * the Intelligence vocabulary.
 */
export type { DurationYMD as ExactDuration } from "@/lib/personnel_calendar";

/**
 * The standard "may not be computable" result envelope for a duration-typed
 * calculation. `available: false` must always carry a `reason` — never a
 * silent `duration: null` with no explanation. Mirrors
 * IntelligenceSummaryBase's `available` convention (lib/intelligence/shared/
 * types.ts) at the single-value level.
 */
export type ExactDurationResult =
  | { available: true; duration: import("@/lib/personnel_calendar").DurationYMD; reason?: undefined }
  | { available: false; duration: null; reason: string };

/** Standard reasons a date-based calculation is unavailable — stable, machine-checkable identifiers a caller can branch on, distinct from the free-text `reason` string shown to a human. */
export type UnavailableDateReason =
  | "MISSING_DATE_OF_BIRTH"
  | "MISSING_SERVICE_START_DATE"
  | "INVALID_DATE"
  | "NO_TRUSTWORTHY_TIMELINE_ENTRY";
