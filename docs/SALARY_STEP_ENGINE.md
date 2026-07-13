# Salary Step Intelligence Engine

## Purpose

The Salary Step Intelligence Engine is a commander decision-support library for annual salary-step consideration. It is not payroll and does not calculate salary amounts.

The engine answers questions such as:

- Who is eligible for double-step consideration?
- Who must skip a cycle under configured policy?
- Who has missing salary-step history?
- Who exceeded configured policy limits?
- Who needs commander review?

## Architecture

Location: `lib/salary_step/`

- `types.ts` defines the history model, rule contracts, context, and result shape.
- `history.ts` contains reusable history helpers for fiscal years, review cycles, recent cycles, and total steps.
- `engine.ts` executes independent rules and returns a structured result.
- `result.ts` aggregates rule outcomes into eligibility, warnings, missing history, suggested actions, and commander notes.
- `rules/registry.ts` provides pluggable rule registration.
- `rules/*` contains configurable example rule factories.
- `summary.ts` prepares dashboard summary counts.
- `commander_filters.ts` prepares Commander Query integration filters.
- `recommendations.ts` converts structured results into commander-facing action text.

## History Model

Each `SalaryStepHistoryRecord` supports:

- `fiscalYear`
- `reviewCycle`, for example `APRIL` or `OCTOBER`
- `stepsAwarded`, for example `0`, `0.5`, `1`, `1.5`, `2`
- `awardType`, for example `NORMAL`, `DOUBLE_STEP`, `DEFERRED`, `SKIPPED`, `COMMANDER_OVERRIDE`
- optional `remarks`

Existing annual `SalaryHistory` rows can be adapted with `adaptAnnualSalaryHistory()`. This is additive and does not require schema changes.

## Rule Flow

1. Build `SalaryStepEvaluationContext`.
2. Register configured rules with `createSalaryStepRuleRegistry()`.
3. Execute `evaluateSalaryStepIntelligence()`.
4. Aggregate outcomes into:
   - eligibility status
   - total steps
   - recent history
   - missing history
   - warnings
   - suggested actions
   - commander notes

## Pluggable Rules

The engine ships configurable example rules:

- `createDoubleStepCandidateRule()`
- `createMustSkipRule()`
- `createMaximumStepsRule()`
- `createMissingSalaryHistoryRule()`
- `createManualReviewRule()`

These are examples, not hardcoded Thai Police regulations. Future regulations should be added as new rule files and registered through the registry.

## Commander Integration

`commander_filters.ts` provides reusable filters for:

- eligible double step
- must skip
- manual review
- missing salary history
- fewer than X salary steps
- more than X salary steps

`summary.ts` provides dashboard counts for eligible double step, must skip, manual review, missing records, and average salary steps.

## Design Notes

- Pure TypeScript only.
- No React.
- No database calls.
- No payroll calculations.
- No hardcoded regulations.
- Reuses Personnel Calendar fiscal year helpers and accepts Commander Intelligence output as context.
