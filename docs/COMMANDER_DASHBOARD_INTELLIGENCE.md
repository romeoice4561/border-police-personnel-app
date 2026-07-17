# Commander Dashboard Intelligence

**Phase 42 — Commander Dashboard Intelligence**

This document describes how the Commander Dashboard (`app/dashboard/page.tsx`)
consumes existing Intelligence Engine outputs to become a decision-support
workspace, rather than a personnel-count page. It is the Dashboard-specific
companion to `docs/Personnel_Intelligence_Architecture.md` (the layer
architecture) and `docs/THAI_DATE_AND_RETIREMENT_STANDARD.md` (the date/
Buddhist-Era rules every display value here follows).

## Dashboard data flow

```
Master Data
  → Intelligence Engine (lib/intelligence/{promotion,age,retirement})
  → Commander Dashboard View Model (lib/commander_dashboard/)
  → Dashboard UI (components/intelligence/dashboard_*.tsx)
```

Concretely:

1. `lib/server/commander_dashboard_service.ts`'s `getCommanderDashboardViewModel()`
   calls `getCommanderQueryDataset()` — the SAME dataset Commander Search
   already computes, including `promotionIntelligence: PromotionSummary`
   per officer (Phase 41) and, as of Phase 42, `dateOfBirth` (added
   additively to `CommanderQueryOfficer` so the dashboard can compute
   Age/Retirement Intelligence from this one already-loaded dataset instead
   of a second Prisma round-trip).
2. It projects each officer to the minimal `DashboardSourceOfficer` shape
   and calls `composeCommanderDashboardViewModel()`
   (`lib/commander_dashboard/view_model.ts`) with a deterministic `asOf`.
3. `composeCommanderDashboardViewModel` is **pure** — no I/O, no Prisma. It
   calls `computeAgeSummary`/`computeRetirementSummary`
   (`lib/intelligence/{age,retirement}`) per officer and reads
   `PromotionSummary` fields already present on each source officer. It
   does not calculate promotion eligibility, age, retirement dates, or
   fiscal years itself — every date/duration/status value is read from an
   Intelligence Engine summary.
4. The Dashboard page (`app/dashboard/page.tsx`) renders the resulting
   `CommanderDashboardViewModel` through five new components
   (`components/intelligence/dashboard_{action_center,promotion_
   intelligence,promotion_priority,birthday_intelligence,retirement_
   awareness}.tsx`), each a pure rendering layer over already-computed
   fields.

**Architecture rule (binding):** promotion eligibility calculations may
only come from `lib/intelligence/promotion`. Thai date and Buddhist Era
formatting must use `lib/intelligence/shared/thai_date.ts`. Exact duration
must use `lib/intelligence/shared/exact_duration.ts`. No dashboard file —
service or component — computes any of these independently.

## KPI definitions

### Promotion Intelligence (Task 3)

Seven KPI cards, one per `PromotionEligibilityStatus` value, each showing
`viewModel.promotion.<status>` — a plain count of officers whose
`promotionIntelligence.promotionStatus` equals that value. Sourced from
`countPromotionStatuses()` (`lib/commander_dashboard/view_model.ts`), which
does nothing but tally an already-computed field.

| Card (Thai) | `PromotionEligibilityStatus` |
|---|---|
| ครบคุณสมบัติปีนี้ | `EligibleThisYear` |
| ครบคุณสมบัติสะสม | `AlreadyEligible` |
| รอดำเนินการ | `Waiting` |
| ขาดหลักสูตร | `MissingTraining` |
| ขาดเอกสาร | `MissingDocuments` |
| ใกล้เกษียณก่อนเลื่อนตำแหน่ง | `RetirementRestricted` |
| ไม่สามารถวิเคราะห์ได้ | `Unknown` |

