# Personnel Intelligence Architecture

**Phase 40A — Personnel Intelligence Platform Foundation**

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
