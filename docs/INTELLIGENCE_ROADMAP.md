# Intelligence Engine Roadmap

Planned engines for the Personnel Intelligence Platform (see
`docs/Personnel_Intelligence_Architecture.md` for the layer architecture
these engines live in). This document tracks what each engine is FOR, what
it will read, what it will produce, and when it is planned — it is a
planning document, not an implementation. Some engines below already have a
Phase 40A facade (`lib/intelligence/{age,service,promotion,retirement,
salary,document}`); this roadmap records their current scope and their
planned future growth in one place, plus the two engines that don't exist
yet at all (Training Intelligence, Commander Intelligence, AI Commander
Intelligence).

---

## Age Intelligence

- **Purpose:** Exact current age (years/months/days, never a decimal), plus
  next-birthday tracking — the base signal several other engines
  (retirement, eligibility rules) read.
- **Master-data inputs:** `Officer.dateOfBirth`.
- **Calculated outputs:** `exactAge: ExactDuration`, `displayAgeTh`,
  `nextBirthdayDate`, `nextBirthdayAge`, `daysUntilNextBirthday`,
  `displayNextBirthdayTh`. Compatibility fields `age`/`ageYears` kept from
  Phase 40A (decimal `ageYears` is deprecated as a display value).
- **Dependencies:** `lib/personnel_calendar` (`calculateAge`, `addYears`,
  `differenceYMD`), `lib/intelligence/shared/{exact_duration,thai_date}.ts`.
