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

- **Purpose:** Whether an officer is promotion-ready now, and — for
  next-level appointment-cycle tracking — how far from eligible.
- **Master-data inputs:** `Officer.rank`, `Timeline[]` (for position-level
  history and appointment cycle), `Training[]`, `OfficerDocument[]`,
  `SalaryHistory[]` (two-step count), date of birth/retirement remaining.
- **Calculated outputs (current):** `status`, `eligibleNow`. Left `null`
  today: `monthsUntilEligible`, `overdueYears`, `targetLevel`.
- **Calculated outputs (planned):** the three `null` fields above, once
  folded in from `lib/promotion/eligibility_policy.ts`
  (`evaluateNextLevelEligibility`).
- **Dependencies:** `lib/promotion/` (rule-based scoring),
  `lib/promotion_cycle/` (B.E. appointment-cycle overdue tracking, kept
  intentionally distinct — see Architecture doc's Risks section),
  `lib/commander_query/position_level.ts` (position-level classification —
  currently Commander-Search-only).
- **Future commander KPIs:** promotion-ready roster per unit, overdue
  officers by cycle, projected promotion pipeline by rank.
- **Planned implementation phase:** Phase 40A delivered the facade at
  reduced scope (`lib/intelligence/promotion/`). Folding in
  `monthsUntilEligible`/`overdueYears`/`targetLevel` — which requires
  migrating position-level classification out of Commander Search first —
  is planned for **Phase 47**, alongside Commander Search's own migration
  onto this facade.

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

Statuses reflect the actual codebase as of Phase 40B — not aspirational.
"Foundation complete" means the facade + its currently-scoped calculations
are done and tested; it does NOT mean every field a future phase might want
is populated (see "Current scope" and "Next major step" for what's still
missing). No engine below is marked complete on the strength of its facade
existing alone — see each engine's own section above for the fields still
left `null`/unscoped.

| Intelligence Engine | Current status | Public facade | Current scope | Next major step |
|---|---|---|---|---|
| Age | Foundation complete | Yes (`lib/intelligence/age/`) | Exact age, next-birthday tracking, Thai display (Phase 40A + 40B) | UI integration — `profile_header.tsx` still shows whole-year age (Phase 40C) |
| Service | Foundation complete, with source limitations | Yes (`lib/intelligence/service/`) | Timeline-derived service-start (earliest dated row, no event-type field to refine further) + exact duration (Phase 40A + 40B); `yearsInPositionLevel` left `null` | Improve source classification if/when the schema gains an event-type field; UI integration — `profile_header.tsx` still shows whole-year career years (Phase 40C) |
| Retirement | Foundation complete | Yes (`lib/intelligence/retirement/`) | Retirement date, Buddhist-Era fiscal year, exact remaining duration, 2-October rollover rule verified (Phase 40A + 40B) | Commander dashboard integration (Phase 40C / 47) |
| Promotion | Existing production logic wrapped, partial | Yes (`lib/intelligence/promotion/`), reduced scope | `status`/`eligibleNow` only; `monthsUntilEligible`/`overdueYears`/`targetLevel` left `null` | Full next-level eligibility, folded in from `lib/promotion/eligibility_policy.ts` (Phase 47) |
| Salary | Existing production logic wrapped, partial | Yes (`lib/intelligence/salary/`) | Real two-step ("2 ขั้น") eligibility only — the one deterministic rule that exists today | Broader salary-step forecasting once a second business rule exists to wrap (unscheduled) |
| Training | Planned — no facade exists | No | No dedicated engine; training presence read directly (`officer.training.length > 0`) by callers such as `lib/intelligence/flags.ts` | Build Training Intelligence, gated on a prior product decision defining "required training" per rank/role (unscheduled) |
| Document | Existing production logic wrapped, partial | Yes (`lib/intelligence/document/`) | Real active/verified/pending document counts + portrait signal only — no required-documents checklist exists in the schema | Migrate `lib/ui/profile_completeness.ts`'s checklist logic behind this facade, reusing it as-is (Phase 46) |
| Commander | Existing production engine, not yet a dedicated facade | Existing architecture (`CommanderDashboard`/`CommanderQueryDataset`), built directly in `commander_query_service.ts`/`commander_intelligence_service.ts` | Flags, priority, recommendations, aggregation — all computed ad hoc per service today | Extract into `lib/intelligence/commander/`, consuming the strengthened per-officer facades (Phase 47) |
| AI Commander | Planned — no implementation | No | Not implemented in any form; `lib/intelligence/recommendations.ts`'s deterministic (non-AI) suggestions are the closest existing analogue | Build once Commander Intelligence (Phase 47) lands and an LLM-integration decision is made (unscheduled) |
