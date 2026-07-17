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
