# Thai Date & Retirement Standard

**Phase 40B — Data Standardization & Thai Government Date Foundation**

This document is the single reference for how BPPIS stores, calculates, and
displays dates, ages, service durations, fiscal years, and retirement. Every
future Personnel Intelligence engine (Training, Salary forecasting,
Commander Intelligence, …) must follow this standard rather than inventing
its own date-handling.

## 1. Storage policy: ISO/Gregorian, always

The database stores every date as a real `DATE`/`DateTime` column
(Prisma `@db.Date` / `DateTime`), in Gregorian, ISO-8601 form. **This does
not change in Phase 40B and must never change**: no Buddhist-Era text is
ever written to a date column. Internal calculation code (everything under
`lib/personnel_calendar/`, `lib/intelligence/`) works exclusively in
Gregorian `Date` objects.

```
Stored:    1985-08-11   (Officer.dateOfBirth, a real DATE column)
Displayed: 11 ส.ค. 2528  (via lib/intelligence/shared/thai_date.ts)
```

## 2. Timezone convention: UTC-only, date-only

Every date in this system is a **calendar date**, not a timestamp — a
person's date of birth has no time-of-day or timezone component. All date
math therefore normalizes through `Date.UTC(...)` so a server's local
timezone/DST can never shift a date by one day. This was already
established before Phase 40B (`lib/personnel_calendar/calendar.ts`'s
`dateOnly`/`utcDate`) and Phase 40B does not change it — it only confirms,
via audit, that no call site bypasses it with an unsafe local-time
construction. New code must construct dates with `utcDate(year, month, day)`
or `Date.UTC(...)`, never `new Date(year, month, day)` (which is
local-timezone-dependent) and never read `getFullYear()`/`getMonth()`/
`getDate()` (local-time accessors) — always the `getUTC*` equivalents.

## 3. Exact-duration calculation

`differenceYMD(start, end)` in `lib/personnel_calendar/calendar.ts` is the
**one** exact-duration primitive in the codebase — it existed before Phase
40B and is not reimplemented here. It returns `{ years, months, days }`,
handles variable month lengths and leap years correctly (via
`daysInMonth`), and clamps a negative range to `{0,0,0}` rather than
returning negative numbers.

`lib/intelligence/shared/date_types.ts` gives this shape one name in the
Intelligence vocabulary — `ExactDuration` is a type alias for
`DurationYMD`, not a new type. `lib/intelligence/shared/exact_duration.ts`
adds:

- `computeExactDuration(start, end, missingReason)` — the
  available/duration/reason envelope, guarding invalid `Date` objects
  before they ever reach `differenceYMD`.
- `formatExactDurationTh(duration)` — "40 ปี 11 เดือน 6 วัน" (all three
  units always shown, for a stable/parseable display).
- `formatExactDurationCompactTh(duration)` — the same duration with
  leading zero-value units omitted, for compact contexts.

**Decimal-year approximations (`years + months/12 + days/365`) are never
the primary display value.** They still exist as compatibility fields
(`ageYears`, `careerYears`, `governmentServiceYears`, `remainingYears`) on
the Intelligence summary types for any caller that needs a single sortable
number, but every UI surface this phase touched now reads the exact-duration
field for display.

## 4. Age calculation

`lib/intelligence/age/index.ts`'s `computeAgeSummary(dateOfBirth, asOf)`:

- `exactAge` — `ExactDuration`, the primary output.
- `displayAgeTh` — "40 ปี 11 เดือน 6 วัน", the primary display value.
- `nextBirthdayDate`/`nextBirthdayAge`/`daysUntilNextBirthday` — new in
  Phase 40B; no prior implementation existed anywhere in the codebase
  (confirmed by audit). "Next birthday" is inclusive of today — if today
  IS the birthday, `daysUntilNextBirthday` is `0`.
- `available: false` with `reason: "MISSING_DATE_OF_BIRTH"` (or
  `"INVALID_DATE"`) when `dateOfBirth` is missing or invalid — never a
  computed zero.