- **Future commander KPIs:** age-band distribution across a unit (e.g. "how
  many officers are 55+"), upcoming-birthday roster.
- **Planned implementation phase:** delivered (Phase 40A foundation, Phase
  40B strengthened with exact duration + next-birthday tracking + Thai
  display). The facade itself needs no further work; see the UI-integration
  follow-up below for a known consumer that has not yet adopted it.
- **Known follow-up (not Promotion-related):**
  `components/officer/profile_header.tsx` still displays age as a
  whole-year summary (`calculateCurrentAge` + `${currentAge} ปี / years`),
  not the `ExactDuration`-backed `displayAgeTh`. This is **not currently
  incorrect** — a whole-year age is a valid, honest value — it simply
  predates the Phase 40B facade and was intentionally left unchanged during
  Phase 40B (see "no broad UI rewrite" scope constraint). Replace this
  presentation with `computeAgeSummary(...).displayAgeTh` during **Phase
  40C — Intelligence Facade UI Integration** (or whichever phase becomes
  the next dedicated Commander/Officer UI integration phase, if 40C is
  renumbered). Do not change behavior outside that phase.

## Service Intelligence

- **Purpose:** Exact years/months/days of service, in-rank, and in-position
  — the tenure signals commanders use to judge experience and eligibility.
- **Master-data inputs:** `Officer.rank`, `Officer.currentPosition`,
  `Officer.timeline[]` (the only factual source of service history — see
  `lib/intelligence/shared/master_data.ts`'s note on why there is no stored
  `serviceStartDate` field, and `docs/THAI_DATE_AND_RETIREMENT_STANDARD.md`
  §5 for the documented timeline-selection rule: earliest dated Timeline
  row wins, no event-type field exists to special-case a "hire" row).
- **Calculated outputs:** `exactServiceDuration: ExactDuration`,
  `displayServiceDurationTh`, `serviceStartDate`, `sourceTimelineEntryId`
  (Phase 40B); `yearsInRank`, `yearsInPosition`, `yearsInPositionLevel`.
  Compatibility fields `careerYears`/`governmentServiceYears`/`serviceYears`
  (decimal) kept from Phase 40A.
- **Dependencies:** `lib/officer_profile/career_calculator.ts`,
  `lib/personnel_calendar` (`calculateGovernmentServiceDuration`),
  `lib/intelligence/shared/timeline_dates.ts` (`firstServiceLikeDate`,
  `startedAtForMatchingTimeline`),
  `lib/intelligence/shared/exact_duration.ts`.
- **Future commander KPIs:** average tenure per unit, officers overdue for
  a position change, "stuck in position" flags.
- **Planned implementation phase:** delivered (Phase 40A foundation, Phase
  40B strengthened with exact duration + explicit service-start
  traceability), with `yearsInPositionLevel` intentionally left `null`
  (position-LEVEL classification is currently a Commander Search-only
  concern — see Promotion Intelligence below). Folding position-level
  classification into this engine is future work, not yet scheduled to a
  phase.
- **Known follow-up (not Promotion-related):**
  `components/officer/profile_header.tsx` still displays Career Years as a
  whole-year summary (`calculateCareerYearsSimple` + `${careerYears} ปี /
  years`), not the `ExactDuration`-backed `displayServiceDurationTh`. Same
  status as the Age Intelligence follow-up above: not currently incorrect,
  intentionally left unchanged during Phase 40B, to be replaced with
  `computeServiceSummary(...).displayServiceDurationTh` during **Phase
  40C — Intelligence Facade UI Integration** (or the next dedicated
  Commander/Officer UI integration phase). Do not change behavior outside
  that phase.

## Promotion Intelligence

- **Purpose:** Not just "is this officer promotion-ready" but WHY —
  expanded status, the first historical date they became eligible, exact
  eligible duration, an approximate promotion-cycles-passed count, Thai
  display text, and a 0-100 commander priority score.
- **Master-data inputs:** `Officer.rank`, `Timeline[]` (for position-level
  history and appointment cycle), `Training[]`, `OfficerDocument[]`,
  `SalaryHistory[]` (two-step count), date of birth/retirement remaining.
- **Calculated outputs (delivered, Phase 41):** `promotionStatus`
  (`PromotionEligibilityStatus`: `EligibleThisYear`/`AlreadyEligible`/
  `Waiting`/`MissingTraining`/`MissingDocuments`/`RetirementRestricted`/
  `NotEligible`/`Unknown`), `eligibleDate`, `eligibleFiscalYearBe`,
  `yearsEligible`/`monthsEligible`/`daysEligible` (exact, never decimal),
  `promotionCyclesPassed` (documented approximation), `displayEligibleSinceTh`,
  `displayStatusTh`, `priority` (0-100), `priorityReason`. Phase 40A's
  `status`/`eligibleNow`/`monthsUntilEligible`/`overdueYears`/`targetLevel`
  are kept as compatibility fields, now actually populated (previously
  always `null`).
- **Dependencies:** `lib/promotion/eligibility_policy.ts`
  (`evaluateNextLevelEligibility` — policy-driven tenure/rule eligibility
  for the officer's next position level), `lib/promotion_cycle/`
  (Buddhist-Era appointment-cycle bucketing, kept intentionally distinct —
  see Architecture doc's Risks section), `lib/commander_query/
  position_level.ts` (position-level classification),
  `lib/intelligence/shared/{exact_duration,thai_date}.ts` (Phase 40B's
  exact-duration/Buddhist-Era display primitives, reused not reimplemented).
- **Future commander KPIs:** promotion-ready roster per unit (filterable by
  `promotionStatus`), longest-waiting officers (sortable by
  `yearsEligible`), overdue officers by cycle, officers blocked by
  training/documents, officers who will retire before promotion, ranked
  priority queue (sortable by `priority`) — all directly answerable from
  `PromotionSummary` without additional computation.
- **Known limitations:** `RetirementRestricted` is reachable in the type
  system but not producible from today's policy data — the
  retirement-window rule is `"warning"`-severity and never populates
  `missingRequirements`, and no policy configures
  `minRetirementRemainingMonths` yet. `MissingTraining`/`MissingDocuments`
  classification is correct but currently unreachable from default policy
  data (no policy configures `requiredTrainingCodes`/
  `requiredDocumentCodes` yet). `eligibleDate` is year-precision only
  (anchored to 1 January), since `Timeline.appointmentCycle` has no
  month/day. See `docs/Personnel_Intelligence_Architecture.md`'s Phase 41
  section for full detail.
- **Planned implementation phase:** delivered (Phase 41) —
  `lib/intelligence/promotion/`, wired into
  `lib/server/commander_query_service.ts` as
  `CommanderQueryOfficer.promotionIntelligence`. **Phase 42 wired the
  Commander Dashboard onto it** (Promotion Intelligence KPI cards, the
  Promotion Priority list — see `docs/COMMANDER_DASHBOARD_INTELLIGENCE.md`);
  Commander Search and Officer Profile still read the OLDER coarse
  `promotionStatus`/`nextLevelEligibility` fields for their primary UI
  (Commander Search gained a NEW `promotionEligibilityStatus` filter for
  Dashboard drill-down links, but its cards/table were not redesigned onto
  `PromotionSummary`). Migrating those two remaining consumers, and
  resolving the training/documents/retirement policy-data gaps above if
  product wants those statuses to actually fire, remain open follow-ups.

### Priority Score policy (conceptual)

`PromotionSummary.priority` is a 0-100 score meant to answer "who should a
commander look at first," summarized conceptually rather than as an
implementation spec (the exact weights live in
`lib/intelligence/promotion/index.ts` and are documented there):

| Range | Meaning |
|---|---|
| **100** | Highest priority |
| **80–99** | Eligible and waiting for multiple cycles |
| **60–79** | Eligible |
| **40–59** | Blocked by missing requirements |
| **0–39** | Not yet eligible |

**These ranges are guidance, not a fixed contract.** They describe the
INTENT of the scoring — long-waiting and overdue officers should score
high, officers blocked by a fixable gap (training/documents) should score
lower than an equally-overdue but unblocked officer, and an officer who
isn't eligible yet should score low — not an exact formula. The underlying
weights are a starting policy, explicitly documented as retunable without
touching any caller (every consumer reads the resulting `priority` number
and `priorityReason` string, never the weights themselves). As promotion
policy evolves — new requirement kinds, different urgency weighting,
commander feedback on what "priority" should mean in practice — these
ranges and the scoring behind them may change. A `priority` of `null`
means "nothing to prioritize" (status `Unknown`), never a score of 0.

## Retirement Intelligence

- **Purpose:** Retirement date, Buddhist-Era fiscal year, and exact
  remaining time — the primary "workforce planning" signal for commanders.
- **Master-data inputs:** `Officer.dateOfBirth`.
- **Calculated outputs:** `retirementAge`, `retirementFiscalYearBe`,
  `retirementDate`, `exactRemainingDuration`, `remainingDays`, `isRetired`,
  `displayRetirementDateTh`, `displayRetirementYearTh`,
  `displayRemainingTh` (Phase 40B). Compatibility fields
  `retirementFiscalYear`/`remainingYears` (both deprecated for display) kept
  from Phase 40A.
- **Dependencies:** `lib/personnel_calendar/retirement.ts`
  (`calculateRetirement`, Thai government retirement age 60,
  fiscal-year-end anchored — already correctly implements the "born 1+
  October retires in the following fiscal year" rule, verified and tested
  at both the primitive and facade layers),
  `lib/intelligence/shared/{exact_duration,thai_date}.ts`.
- **Future commander KPIs:** retirement wave forecasting (how many retire
  per fiscal year), succession-planning alerts for critical positions.
- **Planned implementation phase:** delivered (Phase 40A foundation, Phase
  40B strengthened with exact remaining duration + Buddhist-Era display
  text) — `lib/intelligence/retirement/`. No further work planned; this
  engine is stable and complete for its current scope. See
  `docs/THAI_DATE_AND_RETIREMENT_STANDARD.md` for the full business rule
  and the 2 October edge-case test.

## Salary Intelligence

- **Purpose:** Two-step ("2 ขั้น") salary-step eligibility — the one
  deterministic salary business rule that exists today.
- **Master-data inputs:** `Officer.salaryHistory[]` (yearBE + salaryStep
  per year).
- **Calculated outputs:** `twoStepCount`, `eligibleTwoStep`,
  `mustSkipStep`.
- **Dependencies:** `lib/officer_profile/career_salary_engine.ts`
  (`evaluateTwoStepEligibility`, `countTwoStep`).
- **Future commander KPIs:** two-step eligibility roster per cycle, salary
  progression forecasting.
- **Planned implementation phase:** delivered (Phase 40A) at real-data
  scope — `lib/intelligence/salary/`. Broader salary-step forecasting
  (beyond the existing two-step rule) is unscheduled; no phase assigned
  until a second salary business rule actually exists to wrap.

## Training Intelligence

- **Purpose:** Training completeness and gaps against role/rank
  requirements — does not exist yet as a dedicated engine. Training
  presence is currently read directly (`officer.training.length > 0`) by
  consumers such as `lib/intelligence/flags.ts`'s `missingTraining`.
- **Master-data inputs:** `Officer.training[]` (course rows).
- **Calculated outputs (planned):** completeness against a required-course
  set (once one is defined — no such set exists in the schema today, the
  same situation Document Intelligence is in), overdue/expiring
  certifications (if an expiry concept is ever added to `Training`).
- **Dependencies (planned):** none yet — this engine has no existing
  implementation to wrap, unlike every other engine in this roadmap.
- **Future commander KPIs:** training-gap roster per unit, certification
  expiry alerts.
- **Planned implementation phase:** unscheduled. Requires a prior
  data-model decision (what counts as "required training" per rank/role)
  before any engine work can start — flagged for product scoping, not a
  Phase 40A/46/47 engineering task.

## Document Intelligence

- **Purpose:** Document vault completeness signal — active/verified/pending
  counts over an officer's uploaded documents.
- **Master-data inputs:** `Officer.documents[]` (`documentType`,
  `isActive`, `verifiedAt`), Official Portrait signal
  (`officialPortraitId`/`thumbnailUrl`/`driveFileId`).
- **Calculated outputs:** `activeCount`, `verifiedCount`, `pendingCount`,
  `hasGp7`, `hasOfficialPortrait`, `activeDocumentTypes`.
- **Dependencies:** `lib/document/document_status.ts` (`documentStatus`).
- **Future commander KPIs:** document-completeness roster per unit,
  verification backlog (pending count trend).
- **Planned implementation phase:** delivered (Phase 40A) at real-data
  scope — `lib/intelligence/document/`. A true "required documents
  checklist" concept (`totalRequired`/`missingCount` against a defined
  required set) is **explicitly not implemented** — the schema has no
  required-documents model. Migrating the existing checklist-shaped logic
  in `lib/ui/profile_completeness.ts` behind this facade (see Technical
  Debt below) is planned for **Phase 46**, without adding a new
  required-documents concept — it will reuse the existing completeness
  scoring, relocated, not redesigned.

## Document & Expiry Intelligence (Phase 46 — planning only, not started)

- **Purpose:** Tracks EXPIRING documents — National ID
  (บัตรประจำตัวประชาชน), Driver License (ใบอนุญาตขับขี่), Insurance Policy
  (ประกันภัยรถยนต์), Compulsory/Motor Insurance (พ.ร.บ. รถยนต์), Vehicle
  Tax (ภาษีรถยนต์), Passport, and other expiring types — with a dynamic
  countdown to expiry (never stored) and explicit Expiring Soon/Expired
  statuses. A distinct concern from the existing Document Intelligence
  engine above (which reports vault completeness/verification status, not
  expiry dates). Requested during Phase 42 and refined during its UI
  refinement pass; explicitly NOT implemented in either — see
  `docs/COMMANDER_DASHBOARD_INTELLIGENCE.md`'s Phase 46 plan for the full
  requirement list.
- **Master-data inputs (planned):** a NEW document-expiry data model — not
  the existing `OfficerDocument` table, which has no issue/expiry date
  fields today. Requires a schema addition (issue date, expiry date, a
  category code) — explicitly out of scope for Phase 42, not created.
- **Calculated outputs (planned):** expiry status (normal / expiring soon
  / urgent / expired — an explicit enum, not inferred ad hoc at the UI
  layer, following the `PromotionEligibilityStatus`/`RetirementSummary`
  precedent), a countdown to expiry. **The countdown must be calculated
  dynamically at read time and never stored** — mirroring every other
  duration in this codebase (retirement remaining, promotion eligible-
  duration, age), so it can never drift from its source date.
- **Dependencies (planned):** a NEW `lib/intelligence/document_expiry/`
  (or similar) facade; configurable reminder thresholds as policy DATA
  (following `PROMOTION_POLICIES`'s precedent in
  `lib/promotion/eligibility_policy.ts` — tunable numbers in one table,
  never scattered magic numbers); the existing
  `components/ui/thai_date_picker.tsx` for issue/expiry date entry (reused,
  not rebuilt).
- **Future commander KPIs:** officer-level expiry cards (Officer Profile),
  a commander-level summary with filtered drill-down (Commander Dashboard
  — Phase 42 reserved a disabled placeholder line for this, see
  `docs/COMMANDER_DASHBOARD_INTELLIGENCE.md`), and — explicitly future,
  NOT Phase 46 engine/UI work — LINE/Telegram/in-app notification trigger
  points.
- **Planned implementation phase:** **Phase 46**. Nothing beyond this
  planning entry and one disabled Action Center line exists yet.

## Commander Intelligence

- **Purpose:** Aggregates every officer's per-engine summaries into
  unit/roster-level views — the layer Dashboard, Commander Search, and
  Statistics are meant to consume instead of assembling their own ad-hoc
  aggregates.
- **Master-data inputs:** none directly — reads only the outputs of the
  other engines (`OfficerIntelligence` bundles) plus organization structure
  (`lib/organization/`) for grouping.
- **Calculated outputs (existing):** `lib/intelligence/types.ts`'s
  `CommanderDashboard`/`CommanderDashboardSummary` and
  `lib/commander_query/types.ts`'s `CommanderQueryDataset` already provide
  this today, built directly in `commander_query_service.ts` /
  `commander_intelligence_service.ts` rather than via a dedicated
  `lib/intelligence/commander/` facade.
- **Dependencies:** every other engine's summary type
  (`RetirementSummary`, `ServiceSummary`, `PromotionSummary`,
  `SalarySummary`, `DocumentSummary`), `lib/organization/`.
- **Future commander KPIs:** unit-level rollups (average tenure,
  promotion-ready %, retirement wave size, document-completeness %) —
  today computed ad hoc per page; the goal is one shared aggregation layer.
- **Planned implementation phase:** **Phase 47**, as the natural
  continuation of migrating `commander_query_service.ts` /
  `commander_intelligence_service.ts` onto the per-officer facades — once
  individual officers read from `lib/intelligence/*`, the aggregation logic
  those two services already contain can be extracted into
  `lib/intelligence/commander/` without behavior change.
- **Phase 42 partial, Dashboard-scoped delivery:** `lib/commander_dashboard/
  {types,view_model}.ts`'s `composeCommanderDashboardViewModel` is a
  Dashboard-SPECIFIC aggregation (promotion/birthday/retirement/action-
  center view models), built on top of `PromotionSummary`/`AgeSummary`/
  `RetirementSummary`. It is deliberately NOT the general-purpose
  `lib/intelligence/commander/` facade this section plans for Phase 47 —
  it composes Dashboard-shaped view models, not the reusable
  `CommanderDashboard`/`CommanderDashboardSummary` aggregate every
  Commander View page would share. Phase 47 should evaluate whether
  `lib/commander_dashboard/`'s composition logic can be generalized into
  the Phase 47 facade, or should remain a thin Dashboard-only layer on top
  of it — a decision, not yet made. See
  `docs/COMMANDER_DASHBOARD_INTELLIGENCE.md`.

## Phase 43 — Commander Search Intelligence, Table UX, and Official Portrait Consistency

Closes two long-standing gaps flagged in earlier phases of this roadmap:
the Official Portrait resolver was wired into Commander Dashboard (Phase
42) but not Commander Search, and Commander Search's results table was
missing 2 of the now-16 spec columns. Both are fixed at the shared read
model (`getCommanderQueryDataset()`), not per-page — see
`docs/COMMANDER_SEARCH_INTELLIGENCE.md` for full detail. Commander Search
also gained a filtered-result Intelligence Summary, Thai-localized charts
(previously leaking raw English cycle-bucket labels), a deterministic
Commander Insight sentence, and functional Excel/Print export (CSV, RFC
4180 + UTF-8 BOM — PDF remains unscheduled).

## Phase 44 — Officer Intelligence Workspace

Brings Age/Service/Promotion/Retirement/Commander Intelligence and the
canonical Official Portrait resolver into the individual Officer Profile —
the same trusted outputs Commander Search/Dashboard already consume, now
also on the single-officer page. Closes the last "facade built but not yet
wired into the Officer Workspace" gap for Retirement Intelligence. See
`docs/OFFICER_INTELLIGENCE_WORKSPACE.md` for full detail. Two pure
compositions (`toQueryOfficer`, `buildOfficerProfileIntelligence`) were
extracted from behind `server-only` guards into new, testable modules
(`lib/commander_query/query_officer.ts`,
`lib/intelligence/officer_intelligence_input.ts`) so the same calculation
could be reused by both Commander Search's dataset builder and the new
Officer Intelligence View Model — no calculation duplicated, no behavior
changed for existing callers.

## AI Commander Intelligence

- **Purpose:** AI-assisted narrative/recommendation layer on top of
  Commander Intelligence — e.g. natural-language summaries of a unit's
  readiness, suggested promotion/training priorities. Does not exist in any
  form today; `lib/intelligence/recommendations.ts` currently generates
  deterministic (non-AI) suggestions from `OfficerIntelligenceInput`, which
  this future engine would extend, not replace.
- **Master-data inputs:** none directly — consumes Commander Intelligence
  output.
- **Calculated outputs (planned):** narrative summaries, ranked
  recommendations, anomaly/outlier flags a human might miss.
- **Dependencies (planned):** Commander Intelligence (must exist first),
  an LLM integration (none exists in this codebase today).
- **Future commander KPIs:** "what should I look at today" digest,
  proactive risk flags (e.g. a unit trending toward a retirement cliff).
- **Planned implementation phase:** unscheduled — explicitly gated on
  Commander Intelligence (Phase 47) landing first, and on a product
  decision about LLM integration that has not been made. Not committed to
  any numbered phase yet.

---

## Summary table

Statuses reflect the actual codebase as of Phase 42 — not aspirational.
"Foundation complete" means the facade + its currently-scoped calculations
are done and tested; it does NOT mean every field a future phase might want
is populated (see "Current scope" and "Next major step" for what's still
missing). No engine below is marked complete on the strength of its facade
existing alone — see each engine's own section above for the fields still
left `null`/unscoped.

| Intelligence Engine | Current status | Public facade | Current scope | Next major step |
|---|---|---|---|---|
| Age | Foundation complete | Yes (`lib/intelligence/age/`) | Exact age, next-birthday tracking, Thai display (Phase 40A + 40B); now feeds Commander Dashboard's Birthday Intelligence (Phase 42) | UI integration — `profile_header.tsx` still shows whole-year age (Phase 40C) |
| Service | Foundation complete, with source limitations | Yes (`lib/intelligence/service/`) | Timeline-derived service-start (earliest dated row, no event-type field to refine further) + exact duration (Phase 40A + 40B); `yearsInPositionLevel` left `null` | Improve source classification if/when the schema gains an event-type field; UI integration — `profile_header.tsx` still shows whole-year career years (Phase 40C) |
| Retirement | Foundation complete | Yes (`lib/intelligence/retirement/`) | Retirement date, Buddhist-Era fiscal year, exact remaining duration, 2-October rollover rule verified (Phase 40A + 40B); feeds Commander Dashboard's Retirement Awareness (Phase 42) and, as of Phase 44, the Officer Workspace's Retirement Intelligence card | Full retirement analytics page still unbuilt; `commander_query_service.ts`'s own dataset still bypasses this facade for `retirementYearBe` (uses `calculateRetirement` directly) |
| Promotion | Foundation complete, policy-data gaps | Yes (`lib/intelligence/promotion/`) | Full WHY-explaining status, first eligible date, exact eligible duration, priority score (Phase 41); now feeds Commander Dashboard's Promotion Intelligence KPIs + Priority list (Phase 42); `MissingTraining`/`MissingDocuments`/`RetirementRestricted` correctly wired but unreachable until a policy configures those requirements | Migrate Commander Search and Officer Profile off the older coarse `promotionStatus` onto `PromotionSummary`; configure training/document/retirement-window policy data if product wants those statuses to fire |
| Salary | Existing production logic wrapped, partial | Yes (`lib/intelligence/salary/`) | Real two-step ("2 ขั้น") eligibility only — the one deterministic rule that exists today | Broader salary-step forecasting once a second business rule exists to wrap (unscheduled) |
| Training | Planned — no facade exists | No | No dedicated engine; training presence read directly (`officer.training.length > 0`) by callers such as `lib/intelligence/flags.ts` | Build Training Intelligence, gated on a prior product decision defining "required training" per rank/role (unscheduled) |
| Document | Existing production logic wrapped, partial | Yes (`lib/intelligence/document/`) | Real active/verified/pending document counts + portrait signal only — no required-documents checklist exists in the schema | Migrate `lib/ui/profile_completeness.ts`'s checklist logic behind this facade, reusing it as-is (Phase 46) |
| Document & Expiry | Planned — no facade exists | No | Not implemented; Commander Dashboard reserves one disabled Action Center line as an integration point (Phase 42) | Full implementation — schema, engine, UI — in **Phase 46** |
| Commander | Existing production engine, not yet a dedicated facade | Existing architecture (`CommanderDashboard`/`CommanderQueryDataset`); Phase 42 adds a Dashboard-SPECIFIC (not general-purpose) composition layer, `lib/commander_dashboard/` | Flags, priority, recommendations, aggregation — mostly computed ad hoc per service; Dashboard's promotion/birthday/retirement/action-center view models now composed via `lib/commander_dashboard/view_model.ts`; Phase 43 adds batch Official Portrait resolution to `getCommanderQueryDataset()` itself (shared by both Dashboard and Search) plus a rebuilt 16-column Commander Search results table | Extract a general-purpose `lib/intelligence/commander/`, consuming the strengthened per-officer facades, and decide whether `lib/commander_dashboard/` folds into it (Phase 47) |
| AI Commander | Planned — no implementation | No | Not implemented in any form; `lib/intelligence/recommendations.ts`'s deterministic (non-AI) suggestions are the closest existing analogue | Build once Commander Intelligence (Phase 47) lands and an LLM-integration decision is made (unscheduled) |
