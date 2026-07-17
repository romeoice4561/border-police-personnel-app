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

- **Purpose:** Current age, in years, from date of birth — the base signal
  several other engines (retirement, eligibility rules) read.
- **Master-data inputs:** `Officer.dateOfBirth`.
- **Calculated outputs:** `age: DurationYMD`, `ageYears: number`.
- **Dependencies:** `lib/personnel_calendar` (`calculateAge`).
- **Future commander KPIs:** age-band distribution across a unit (e.g. "how
  many officers are 55+").
- **Planned implementation phase:** delivered (Phase 40A) —
  `lib/intelligence/age/`. No further work planned; this engine is stable
  and complete for its current scope.

## Service Intelligence

- **Purpose:** Years of service, in-rank, and in-position — the tenure
  signals commanders use to judge experience and eligibility.
- **Master-data inputs:** `Officer.rank`, `Officer.currentPosition`,
  `Officer.timeline[]` (the only factual source of service history — see
  `lib/intelligence/shared/master_data.ts`'s note on why there is no stored
  `serviceStartDate` field).
- **Calculated outputs:** `careerYears`, `yearsInRank`, `yearsInPosition`,
  `yearsInPositionLevel`, `governmentServiceYears`.
- **Dependencies:** `lib/officer_profile/career_calculator.ts`,
  `lib/personnel_calendar` (`calculateGovernmentServiceDuration`),
  `lib/intelligence/shared/timeline_dates.ts` (`firstServiceLikeDate`,
  `startedAtForMatchingTimeline`).
- **Future commander KPIs:** average tenure per unit, officers overdue for
  a position change, "stuck in position" flags.
- **Planned implementation phase:** delivered (Phase 40A) —
  `lib/intelligence/service/`, with `yearsInPositionLevel` intentionally
  left `null` (position-LEVEL classification is currently a Commander
  Search-only concern — see Promotion Intelligence below). Folding
  position-level classification into this engine is future work, not yet
  scheduled to a phase.

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

- **Purpose:** Retirement date, fiscal year, and remaining time — the
  primary "workforce planning" signal for commanders.
- **Master-data inputs:** `Officer.dateOfBirth`.
- **Calculated outputs:** `retirementAge`, `retirementFiscalYear`,
  `retirementDate`, `remaining`, `remainingYears`, `isRetired`.
- **Dependencies:** `lib/personnel_calendar/retirement.ts`
  (`calculateRetirement`, Thai government retirement age 60,
  fiscal-year-end anchored).
- **Future commander KPIs:** retirement wave forecasting (how many retire
  per fiscal year), succession-planning alerts for critical positions.
- **Planned implementation phase:** delivered (Phase 40A) —
  `lib/intelligence/retirement/`. No further work planned; this engine is
  stable and complete for its current scope.

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

| Engine | Status | Phase |
|---|---|---|
| Age Intelligence | Delivered | 40A |
| Service Intelligence | Delivered (position-level scope deferred) | 40A |
| Promotion Intelligence | Delivered (reduced scope) | 40A now, next-level eligibility in 47 |
| Retirement Intelligence | Delivered | 40A |
| Salary Intelligence | Delivered (real-data scope) | 40A |
| Document Intelligence | Delivered (real-data scope); checklist migration | 40A now, Phase 46 for profile_completeness migration |
| Training Intelligence | Not started | Unscheduled — needs product scoping |
| Commander Intelligence | Existing ad hoc logic, not yet a facade | Phase 47 |
| AI Commander Intelligence | Not started | Unscheduled — gated on Phase 47 + LLM decision |
