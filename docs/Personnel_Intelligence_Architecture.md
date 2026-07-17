# Personnel Intelligence Architecture

**Phase 40A — Personnel Intelligence Platform Foundation**
**(extended by Phase 40B — Data Standardization & Thai Government Date Foundation; see the Phase 40B section below and `docs/THAI_DATE_AND_RETIREMENT_STANDARD.md`)**

## Purpose

BPPIS is moving from a Personnel *Database* to a Personnel *Intelligence
Platform*: a system that doesn't just store officer records, but helps
commanders make decisions (who is promotion-ready, who is retiring soon, who
is missing documents/training).

This phase lays the architectural foundation for that shift. It defines a
strict three-layer separation — **Master Data → Intelligence Engine →
Commander View** — and introduces the Intelligence Engine's public API
(`lib/intelligence/*`). It intentionally does **not** redesign the UI,
change styling, change business rules, or add new calculations. Existing
engines are not relocated or rewritten. This is a logical architecture
layered on top of stable, already-correct production code.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Commander View (pages/components)                           │
│  Dashboard · Commander Search · Officer Workspace · Stats    │
│  — reads intelligence objects, never calculates              │
└───────────────────────────▲───────────────────────────────────┘
                             │ OfficerIntelligence / summaries
┌───────────────────────────┴───────────────────────────────────┐
│ Intelligence Engine  (lib/intelligence/*)                     │
│  retirement/ · age/ · service/ · promotion/ · salary/ ·       │
│  document/ · shared/ (domain types + consolidated math)       │
│  — thin facades; compose EXISTING engines; no UI, no I/O      │
└───────────────────────────▲───────────────────────────────────┘
                             │ OfficerWithRelations / OfficerMasterData
┌───────────────────────────┴───────────────────────────────────┐
│ Master Data  (Prisma models via lib/database/*)                │
│  Officer, Timeline, SalaryHistory, OfficerDocument,            │
│  Education, Training, OfficerSkill — FACTS ONLY                │
│  never retirement age, promotion eligibility, years-in-        │
│  position, years-of-service, or a document score               │
└─────────────────────────────────────────────────────────────┘
```

### Design decision: thin facade, not physical migration

Existing, stable, already-tested engines are **not** moved or rewritten:

| Existing engine (unchanged location) | New facade |
|---|---|
| `lib/personnel_calendar/retirement.ts` | `lib/intelligence/retirement/` |
| `lib/personnel_calendar/calendar.ts` (`calculateAge`) | `lib/intelligence/age/` |
| `lib/officer_profile/career_calculator.ts` | `lib/intelligence/service/` |
| `lib/promotion/` + `lib/promotion_cycle/` (via `OfficerIntelligenceCard`) | `lib/intelligence/promotion/` |
| `lib/officer_profile/career_salary_engine.ts` | `lib/intelligence/salary/` |
| `lib/document/document_status.ts` | `lib/intelligence/document/` |

Each facade module composes/wraps the existing engine and returns one of the
shared domain types below. Application import paths outside `lib/intelligence`
were changed **only** where a real, confirmed duplication existed (see
"Duplication removed" below) — no unrelated call sites were touched.

## Domain Models (`lib/intelligence/shared/types.ts`)

- `IntelligenceSummaryBase` — every summary has `available: boolean`. A
  summary that cannot be computed (e.g. missing date of birth) returns
  `available: false`, never a silently-wrong zero.
- `RetirementSummary`, `AgeSummary`, `ServiceSummary`, `PromotionSummary`,
  `SalarySummary`, `DocumentSummary` — one shape per engine.
- `OfficerIntelligence` — the full per-officer bundle (all six summaries),
  the shape Commander View pages should ultimately consume.
- `OfficerMasterData` (`lib/intelligence/shared/master_data.ts`) — a pure,
  lossless **projection** of `OfficerWithRelations` containing only factual/
  persisted fields (identity, assignment, contact, personal information, and
  the raw relation arrays). `toOfficerMasterData()` performs the projection;
  it does not fetch or calculate anything.

## Data Flow

1. A server service (e.g. `commander_query_service.ts`,
   `commander_intelligence_service.ts`) loads `OfficerWithRelations` from
   Prisma (Master Data).
2. It calls one or more `lib/intelligence/*` facade functions, passing in
   master-data fields (`dateOfBirth`, `timeline`, `salaryHistory`,
   `documents`, …).
3. Each facade returns a typed summary (`RetirementSummary`,
   `ServiceSummary`, …) — pure computation, no I/O.
4. Commander View pages/components render the summary fields directly. They
   never re-derive a calculated value from master data themselves.

## Responsibilities

| Layer | May contain | Must never contain |
|---|---|---|
| Master Data | Persisted facts (Prisma models, `OfficerMasterData`) | Any calculated/derived value |
| Intelligence Engine | Pure calculation functions, one per concern, composing existing engines | UI code, React, fetches |
| Commander View | Rendering, layout, interaction | Business-rule calculation |

## Duplication removed (Task 1 audit finding)

The audit found ONE real, verbatim duplication — not in a UI component, but
between two server services:

- `lib/server/commander_query_service.ts`
- `lib/server/commander_intelligence_service.ts`

Both independently defined `firstServiceLikeDate`, and
`commander_query_service.ts` additionally defined `yearsFromDuration`,
`startedAtForMatchingTimeline`, `yearsSince`, and `monthsFromDuration`. These
are now consolidated in `lib/intelligence/shared/duration.ts` and
`lib/intelligence/shared/timeline_dates.ts`, and both services import the
shared versions. Behavior is unchanged — verified by the full existing test
suite (1165 tests, 0 failures) and a clean `tsc --noEmit`.

No other duplication of business logic inside React components was found —
`components/officer/officer_workspace.tsx` reads from already-computed
props/hooks, it does not calculate independently.

## Files added

```
lib/intelligence/shared/duration.ts        yearsFromDuration, yearsSince, monthsFromDuration
lib/intelligence/shared/timeline_dates.ts   firstServiceLikeDate, startedAtForMatchingTimeline
lib/intelligence/shared/types.ts            RetirementSummary, AgeSummary, ServiceSummary,
                                             PromotionSummary, SalarySummary, DocumentSummary,
                                             OfficerIntelligence
lib/intelligence/shared/master_data.ts      OfficerMasterData, toOfficerMasterData()
lib/intelligence/retirement/index.ts        computeRetirementSummary()
lib/intelligence/age/index.ts               computeAgeSummary()
lib/intelligence/service/index.ts           computeServiceSummary()
lib/intelligence/promotion/index.ts         computePromotionSummary()
lib/intelligence/salary/index.ts            computeSalarySummary()
lib/intelligence/document/index.ts          computeDocumentSummary()
docs/Personnel_Intelligence_Architecture.md this document
```

## Files modified

```
lib/server/commander_query_service.ts        removed 5 duplicated local helpers,
                                               now imports lib/intelligence/shared/*
lib/server/commander_intelligence_service.ts  removed 1 duplicated local helper,
                                               now imports lib/intelligence/shared/*
```

No page or component was modified in this phase — Task 4's full page
refactor (Dashboard/Commander Search/Officer Workspace/Statistics reading
`OfficerIntelligence` end-to-end) is scoped as the next phase's work, since
those pages currently consume `OfficerIntelligenceCard` /
`CommanderQueryOfficer` — types that already flow from the underlying
engines correctly today. Forcing a page-level rewire in this phase risked
the "no visual regression" acceptance criterion for no behavioral gain; the
facades above are ready for that migration to start.

## Future Engine Expansion

The folder structure supports adding engines without touching Commander
View code:

- **Training Engine** (`lib/intelligence/training/`) — not created yet; no
  dedicated training-completeness engine exists today (training presence is
  currently read directly, e.g. `officer.training.length > 0`).
- **Document Intelligence** — `lib/intelligence/document/` today reports
  active/verified/pending counts over the OPEN document-type set that
  actually exists in the schema. There is no fixed "required documents"
  list in the database; introducing one is future schema work, not a
  Phase 40A concern.
- **Salary Intelligence** — `lib/intelligence/salary/` currently exposes
  only the two-step ("2 ขั้น") eligibility rule that exists today.
  Broader salary-step forecasting is a future engine, not built here.
- **Promotion Engine — next-level eligibility** —
  `computePromotionSummary()` deliberately leaves `monthsUntilEligible`,
  `overdueYears`, and `targetLevel` as `null`. Computing them requires
  position-LEVEL classification (`lib/commander_query/position_level.ts`)
  and other Commander-Search-specific inputs assembled only in
  `commander_query_service.ts` today
  (`evaluateNextLevelEligibility`/`computeNextLevelEligibility`). Folding
  that into the generic facade — without duplicating Commander Search's
  assembly logic — is the natural next step once Commander Search itself
  migrates to consume `lib/intelligence/promotion/`.

## Risks

- **`Officer.careerYears` (stored column) vs. the Service Engine's live
  calculation** — the Prisma schema still has a stored
  `careerYears Int @default(0)` field on `Officer`, but the codebase
  already treats `calculateCareerYearsSimple(timeline, year)` (used by
  `lib/intelligence/service/`) as the real source of truth; the stored
  column appears to be a legacy/unused field. `OfficerMasterData`
  deliberately omits it so this facade layer doesn't re-legitimize a stale
  calculated value as "master data." This predates Phase 40A and is not
  fixed here — flagging it for a future data-model cleanup phase.
- **`lib/ui/profile_completeness.ts`** computes a derived value
  (`ProfileCompleteness`) but lives under `lib/ui/`, not `lib/intelligence/`
  — a naming/location inconsistency, not a behavior risk. **Technical
  debt, scheduled: migrate behind `lib/intelligence/document` during
  Phase 46, reusing the existing scoring logic without changing behavior**
  (see `docs/INTELLIGENCE_ROADMAP.md`, Document Intelligence). Not moved in
  this pass.
- **Two parallel promotion systems** (`lib/promotion/` rule-based scoring vs
  `lib/promotion_cycle/` B.E. appointment-cycle tracking) remain
  intentionally distinct, composed together only inside
  `OfficerIntelligenceCard`/`computeNextLevelEligibility`. A future engine
  consolidation should treat this as a design decision to preserve, not a
  duplication to merge blindly — they answer different questions
  (rule-based readiness vs. cycle-based overdue tracking).
- **No consumer of the new facades yet** — `lib/intelligence/{retirement,
  age,service,promotion,salary,document}` are exercised by the type system
  and the full test suite (indirectly, via the refactored services still
  passing), but have no dedicated unit tests of their own yet. Recommended
  before Task 4's page migration begins.
- **Multiple Thai date-formatter mechanisms still coexist** (`formatThaiDate`,
  `formatThaiPersonnelDate`, `formatLocalizedDate`, inline
  `toLocaleDateString("th-TH", ...)`, `Intl.DateTimeFormat` with
  `-u-ca-buddhist`). Phase 40B fixed only the confirmed hardcoded `±543`
  bypasses and one ungoverned call site in the files it touched — it did
  not attempt broad consolidation, and none is required in Phase 40B. See
  `docs/THAI_DATE_AND_RETIREMENT_STANDARD.md` §6.1/§12 for the canonical
  formatter rule and full limitation detail.

---

## Phase 40B — Data Standardization & Thai Government Date Foundation

Phase 40B strengthens the Age, Service, and Retirement Intelligence facades
introduced above with exact-duration (no decimal-year approximation),
Buddhist-Era display, and Thai fiscal-year support. Full detail — storage
policy, timezone convention, the timeline-selection rule for service-start,
the fiscal-year/retirement business rule, and migration guidance — lives in
**`docs/THAI_DATE_AND_RETIREMENT_STANDARD.md`**, the canonical reference for
all future date-handling.

Summary of what changed:

- **New shared date utilities** (`lib/intelligence/shared/`): `date_types.ts`
  (`ExactDuration` type alias, `ExactDurationResult`, `UnavailableDateReason`),
  `exact_duration.ts` (`computeExactDuration`, `formatExactDurationTh`,
  `formatExactDurationCompactTh`), `thai_date.ts` (`toBuddhistEraYear`,
  `formatFullThaiDateTh`, `formatShortThaiDateTh`, `formatBuddhistEraYearTh`,
  `formatCompactBuddhistEraYearTh`), `fiscal_year.ts`
  (`computeFiscalYearSummary`). All are thin wrappers over the pre-existing,
  already-correct `lib/personnel_calendar/*` primitives — no date-math
  primitive was reimplemented.
- **`AgeSummary`/`ServiceSummary`/`RetirementSummary` extended**, not
  replaced — every Phase 40A field (`ageYears`, `careerYears`,
  `governmentServiceYears`, `remainingYears`, `retirementFiscalYear`) is kept
  as a `@deprecated`-annotated compatibility field; the new exact-duration
  and Thai-display fields are additive.
- **`ServiceSummary` gains `serviceStartDate`/`sourceTimelineEntryId`** —
  the schema has no `serviceStartDate` column (confirmed, not fabricated);
  the timeline-selection rule (earliest dated Timeline row) is documented in
  both `lib/intelligence/service/index.ts`'s doc comment and the standard
  doc.
- **Confirmed hardcoded `±543` bypasses fixed** (6 sites) — all now route
  through `toBuddhistEraYear`/`yearGregorianToBE`/`yearBEToGregorian`.
- **`CommanderQueryOfficer.retirementYear` Gregorian-leak fixed** — an
  additive `retirementYearBe` field was added; `retirementTimeline` chart now
  displays the Buddhist-Era value while the Gregorian `retirementYear` is
  kept unchanged as the internal filter/drilldown-matching value (no filter
  behavior changed).
- **`personal_information_section.tsx`** now reads `computeAgeSummary`/
  `computeRetirementSummary` instead of the separate
  `calculateCurrentAge`/`calculateRetirementYearBE` entry points, replacing
  a whole-number-years display with the exact-duration Thai display (the
  "40.9 → 40 ปี 11 เดือน 6 วัน" pattern the phase targeted).

### Canonical Thai formatter rule (standards, binding going forward)

`lib/intelligence/shared/thai_date.ts` is the canonical, public Thai
date-display layer for all new Intelligence Engine and Commander View code.
All new user-facing Thai date and Buddhist Era formatting must use the
canonical shared formatter exposed through this file; new Thai/Buddhist Era
date-formatting logic must not be introduced in unrelated components,
services, or feature folders. Existing parallel formatters
(`formatThaiDate`, `formatThaiPersonnelDate`, `formatLocalizedDate`, inline
`toLocaleDateString("th-TH", ...)`) are classified as **legacy compatibility
formatters** — they may remain in place temporarily where already stable,
must not be copied or extended, and will be consolidated incrementally in a
future dedicated migration phase, preserving behavior exactly when that
happens. No broad formatter consolidation is required in Phase 40B. Full
detail: `docs/THAI_DATE_AND_RETIREMENT_STANDARD.md` §6.1 and §12.

See the Phase 40B deliverable report (delivered alongside this update) for
the full audit findings, file list, and test results.

---

## Phase 41 — Promotion Intelligence Engine

Phase 41 moves the Promotion Engine from "current promotion status" to
"promotion intelligence" — an answer that explains WHY an officer is
eligible/blocked, SINCE WHEN, and how urgently a commander should review
them. `lib/intelligence/promotion/index.ts`'s `computePromotionSummary` is
now the single source of truth every consumer (Commander Dashboard,
Commander Search, Officer Profile, AI Commander, Reports) should read.

### What existed before Phase 41 (audit finding)

Three independent, not-fully-reconciled "status" systems existed:
`PromotionStatus` (`eligible`/`near_eligible`/`not_eligible`/`unknown` —
score-ratio based, `lib/intelligence/flags.ts`), `EligibilityStatus`
(`eligible_now`/`eligible_soon`/`overdue`/`not_eligible` — tenure/temporal,
`lib/promotion/eligibility_policy.ts`), and `PromotionCycleBucket`
(7-value appointment-cycle bucket, `lib/promotion_cycle/`). They could
disagree for the same officer since the first never consulted the other
two. `lib/intelligence/promotion/index.ts`'s Phase 40A facade only ever
wrapped the first — `monthsUntilEligible`/`overdueYears`/`targetLevel` were
unconditionally `null`, because the facade never called
`evaluateNextLevelEligibility` at all. No first-eligible-date tracking
existed anywhere (confirmed by search — everything was computed as of
`asOf`/now, never a historical lookback).

### Business rules implemented

- **Status model** (`PromotionEligibilityStatus`, deliberately named
  distinctly from the pre-existing `PromotionStatus` in
  `lib/intelligence/types.ts` — the two are NOT interchangeable):
  `EligibleThisYear`, `AlreadyEligible`, `Waiting`, `MissingTraining`,
  `MissingDocuments`, `RetirementRestricted`, `NotEligible`, `Unknown`.
  Every value has Thai display text (`PROMOTION_STATUS_DISPLAY_TH`).
- **First eligible date**: derived from
  `lib/promotion_cycle/engine.ts`'s already-computed
  `eligibleCycle = appointmentCycle + requiredCycles` (a Buddhist-Era
  year), converted to a Gregorian date anchored to **1 January** of that
  year — never a fabricated day/month, since `Timeline.appointmentCycle`
  is a plain year integer with no finer granularity in the schema. This is
  the FIRST historical date the officer crossed into eligibility, not
  today and not merely "this year."
- **Years/months/days eligible**: exact calendar duration
  (`lib/intelligence/shared/exact_duration.ts`'s `computeExactDuration`,
  from `eligibleDate` to `asOf`) — never a decimal approximation.
- **Promotion cycles passed**: reuses
  `promotionCycle.completedPromotionCycles` — an explicitly documented
  **approximation** (one calendar year ≈ one appointment-cycle round; the
  schema does not record actual historical promotion-board rounds). Never
  presented as certain.
- **Priority score (0-100)**: weighted sum of years-already-eligible (up
  to 40 pts, capped at a 5-year wait), overdue years from the
  appointment-cycle engine (up to 25 pts), retirement proximity (up to 20
  pts, scaled over a 3-year horizon), minus a 10-point penalty each for a
  missing-training or missing-documents blocker (an actionable blocker
  should rank behind an equally-overdue but unblocked officer). `null`
  (not zero) when status is `Unknown` — nothing to prioritize. Returned
  alongside a human-readable `priorityReason` string. This is a starting
  policy, not a regulation — documented as retunable without touching
  callers.

### Promotion Model

`PromotionSummary` (`lib/intelligence/shared/types.ts`) — Phase 40A's
5 fields (`status`, `eligibleNow`, `monthsUntilEligible`, `overdueYears`,
`targetLevel`) are kept verbatim as `@deprecated`-annotated compatibility
fields, now actually populated (previously always `null`/stubbed). Phase
41 adds: `currentRank`, `currentPosition`, `targetRank`, `targetPosition`,
`promotionStatus` (the new `PromotionEligibilityStatus`), `eligibleDate`,
`eligibleFiscalYearBe`, `yearsEligible`/`monthsEligible`/`daysEligible`,
`promotionCyclesPassed`, `displayEligibleSinceTh`, `displayStatusTh`,
`priority`, `priorityReason`. No existing field was removed or renamed.

`CommanderQueryOfficer.promotionIntelligence: PromotionSummary` — a new,
additive field on the existing Commander read model
(`lib/commander_query/types.ts`), populated in
`lib/server/commander_query_service.ts`'s `toQueryOfficer`. The pre-existing
`nextLevelEligibility`/`promotionStatus`/`promotionCycleBucket`/
`eligibleCycle`/`overdueCycles` fields are all unchanged — this is the
richer engine output sitting alongside them, not a replacement.

### Known limitations (documented, not silently worked around)

- **`RetirementRestricted` is reachable in the type system but not
  producible from current data.** `lib/promotion/rules/
  retirement_window.ts` is a `"warning"`-severity rule; only
  `"blocking"`-severity rule failures populate
  `LevelEligibilityResult.missingRequirements` (see
  `lib/promotion/result.ts`'s `aggregatePromotionResults`), so a
  retirement-window failure cannot currently be distinguished from a
  generic `Waiting`/`NotEligible` outcome. No `PROMOTION_POLICIES` entry
  configures `minRetirementRemainingMonths` today, so this gap has no
  observable impact yet — flagged for whenever a policy does configure it.
- **`MissingTraining`/`MissingDocuments` are correctly wired but
  currently unreachable from default policy data** — no
  `PROMOTION_POLICIES` entry configures `requiredTrainingCodes`/
  `requiredDocumentCodes` today (confirmed by audit); the classification
  logic is verified correct (tested against synthetic policies indirectly
  via the `TRAINING_`/`DOCUMENT_` code-prefix check) but will not fire
  against production data until a policy adds these requirements.
- **`eligibleDate` precision is year-level, not day-level** — anchored to
  1 January of the eligible Gregorian year because
  `Timeline.appointmentCycle` carries no month/day. If finer-grained
  appointment-date tracking is ever added to the schema, this facade
  should be the first place updated.
- **`promotionCyclesPassed` is an approximation**, not a count of actual
  historical promotion-board rounds — see Business Rules above.
- **No dedicated UI consumes `promotionIntelligence` yet** — wiring
  Commander Search/Dashboard/Officer Profile to read from it (replacing
  ad hoc reads of `nextLevelEligibility`/`promotionStatus` where
  appropriate) is out of scope for Phase 41 (an Intelligence Engine
  phase, not a UI phase) and is the natural Phase 42 follow-up.

### Architecture Rule: Promotion Intelligence is the single source of truth

**`PromotionSummary` (`lib/intelligence/promotion/index.ts`'s
`computePromotionSummary`) is the single source of truth for promotion
eligibility.** This is binding, not advisory:

- Commander Dashboard, Commander Search, Officer Workspace, AI Commander,
  Reports, and any future service that needs to answer "is this officer
  eligible for promotion, and why" **must consume `PromotionSummary`**
  instead of implementing an independent promotion calculation.
- **New promotion calculation logic must not be introduced outside
  `lib/intelligence/promotion`.** A page or service that needs a
  promotion-related value it doesn't currently have should extend
  `PromotionSummary` (additively, preserving compatibility fields — see
  the Phase 40A/40B precedent throughout this document) rather than
  deriving that value locally from `lib/promotion`/`lib/promotion_cycle`
  directly.
- This does not mean `lib/promotion`/`lib/promotion_cycle` are
  off-limits — `computePromotionSummary` itself composes them, unchanged,
  per the thin-facade design decision above. The rule is about where a
  NEW consumer reaches: through the facade, never around it.
- Existing direct callers of `lib/promotion/eligibility_policy.ts` /
  `lib/promotion_cycle/` predating this rule (e.g.
  `lib/server/commander_query_service.ts`'s `nextLevelEligibility`) are
  not required to migrate immediately — see "No dedicated UI consumes
  `promotionIntelligence` yet" above — but any NEW code should reach for
  `PromotionSummary` first.

---

## Phase 42 — Commander Dashboard Intelligence

Phase 42 is the first consumer of `PromotionSummary` (Phase 41's single
source of truth) plus `AgeSummary`/`RetirementSummary` (Phase 40B) on the
Commander Dashboard — the exact "No dedicated UI consumes
`promotionIntelligence` yet" gap flagged above. Full detail — data flow,
KPI definitions, birthday/retirement rules, Action Center categories,
drill-down convention, and the Phase 46 plan — lives in
**`docs/COMMANDER_DASHBOARD_INTELLIGENCE.md`**, the Dashboard-specific
companion to this document.

Summary of what changed:

- **New pure composition layer**: `lib/commander_dashboard/{types,
  view_model}.ts` — `composeCommanderDashboardViewModel()` turns a list of
  officers (already carrying `PromotionSummary` fields) plus a
  deterministic `asOf` into the full `CommanderDashboardViewModel`. No
  I/O, no Prisma — calls `computeAgeSummary`/`computeRetirementSummary`
  (`lib/intelligence/{age,retirement}`) and reads `PromotionSummary`
  fields already computed upstream. Does not calculate promotion
  eligibility, age, retirement, or fiscal-year logic itself.
- **New server service**: `lib/server/commander_dashboard_service.ts`'s
  `getCommanderDashboardViewModel()` — loads the SAME dataset Commander
  Search already computes (`getCommanderQueryDataset()`), avoiding a
  second Prisma round-trip and a second promotion-eligibility computation.
- **`CommanderQueryOfficer` gains `dateOfBirth`** (additive) so the
  Dashboard service can compute Age/Retirement Intelligence from the
  already-loaded dataset.
- **Five new Dashboard components** (`components/intelligence/
  dashboard_{action_center,promotion_intelligence,promotion_priority,
  birthday_intelligence,retirement_awareness}.tsx`) — pure rendering over
  the already-computed view model; the Dashboard page composes them ahead
  of the pre-existing personnel-count section (now visually secondary,
  per the "generic totals must not dominate the page" rule) and the
  unchanged capability-intelligence section.
- **Minimal, additive drill-down plumbing** — Commander Search previously
  had ZERO URL-query-string awareness (confirmed by audit: filters were
  pure in-memory React state). Phase 42 adds `searchParams` reading on
  `app/commander-search/page.tsx` (seeding filter state once on mount via
  a new `initialFilters` prop) and two new `CommanderQueryFilters` fields
  (`promotionEligibilityStatus`, `retirementWithin`) — not a parallel
  filter system, and not an ongoing URL-sync feature (existing in-page
  filter changes remain pure client state, unchanged).
- **Document Expiry Intelligence is explicitly NOT implemented** — a
  single disabled, inert Action Center line reserves the integration
  point, using the same disabled/inert convention Commander Search's
  export buttons already established; full requirements are documented as
  the Phase 46 plan in `docs/COMMANDER_DASHBOARD_INTELLIGENCE.md` and
  `docs/INTELLIGENCE_ROADMAP.md`.

### Known limitation carried forward

No live browser verification was performed against a running,
authenticated session in this phase (environment constraint, not a scope
decision) — verification relied on `tsc --noEmit`, the full test suite,
and a successful `next build` (which type-checks and statically compiles
every route, including the Dashboard's Server Component data fetching).
See `docs/COMMANDER_DASHBOARD_INTELLIGENCE.md`'s Known Limitations section
for the full list.

## Phase 43 — Commander Search Intelligence, Table UX, and Official Portrait Consistency

Phase 43 is the first phase to batch-resolve Official Portraits inside
`getCommanderQueryDataset()` itself (`lib/server/commander_query_service.ts`)
rather than in a per-page service layer — `CommanderQueryOfficer` gains
`officialPortraitUrl`, resolved ONCE via the canonical resolver
(`resolveOfficerPortraitsBatch`) upstream of both Commander Search and
Commander Dashboard, so no future consumer of this dataset can regress onto
the unreliable legacy `thumbnailUrl`/`driveFileId` fields (now marked
`@deprecated` on the type). `commander_dashboard_service.ts` no longer
resolves portraits itself — it reads the value straight off the shared
dataset. A second portrait bug (Dashboard's Birthday Intelligence panel
reading the wrong field) was found and fixed in the same phase.

**Architecture rule (binding):** All officer avatars in operational and
Commander-facing pages must use the canonical Official Portrait resolver.
Feature components must not independently select images from gallery or
document media.

Commander Search itself gained a rebuilt 16-column results table, a
filtered-result-set Intelligence Summary, Thai-localized analytics charts, a
deterministic (non-LLM) Commander Insight sentence, and functional
Excel/Print export (PDF documented as future work). Full detail — data
flow, summary/filter/chart/export semantics, the five easily-confused
promotion-timing column concepts, and table-UX changes — lives in
**`docs/COMMANDER_SEARCH_INTELLIGENCE.md`**, the Commander-Search-specific
companion to this document (mirroring how Phase 42's Dashboard work has its
own companion doc). See that document for full details and known
limitations (PDF export not implemented, no live browser verification this
phase, Retirement Intelligence facade still unconsumed by
`commander_query_service.ts`).
