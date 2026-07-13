# Personnel Calendar Engine

The Personnel Calendar Engine is a pure TypeScript foundation for commander-facing personnel analysis. It contains no React, no database access, and no API calls.

## Architecture

- `lib/personnel_calendar/calendar.ts` — UTC date-only helpers, exact years/months/days duration, age calculation.
- `lib/personnel_calendar/fiscal_year.ts` — Thai government fiscal year helpers.
- `lib/personnel_calendar/retirement.ts` — retirement date and remaining-time calculation.
- `lib/personnel_calendar/service.ts` — government service duration from official service start date.
- `lib/personnel_calendar/eligibility.ts` — pluggable eligibility framework for future modules.
- `lib/personnel_calendar/types.ts` — shared domain types.

## Thai Fiscal Year

Thai government fiscal year `N` runs:

- Start: `1 October N-1`
- End: `30 September N`

Examples:

- FY 2026 starts `1 Oct 2025` and ends `30 Sep 2026`.
- A date on `30 Sep 2026` is still FY 2026.
- A date on `1 Oct 2026` is FY 2027.

## Retirement Rule

Thai government officers retire at the end of the fiscal year in which they turn 60.

Because the fiscal year ends on 30 September:

- Born `30 Sep 1985` turns 60 on `30 Sep 2045`, so retirement is `30 Sep 2045`.
- Born `1 Oct 1985` turns 60 on `1 Oct 2045`, which belongs to FY 2046, so retirement is `30 Sep 2046`.
- Born `2 Oct 1985` also retires on `30 Sep 2046`.

Leap day birthdays are normalized by calendar rules when adding years. For example, adding one year to `29 Feb 2000` produces `28 Feb 2001`.

## Service Calculation

Government service duration must use the official government service start date. It must not use:

- Date of birth
- Imported career-year estimates
- Earliest visible timeline row unless that row is explicitly confirmed as the official service start date

The engine returns exact elapsed `years`, `months`, and `days`.

## Eligibility Framework

The eligibility layer is intentionally a framework only. It supports these modules:

- Promotion
- Awards
- Training
- Retirement

Future phases can register rules that evaluate against an `EligibilityContext`. The engine aggregates rule results without hard-coding promotion or award policy.

## Design Notes

- All calculations normalize to UTC date-only values to prevent timezone shifts.
- All functions are pure and deterministic with an explicit `asOf` date.
- No persistence or UI assumptions are baked into the engine.