A card with a truthful zero count (because no `PROMOTION_POLICIES` entry
configures that blocker yet — see Phase 41's documented limitation) renders
in a **neutral, subdued tone** with a hint ("ยังไม่ได้กำหนดนโยบาย" —
"not yet configured by policy") rather than an alert tone. The card is
never hidden — the architectural capability stays visible — but a zero is
never presented as urgent.

Every KPI card is clickable (`KpiCard`'s existing `onClick` prop,
previously unused by the Dashboard) and navigates to
`/commander-search?promotionEligibilityStatus=<status>`.

### Promotion Priority list (Task 4)

"ผู้ควรได้รับการพิจารณาก่อน" — `viewModel.promotion.priorityCandidates`,
built by `buildPromotionPriorityCandidates()`:

- Filters out any officer whose `priority` is `null` (per `PromotionSummary`'s
  documented convention, `null` means "Unknown status, nothing to
  prioritize" — never treated as priority zero).
- Sorts by `priority` descending.
- Limits to the dashboard preview count (default 10) via a `limit` param;
  the full list is reachable via the "ดูทั้งหมด" button linking to
  Commander Search.
- **Does not recompute the score.** Every field displayed
  (`displayStatusTh`, `displayEligibleSinceTh`, `displayEligibleDurationTh`,
  `promotionCyclesPassed`, `priority`, `priorityReason`) is read directly
  from `PromotionSummary`; `displayEligibleDurationTh` is the one
  formatting step performed here, via
  `formatExactDurationTh({years, months, days})` — reusing the Phase 40B
  shared formatter, not a new calculation.

The list is explicitly labeled as decision-support information (Task 4's
"do not treat priority as an automatic appointment decision" rule) via the
subtitle under the section title.

## Birthday rules implemented (Task 5)

`computeBirthdayIntelligence()` builds three lists from every officer with
a usable `AgeSummary` (i.e. `available: true` and a valid
`nextBirthdayDate`):

- **Today** (`daysUntilBirthday === 0`).
- **Next 7 days** (`0 <= daysUntilBirthday <= 7`), sorted soonest first.
- **This month** — uses each officer's actual **birth month/day** (not
  `nextBirthdayDate`, which may roll into next year for a birthday already
  passed this month), so an already-passed birthday earlier in the current
  calendar month is still included. Sort order: today's birthdays first,
  then upcoming (soonest first), then already-passed (most recent first) —
  exactly the three-way order Task 5 specifies.

**Overlap is expected and correct**: an officer can appear in both "next 7
days" and "this month" simultaneously — Task 5 explicitly allows this.
Only each list's own count is never double-counted internally.

Display text — `displayTurningAgeTh` — is built directly from
`AgeSummary.nextBirthdayAge`/`daysUntilNextBirthday` (no age math in this
module):

- `daysUntilBirthday === 0` → `"ครบ {age} ปี วันนี้"`
- otherwise → `"ครบ {age} ปี ในอีก {days} วัน"`

`displayBirthdayTh` ("25 ก.ค. 2569") is `formatShortThaiDateTh` applied to
`nextBirthdayDate` — the Phase 40B canonical Thai date formatter, never a
locally-built string.

**Leap-day birthdays** (29 February) are handled by the existing,
unmodified `addYears` primitive (`lib/personnel_calendar/calendar.ts`),
which clamps to 28 February in a non-leap target year — this module does
not special-case leap days itself; it inherits the primitive's documented,
tested behavior.

## Retirement rules consumed (Task 6)

`computeRetirementAwareness()` builds cumulative retiring-soon bands (an
officer retiring in 8 months counts toward the 1-year, 3-year, AND 5-year
bands — matching how a commander reads "within N years") from every
officer with a usable `RetirementSummary` (`available: true`,
`!isRetired`), within a 5-year horizon:

- `withinOneYear` / `withinThreeYears` / `withinFiveYears` — counts.
- `candidates` — the full drill-down list (Task 6's required columns: rank/
  name, unit, current age via `AgeSummary.displayAgeTh`, retirement date
  via `RetirementSummary.displayRetirementDateTh`, retirement fiscal year
  via `displayRetirementYearTh`, remaining time via `displayRemainingTh`,
  and promotion status where available — `null` when the officer's
  promotion status is `Unknown`, never a fabricated status).

This is explicitly a **dashboard awareness summary only** — Task 6
forbids redesigning the full retirement analytics page, and this phase
does not touch one.

## Action Center categories (Task 7)

`buildActionCenter()` consolidates up to four category types, each
appearing ONLY when its count is greater than zero (an empty Action Center
renders an empty-state message, never a fabricated "all clear" item):

| Category | Trigger | Severity |
|---|---|---|
| `PROMOTION_PRIORITY` | `AlreadyEligible` officers with `priority >= 80` | high |
| `RETIREMENT` | `retirement.withinOneYear > 0` | medium |
| `DATA_QUALITY` | `promotion.unknown > 0` | medium |
| `BIRTHDAY` | `birthdays.todayCount > 0` | **info, always** |

**Birthdays are always `info` severity** — Task 7 explicitly forbids
inflating a birthday into an urgent item; this is enforced structurally
(the birthday branch is the only one that ever sets `severity: "info"`),
not by convention.

## Drill-down behavior (Task 9)

The Dashboard does **not** duplicate Commander Search's filter system. It
links to it via a small, additive query-string convention — new plumbing,
since none existed before this phase (confirmed by audit: Commander
Search's filters were pure in-memory React state with zero URL awareness):

| Dashboard link | Commander Search filter |
|---|---|
| `/commander-search?promotionEligibilityStatus=<status>` | `CommanderQueryFilters.promotionEligibilityStatus` — a NEW, additive filter field matching `CommanderQueryOfficer.promotionIntelligence.promotionStatus`. Deliberately named distinctly from the pre-existing `promotionStatus` filter (the Phase 40A score-ratio status) to avoid silently conflating two different status systems. |
| `/commander-search?retirement=within-1-year` (or `within-3-years`/`within-5-years`) | `CommanderQueryFilters.retirementWithin` — a NEW filter comparing `CommanderQueryOfficer.retirementYear` against the current year. |
| `/dashboard?birthday=today` | Reserved for a future same-page anchor/scroll — not yet consumed (see Known Limitations). |

`app/commander-search/page.tsx` reads `searchParams` (Next.js 16's
`Promise<Record<string, string|string[]|undefined>>` convention — see
`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`)
and seeds `CommanderQueryCenter`'s initial filter state via a new
`initialFilters` prop, applied **once on mount only**. Subsequent in-page
filter changes remain pure client state — no ongoing URL sync was added,
matching the existing convention and avoiding scope creep into a "shareable
filter state" feature Commander Search itself doesn't have yet. An
unrecognized/malformed query value is silently ignored, never crashes the
page.

Every meaningful KPI, Action Center item, and priority-candidate row is
clickable; birthday cards expand an inline list rather than navigating away
(keeping the interaction on the Dashboard, since Task 9 also says "avoid
decorative cards with no interaction" without mandating navigation for
every case).

## Unavailable-data behavior (Task 12)

`CommanderDashboardViewModel.personnelOverview.dataUnavailableCount`
explicitly counts officers with no usable `dateOfBirth` — these officers
are silently excluded from every birthday/retirement list and count (they
cannot be computed), but the total is surfaced separately so "zero
birthdays this month" and "12 officers have no usable birth-date data" are
never conflated. This mirrors the Intelligence Engine's `available: boolean`
convention (`IntelligenceSummaryBase`) at the dashboard-aggregate level.

Confirmed-zero (e.g. "0 officers missing training, because none is
configured as required yet") and unavailable (no dateOfBirth) are
distinguished at every level: a KPI count reports a real number in both
cases, but only the unavailable case additionally surfaces
`dataUnavailableCount` and (for policy gaps) the "ยังไม่ได้กำหนดนโยบาย"
hint text.

## Document Expiry Intelligence — reserved future integration point (Task 8)

**Not implemented in Phase 42.** The Action Center reserves a disabled,
inert line — `"เอกสารใกล้หมดอายุ — รอเชื่อมระบบ Document Intelligence"` —
using the SAME disabled/inert visual convention already established by
Commander Search's Excel/PDF/CSV export buttons
(`components/commander/query/commander_query_center.tsx`). It shows no
count (inventing one would violate the "no fabricated data" rule) and is
not a functioning feature — purely a documented placeholder marking where
Phase 46 will attach.

See **Phase 46 plan** below and `docs/INTELLIGENCE_ROADMAP.md`'s Document
Intelligence section for the full requirement list.

### Phase 46 — Document & Expiry Intelligence (planning only)

Phase 46 must support:

- Expiring document categories — at minimum: บัตรประจำตัวประชาชน
  (National ID), ใบอนุญาตขับขี่ (Driver License), ประกันภัยรถยนต์
  (Insurance Policy), พ.ร.บ. รถยนต์ (Compulsory/Motor Insurance), ภาษีรถยนต์
  (Vehicle Tax), Passport — an open, extensible set, matching the existing
  `OfficerDocument.documentType` free-text convention, never a closed DB
  enum, so a new category is a data entry, never a schema/code change.
- Issue date and expiry date per document (new schema fields — NOT added
  in Phase 42).
- A Thai date picker for entering both dates (reusing the existing
  `components/ui/thai_date_picker.tsx`, not rebuilding one).
- A countdown to expiry — **calculated dynamically at read time; NO
  countdown value is ever stored.** This mirrors every other Intelligence
  Engine convention in this codebase (retirement remaining, promotion
  eligible-duration, age) — a countdown is a derived value, and storing it
  would let it drift from its source date the moment time passes.
- Expiry status: normal / **Expiring Soon** / **Expired** (Thai labels TBD
  at implementation time, following the existing bilingual dictionary
  convention) — an explicit `DocumentExpiryStatus`-style enum, following
  the same "explicit status, never inferred from a raw date at the UI
  layer" pattern `PromotionEligibilityStatus`/`RetirementSummary` already
  establish.
- Configurable reminder thresholds (e.g. "urgent"/"expiring soon" at N
  days) — policy DATA, not hardcoded, following `PROMOTION_POLICIES`'s
  precedent (`lib/promotion/eligibility_policy.ts`) of keeping tunable
  thresholds in one data table, never scattered magic numbers.
- **Officer-level reminder cards** (on the Officer Profile) — per-document
  expiry cards, not just a table row.
- **Commander-level summary** on this Dashboard (replacing today's
  disabled placeholder line) with filtered drill-down — following the
  exact Master Data → Intelligence Engine → Commander View flow this
  document describes, with a new `lib/intelligence/document_expiry/` (or
  similar) facade.
- Future **LINE**, **Telegram**, and **in-app** notifications — explicitly
  OUT of scope for the engine/UI work itself; Phase 46 should design the
  trigger points (e.g. "officer crosses into 'expiring soon'/'expired'
  status") without implementing any notification channel or integration.

None of the above is implemented, scaffolded, or stubbed in Phase 42
beyond the single disabled Action Center line and this documentation.

### Future Commander Dashboard — Birthday Intelligence drill-down (planning note)

Recorded per this phase's UI refinement pass request — **not implemented,
documentation only.** The three Birthday Intelligence cards (`เกิดวันนี้`,
`เกิดภายใน 7 วัน`, `เกิดเดือนนี้`) already exist and are clickable
(`components/intelligence/dashboard_birthday_intelligence.tsx`), but today
they only expand an inline list on the SAME page — they do not navigate to
Commander Search or carry a shareable URL the way the Promotion/Retirement
KPI cards do. A future pass should decide whether "drill-down" for
birthdays means:

1. Adding `birthday=today` / `birthday=next-7-days` / `birthday=this-month`
   as a genuine Commander Search filter (would require Commander Search to
   gain birthday-awareness fields it doesn't have today — `CommanderQueryOfficer`
   has no birthday-specific fields, only `ageYears`), or
2. Keeping the interaction local to the Dashboard (today's behavior) and
   only using the URL convention (`/dashboard?birthday=today`, already
   reserved — see Known Limitations) to deep-link into the already-expanded
   card from an external link (e.g. an Action Center item or a future
   notification).

No decision has been made; this note exists so a future phase does not
have to rediscover the question.

## Known limitations

- **No live UI verification was performed in this phase** — Phase 42 was
  built and verified via `tsc --noEmit`, the full test suite, and
  `next build` (which statically compiles and type-checks every route,
  including `app/dashboard/page.tsx`'s Server Component data fetching).
  An interactive browser check against a running, authenticated session
  was not possible in this environment; visually confirming spacing/
  responsive behavior on a live dashboard is recommended before this
  phase is considered fully done.
- **`/dashboard?birthday=today` is a reserved link, not yet consumed** —
  the Action Center's birthday item links there, but no same-page
  anchor/scroll/highlight behavior exists yet to act on it. A future pass
  should either wire this up or change the link to point at the Birthday
  Intelligence section's "today" tab directly.
- **`retirementWithin` filtering in Commander Search uses `retirementYear`
  (a whole Gregorian year), not exact remaining days** — coarser than the
  Dashboard's own `remainingDays`-based cumulative bands. An officer whose
  retirement falls very early in a year could be classified slightly
  differently between the Dashboard's count and Commander Search's
  filtered list. Documented rather than silently accepted as identical.
- **The pre-existing coarse `PromotionStatus`/`OfficerIntelligenceCard`
  path (`lib/intelligence/dashboard.ts`, `commander_intelligence_service.ts`)
  is unchanged and still powers the "existing supporting overview
  metrics" section** (`DashboardKpiSection`, `CommanderDashboardPanel`) —
  Phase 42 did not migrate these to the newer `PromotionSummary`-based
  engine, per the "preserve backward compatibility, do not redesign
  Dashboard [entirely]" scope constraint. This is intentional, not an
  oversight — see `docs/Personnel_Intelligence_Architecture.md`'s Risks
  section for the broader "two promotion systems" note this extends.
- **Still no live UI verification** after the UI refinement pass (same
  environment constraint as above) — the new Official Portrait avatar,
  wrapped Action Center text, and the reordered/widened priority table
  were verified via `tsc`/tests/`next build` only, not a live browser
  render. Recommended before this phase is considered fully done.

## Phase 42 UI refinement pass (presentation-only)

A follow-up pass refined the Dashboard's presentation layer only — no
Promotion/Age/Retirement/Service Intelligence calculation, business rule,
or architecture changed. Summary of what changed:

- **Action Center** — rows widened and the description text now always
  wraps (never clipped/ellipsized); the count badge moved to its own line
  so it never competes with the title for width.
- **Promotion Priority list**:
  - Photo column now shows the officer's real **Official Portrait**
    (`lib/server/officer_portrait_service.ts`'s `resolveOfficerPortraitsBatch`
    — the one sanctioned portrait resolver in the codebase), never a
    gallery thumbnail. Falls back to a neutral placeholder icon when no
    trusted portrait exists.
  - "ครบคุณสมบัติครั้งแรก" is now a compact cell: **1 October of the first
    eligible fiscal year** (`fiscalYearStart`, an existing, unmodified
    primitive — re-anchored from `PromotionSummary.eligibleFiscalYearBe`,
    which was already correct; only the DISPLAY date changed, not the
    underlying fiscal year) plus the fiscal year label underneath.
  - The verbose exact-duration column is replaced by **"ปีนี้เป็นปีที่ N"**
    — sourced directly from `PromotionSummary.overdueYears` (already
    computed by the Promotion Intelligence engine; not a new calculation).
  - The verbose cycle sentence is replaced by **"รอบที่ N"** — same
    underlying `promotionCyclesPassed` value, shorter label.
  - **Priority Score and Reason columns removed from the table** — the
    score already determined sort order (unchanged); both fields remain on
    `PromotionCandidateViewModel` for backward compatibility, just not
    rendered.
  - **New columns**: "อายุราชการ" (exact government-service duration, from
    Service Intelligence — `computeServiceSummary`, an existing, unmodified
    facade newly wired into `commander_query_service.ts`'s read model) and
    "ปีเกษียณอายุราชการ" (Buddhist-Era retirement year, from the existing
    `retirementYearBe` field already on `CommanderQueryOfficer`).
  - Table now fills the available width (`table-fixed` with percentage-based
    `colgroup` widths instead of a fixed `min-width`) and wraps long
    position/unit text naturally instead of clipping or forcing horizontal
    scroll.
- **`CommanderQueryOfficer` gains `displayServiceDurationTh`** (additive) —
  populated via the existing `lib/intelligence/service` facade, not a new
  calculation.
- **`PromotionCandidateViewModel` gains 9 new display fields**
  (`officialPortraitUrl`, `displayEligibleFirstCycleTh`,
  `displayEligibleFiscalYearTh`, `promotionYearOrdinal`,
  `displayPromotionCycleTh`, `displayServiceDurationTh`, `retirementYearBe`,
  `displayRetirementYearTh`) — all additive; `thumbnailUrl`,
  `displayEligibleSinceTh`, `displayEligibleDurationTh`, `priority`, and
  `priorityReason` are kept, unchanged, for backward compatibility.

## Commander Promotion UX refinement pass (presentation and terminology only)

A further follow-up pass refined column ORDER and WORDING on the Promotion
Priority list (this Dashboard) and rebuilt the Commander Search results
table — again, no Promotion/Age/Retirement/Service/Timeline Intelligence
calculation, priority formula, or eligibility rule changed. Every new or
changed display value reads directly from an already-computed field.

### Dashboard — "ผู้ควรได้รับการพิจารณาก่อน" column changes

Reordered to: รูป, ยศ ชื่อ-สกุล, ตำแหน่ง, หน่วย, ปีเกษียณอายุราชการ,
อายุราชการ, คุณสมบัติ, สถานะ, ปีนี้เป็นปีที่, ดำรงตำแหน่งระดับนี้มา, ดูประวัติ.

- **"คุณสมบัติ"** (new) answers "ครบขึ้นตำแหน่งอะไร" — e.g. "ครบขึ้น ผกก." —
  built from `PromotionSummary.targetPosition` (`displayTargetQualificationTh`
  on `PromotionCandidateViewModel`), never a generic "Eligible" label.
- **"สถานะ"** now shows `PromotionSummary.displayStatusTh` directly (the
  existing `PROMOTION_STATUS_DISPLAY_TH` mapping from
  `lib/intelligence/promotion`) as a Badge.
- **"ปีนี้เป็นปีที่"** shows ONLY the bare number
  (`promotionYearOrdinal`), sourced from `PromotionSummary.overdueYears` —
  never calculated from today's date; unchanged from the prior UI
  refinement pass, just repositioned in column order.
- **"ดำรงตำแหน่งระดับนี้มา"** (new, `displayYearsAtLevelTh`) replaces the
  "รอบที่ N" cycle-count column with whole years at the CURRENT position
  level (`yearsInPositionLevel`, an existing field on the Commander read
  model) — answers "อยู่ในระดับตำแหน่งนี้มาแล้วกี่ปี", explicitly NOT a
  promotion-cycle count. `displayPromotionCycleTh` (the old "รอบที่ N"
  field) is kept on the type for backward compatibility, just not rendered.
- Dropped from the table (kept on the type, unrendered, for backward
  compatibility): the first-eligible-date/fiscal-year cell
  (`displayEligibleFirstCycleTh`/`displayEligibleFiscalYearTh`) — superseded
  by "คุณสมบัติ"/"สถานะ" for the Dashboard's compact view. Commander
  Search's rebuilt table still shows the equivalent "ปีที่ครบครั้งแรก"
  column.

### Commander Search results table — full rebuild

`components/commander/results/commander_results_table.tsx` was rebuilt
around `promotionIntelligence` (`PromotionSummary`) instead of the older
`nextLevelEligibility`/decimal `ageYears` fields it previously rendered.
New column order: รูป, ยศ ชื่อ-สกุล, ตำแหน่ง, หน่วย, ระดับตำแหน่ง, อายุ,
ดำรงตำแหน่งนี้มาตั้งแต่ปี, จำนวนปีในระดับนี้, ระดับเป้าหมาย,
ปีที่ครบครั้งแรก, เกินกำหนด, สถานะ, ปีนี้เป็นปีที่, ดูประวัติ.

- **"อายุ"** now shows exact years+months ("40 ปี, 11 เดือน") via a new
  `CommanderQueryOfficer.displayAgeYearsMonthsTh` field, computed from Age
  Intelligence's `exactAge` (`lib/intelligence/age`, unmodified) — never
  the old decimal `.toFixed(1)` display.
- **"ดำรงตำแหน่งนี้มาตั้งแต่ปี"** (new,
  `CommanderQueryOfficer.positionLevelStartYearBe`) — the Buddhist-Era year
  the officer started their CURRENT position level, from Timeline
  Intelligence (the existing `positionLevelStart` computation in
  `commander_query_service.ts` — the earliest timeline row at the current
  level), explicitly NOT the appointment-cycle value.
- **"จำนวนปีในระดับนี้"** — the existing `yearsInPositionLevel` field,
  displayed as whole years; NOT a promotion-cycle count.
- **"ระดับเป้าหมาย"** — `PromotionSummary.targetPosition` directly.
- **"ปีที่ครบครั้งแรก"** — `PromotionSummary.eligibleFiscalYearBe`
  (Buddhist Era) — never the Gregorian year.
- **"เกินกำหนด"** — redefined to mean whole MISSED promotion
  opportunities, not the old appointment-cycle overdue count. Computed as
  `overdueYears - 1` (floored at null/0) via the new pure, tested helper
  `lib/commander_query/promotion_display.ts`'s `overdueOpportunities()` —
  a presentation-only reinterpretation of the already-computed
  `PromotionSummary.overdueYears` field, not a new eligibility
  calculation. Example: first eligible fiscal year 2568, current fiscal
  year 2569 → `overdueYears` is 2 (2569 is eligibility year 2) →
  `overdueOpportunities` returns 1 ("1 ปี").
- **"สถานะ"** — `PromotionSummary.displayStatusTh` as a Badge, with a new
  tone mapping (`STATUS_TONE`) keyed on `PromotionEligibilityStatus`
  (distinct from the old `EligibilityStatus`-keyed `ELIGIBILITY_META` this
  table previously used).
- **"ปีนี้เป็นปีที่"** — `PromotionSummary.overdueYears`, displayed as a
  bare number, same semantics as the Dashboard's equivalent column.
- The old cycle-oriented columns (appointment cycle, completed cycles,
  eligible-since-cycle, old eligible-overdue, `RetirementStatusBadge`,
  `PriorityBadge`, `nextLevelEligibility`-based target level) are no
  longer rendered by this table. `CommanderEligibilitySummary`/
  `nextLevelEligibility` themselves are UNCHANGED on `CommanderQueryOfficer`
  and still drive Commander Search's filters/presets/charts elsewhere on
  the page (`CommanderEligibilityCards`, `CommanderQueryBuilder`,
  `CommanderTimelineCharts`) — only this ONE table component stopped
  reading them for display.
- Column-header click-to-sort was removed from this table (the
  `sortBy`/`onSort`/`sortDirection` props); row order is still driven by
  `CommanderQueryCenter`'s existing `sortRows` state (default: priority,
  descending) — sorting behavior is unchanged, only the per-column sort
  toggle UI was dropped since the new column set no longer maps cleanly
  onto the old `CommanderSortField` union.

### Timeline interpretation (both tables)

Per the task's timeline rule, a position-level's tenure is read as:
year of entry = "ปีที่ 1" at that level, each subsequent year increments
(ปีที่ 2, ปีที่ 3, …), and the FIRST eligible fiscal year (1 October
anchor) is a distinct milestone from the tenure-year count — becoming
eligible in fiscal year 2568 is itself "ปีที่ 1" of ELIGIBILITY (not of
tenure), and fiscal year 2569 is "ปีที่ 2" of eligibility. This app already
computes both concepts correctly and separately:
`yearsInPositionLevel`/`positionLevelStartYearBe` for TENURE at the level,
and `PromotionSummary.overdueYears`/`eligibleFiscalYearBe` for ELIGIBILITY
duration — this refinement pass did not invent a third calculation; it
only exposed the existing eligibility-year number (`overdueYears`) and
existing tenure-year number (`yearsInPositionLevel`) as the correctly
labeled, separate columns the task requested.

### Horizontal scroll UX (both tables)

New `components/ui/dual_scroll_table.tsx` — NOT a new table library, a
thin scroll-UX wrapper around the existing plain `<table>` markup (columns,
cell content, sticky-column classes are still authored entirely by each
table component). Provides:

- A synchronized scrollbar ABOVE the table (mirroring the browser's native
  one below, from the wrapping `overflow-x-auto`), kept in sync via a
  reciprocal-scroll guard (`syncingFrom` ref) so neither scrollbar fights
  the other.
- Shift+MouseWheel horizontal scrolling on the table body (a `wheel`
  handler that redirects `deltaY` to `scrollLeft` only when Shift is held
  and the browser hasn't already produced a native `deltaX`).
- Click-and-drag ("grab"/"grabbing" cursor) horizontal scrolling, ignoring
  drags that start on a link/button/input so normal clicks still work.
- Both `DashboardPromotionPriority` and `CommanderResultsTable` mark their
  รูป/ยศ ชื่อ-สกุล columns `sticky left-0`/`sticky left-14` with a `bg-surface`
  backdrop, so they stay visible while scrolling horizontally — a
  lightweight CSS addition (`position: sticky`), not a new table library
  or virtualization dependency, since no sticky-column support existed in
  either table before this pass.
- Long position/unit/name text uses `whitespace-normal` + `wrap-break-word`
  (word-break) instead of the previous truncating/clipping behavior, and
  every data row uses `align-middle` vertical alignment — no overlapping
  text.