- `age`/`ageYears` — kept for backward compatibility with Phase 40A.
  `ageYears` is a decimal approximation; do not use it as a primary display
  value in new code.

## 5. Service-start derivation (no fabricated field)

The `Officer` schema has **no** `serviceStartDate`/`hireDate` column, and
the `Timeline` model has no event-type field distinguishing "first
appointment" from a later promotion/transfer — every `Timeline` row is
simply an assignment record (position/rank/unit at some point in the
officer's career). Phase 40B does not add such a column.

**Timeline-selection rule** (`lib/intelligence/service/index.ts`,
`firstServiceLikeDate` in `lib/intelligence/shared/timeline_dates.ts`): the
service-start candidate is the **earliest dated Timeline row**, by
`effectiveDate` (derived from `day`/`month`/`yearBE` via `toEffectiveDate` —
a year-only row anchors to 1 January of that year). This does not
special-case "the first row must be a hire event" — it is simply the
earliest verifiable fact available. `ServiceSummary.sourceTimelineEntryId`
records which row was used, for traceability.

When an officer has zero dated Timeline rows, `ServiceSummary.available` is
`false` with `reason: "NO_TRUSTWORTHY_TIMELINE_ENTRY"` — never a
zero-duration. `Officer.careerYears` (the stored column) and
`calculateCareerYearsSimple` (the calculated career-years figure) are kept
as separate, clearly-labeled compatibility fields; neither is used as the
service-start source — see `lib/intelligence/shared/master_data.ts`'s
existing note on why `careerYears` is not treated as master data.

## 6. Buddhist Era display

All Buddhist-Era conversion goes through **one** pair of functions —
`yearGregorianToBE`/`yearBEToGregorian` in
`lib/officer_profile/thai_date.ts` (`BE = CE + 543`) — re-exported for the
Intelligence layer as `toBuddhistEraYear` in
`lib/intelligence/shared/thai_date.ts`. **A literal `543` must never appear
in a call site.** Phase 40B's audit found and fixed 6 sites that bypassed
this (see Files Modified in the phase report) — 3 in
`components/ui/thai_date_picker.tsx`, plus `skills_section.tsx`,
`retirement_calculator.ts`, and `salary_step/history.ts`.

`lib/intelligence/shared/thai_date.ts` provides the display formatters:

| Function | Example output |
|---|---|
| `formatFullThaiDateTh(date)` | `11 สิงหาคม 2528` |
| `formatShortThaiDateTh(date)` | `11 ส.ค. 2528` |
| `formatBuddhistEraYearTh(date)` | `พ.ศ. 2528` |
| `formatCompactBuddhistEraYearTh(date)` | `2528` (no "พ.ศ." — for contexts where the era is already implied by a header/label) |

A missing or invalid `Date` renders the fixed Thai fallback **"ไม่มีข้อมูล"**
— never `"Invalid Date"`, never a blank string. `Number.isNaN(date.getTime())`
is the invalid-date check used throughout.

This does not replace every existing Thai date formatter in the codebase
(`formatThaiDate`, `formatThaiPersonnelDate`, `formatLocalizedDate` all
remain, each serving an existing, distinct caller — e.g. the structured
Day/Month/YearBE timeline editor model). Phase 40B's scope is: give new/
touched code ONE formatter to reach for, and fix confirmed hardcoded `+543`
bypasses — not a system-wide formatter consolidation.

### 6.1 Canonical formatter rule (architecture rule, binding going forward)

**`lib/intelligence/shared/thai_date.ts` is the canonical, public Thai
date-display layer for all new Intelligence Engine and Commander View code.**
This is not a suggestion — it is the rule new work is held to:

- All new user-facing Thai date and Buddhist Era formatting must use the
  canonical shared formatter exposed through
  `lib/intelligence/shared/thai_date.ts`.
- New Thai or Buddhist Era date-formatting logic must **not** be introduced
  in unrelated components, services, or feature folders — no new
  `toLocaleDateString("th-TH", ...)`, no new hand-rolled `+543`/`-543`, no
  new locally-defined "format this date in Thai" helper anywhere outside
  this file.
- `formatThaiDate`, `formatThaiPersonnelDate`, `formatLocalizedDate`/
  `formatLocalizedYearBE`, and any remaining inline
  `toLocaleDateString("th-TH", ...)`/`Intl.DateTimeFormat` call sites are
  classified as **legacy compatibility formatters**. Existing parallel
  formatters are considered legacy compatibility mechanisms and must not be
  copied or extended.
- Legacy formatters may remain in place temporarily where they are already
  stable and serving an existing, working caller (e.g. the structured
  Day/Month/YearBE timeline editor model, which `formatThaiDate` is
  purpose-built for). Their existence is not, by itself, a defect to fix
  urgently.
- Their consolidation onto the canonical layer will be handled
  **incrementally**, call site by call site, in a future dedicated
  migration phase — and must preserve behavior exactly when it happens
  (same output for the same input), not just move code around.
- **No broad formatter consolidation is required in Phase 40B**, and none
  was attempted. Phase 40B's actual scope was: fix the 6 confirmed
  hardcoded `±543` bypasses (§6 above) and give newly-touched code one
  formatter to reach for going forward.

## 7. Thai fiscal year

Thai government fiscal year N runs **1 October (N-1) – 30 September (N)**.
`lib/personnel_calendar/fiscal_year.ts`'s `currentFiscalYear(date)` already
implements this correctly (`month >= 10 ? year + 1 : year`, Gregorian-year
labeled) and is unchanged by Phase 40B.
`lib/intelligence/shared/fiscal_year.ts`'s `computeFiscalYearSummary(date)`
wraps it with the Buddhist-Era display pair:

```ts
computeFiscalYearSummary(utcDate(2026, 10, 1))
// { fiscalYear: 2027, fiscalYearBe: 2570, displayFiscalYearTh: "ปีงบประมาณ 2570", start, end }
```

30 September belongs to the fiscal year ending that day; 1 October belongs
to the NEXT fiscal year. Tested explicitly (see §9 below).

## 8. Retirement rule

Officers retire at the end of the fiscal year in which they turn 60
(`THAI_GOVERNMENT_RETIREMENT_AGE`). Because the fiscal year ends 30
September, **an officer born on 1 October or later retires at the end of
the FOLLOWING fiscal year** — this is not `birthYear + 60`, it is
`fiscalYearEnd(currentFiscalYear(addYears(dateOfBirth, 60)))`
(`lib/personnel_calendar/retirement.ts`, unchanged by Phase 40B, already
correct).

**Verified business-rule example**: an officer born 2 October 1985 turns 60
on 2 October 2045 — a date in October, so it falls in fiscal year 2046
(1 Oct 2045 – 30 Sep 2046), not fiscal year 2045. Retirement date:
30 September 2046 = พ.ศ. 2589. This is tested explicitly (§9).

`lib/intelligence/retirement/index.ts`'s `computeRetirementSummary`
composes the full display-ready `RetirementSummary`:

| Field | Meaning |
|---|---|
| `retirementDate` | Gregorian `Date` — 30 Sep of the retirement fiscal year |
| `retirementFiscalYear` | **@deprecated**, Gregorian-labeled internal value — never display |
| `retirementFiscalYearBe` | Buddhist-Era — the value to display |
| `exactRemainingDuration` | `ExactDuration` until retirement |
| `remainingDays` | whole days until retirement (`0` once retired) |
| `displayRetirementDateTh` | `"30 กันยายน 2589"` |
| `displayRetirementYearTh` | `"ปีงบประมาณ 2589"` |
| `displayRemainingTh` | `"20 ปี 8 เดือน 15 วัน"`, or `"เกษียณแล้ว"` once retired |

`available: false` with `reason: "MISSING_DATE_OF_BIRTH"` when
`dateOfBirth` is missing — never a computed zero.

## 9. Test coverage

`lib/intelligence/shared/__tests__/date_foundation.test.ts` (17 tests) and
the pre-existing `lib/personnel_calendar/__tests__/personnel_calendar.test.ts`
together cover: exact age, birthday today/tomorrow, end-of-month dates,
leap-day birth dates, exact service duration, missing service-start date,
Thai Buddhist Era formatting, fiscal year on 30 Sep / 1 Oct, retirement
calculation, the 2 October retirement business rule, missing birth date,
invalid-date handling, and timezone stability. All tests use a fixed,
explicit `asOf` — never `new Date()` — so results never depend on when the
suite runs.

## 10. Unavailable-data behavior (system-wide rule)

Every date-derived Intelligence summary (`AgeSummary`, `ServiceSummary`,
`RetirementSummary`) carries `available: boolean` plus, when `false`, a
machine-readable `reason` (`UnavailableDateReason` in
`lib/intelligence/shared/date_types.ts`: `MISSING_DATE_OF_BIRTH`,
`MISSING_SERVICE_START_DATE`, `INVALID_DATE`,
`NO_TRUSTWORTHY_TIMELINE_ENTRY`). **A consumer must render "unavailable"
(e.g. "—" or "ไม่มีข้อมูล"), never a zero, when `available` is `false`.**
This was already the Phase 40A convention (`IntelligenceSummaryBase`);
Phase 40B extends it to every new duration/date field.

## 11. Migration guidance for future pages

When a new page or component needs a date-derived value:

1. **Never call `differenceYMD`/`calculateAge`/`calculateRetirement`
   directly from a React component.** Call the Intelligence facade
   (`computeAgeSummary`/`computeServiceSummary`/`computeRetirementSummary`)
   from the server/data layer and pass the resulting summary down as props.
2. **Never hardcode `+543`/`-543`.** Import `toBuddhistEraYear` from
   `lib/intelligence/shared/thai_date.ts`.
3. **Never call `date.toLocaleDateString(...)` or build an
   `Intl.DateTimeFormat` for Thai display, and never write a new local Thai
   date-formatting helper.** Use `lib/intelligence/shared/thai_date.ts` —
   the canonical formatter layer (§6.1) — for any new Thai/Buddhist Era
   display.
4. **Never show a decimal-year value as the primary display.** Use the
   `display*Th` string field, or `formatExactDurationTh(exactDuration)`
   directly.
5. **Never assume a summary is available.** Always check `available` first
   and render the Thai fallback / an explicit "not available" state when
   it's `false`.
6. **Do not migrate an existing legacy formatter call site "while you're in
   there."** Leave a stable legacy formatter call site as-is unless the
   specific task at hand is that migration; see §6.1 for the incremental
   migration policy.

## 12. Known limitation: multiple Thai formatter mechanisms still coexist

As of Phase 40B, **five distinct Thai date-formatting mechanisms** still
exist in the codebase side by side: `formatThaiDate`
(`lib/officer_profile/thai_date.ts`), `formatThaiPersonnelDate`
(`lib/officer_profile/thai_personnel_date.ts`), `formatLocalizedDate`/
`formatLocalizedYearBE` (`lib/i18n/format_date.ts`), inline
`toLocaleDateString("th-TH", ...)` call sites, and `Intl.DateTimeFormat`
with the `-u-ca-buddhist` calendar option. Phase 40B fixed only the
**confirmed, audited inconsistencies in the files it touched** (the 6
hardcoded `±543` sites in §6, plus one ungoverned `toLocaleDateString`
call site routed through the canonical formatter). It did not, and was not
scoped to, unify all five mechanisms into one. **Broad consolidation
remains intentionally out of scope** until a future dedicated migration
phase. Per §6.1, no *new* formatter implementation should be added outside
`lib/intelligence/shared/thai_date.ts` — but existing legacy mechanisms are
left in place, stable, until that phase.
