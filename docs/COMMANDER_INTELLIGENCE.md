# Commander Intelligence Engine

The Commander Intelligence Engine summarizes officer readiness without requiring commanders to inspect every profile manually.

This phase adds a pure calculation layer only. It contains no React, no database access, no API calls, and no media/document UI changes.

## Architecture

- `lib/intelligence/dashboard.ts`  
  Builds officer intelligence cards and dashboard-level summaries.

- `lib/intelligence/summary.ts`  
  Aggregates reusable summary counts such as Promotion Ready, Retiring Soon, Missing GP7, Missing Portrait, and Incomplete Profiles.

- `lib/intelligence/flags.ts`  
  Generates reusable officer flags from promotion results, retirement timing, documents, training, profile completeness, and portrait availability.

- `lib/intelligence/priority.ts`  
  Converts flags into a numeric priority score and a Low/Medium/High/Critical priority band.

- `lib/intelligence/recommendations.ts`  
  Produces human-readable recommendations from flags and Promotion Engine outputs.

- `lib/intelligence/types.ts`  
  Shared domain types for dashboard inputs, cards, flags, priorities, and summaries.

## Inputs

Each officer can provide:

- Officer id and display name
- Promotion context and promotion rules, or a precomputed promotion result
- Remaining time until retirement from the Personnel Calendar Engine
- Profile completeness percentage
- Official portrait availability
- Training records
- Document signals such as GP7

The engine remains pure. Callers decide how to fetch or map real officer data.

## Outputs

For each officer, the engine returns:

- Promotion status: Eligible, Near Eligible, Not Eligible, Unknown
- Retirement status: Normal, Retiring within 2 years, Retiring within 1 year, Retired, Unknown
- Profile completeness band: High, Medium, Low, Unknown
- Flags
- Priority score
- Priority band
- Recommendations

Dashboard summary output includes:

- Total Officers
- Promotion Ready
- Near Promotion
- Retiring Soon
- Incomplete Profiles
- Missing Documents
- Missing GP7
- Missing Portrait
- Missing Training

## Priority Calculation

Priority is derived from flags:

- Critical flag: +40
- Serious flag: +25
- Warning flag: +12
- Info flag: +5

Priority bands:

- Low: below 15
- Medium: 15-34
- High: 35-59
- Critical: 60+

This scoring is intentionally simple and reusable. Future phases can tune weights without changing dashboard consumers.

## Recommendation Generation

Recommendations come from two sources:

1. Officer flags  
   Examples: Missing Official Portrait, Retiring Soon, Needs Training.

2. Promotion Engine results  
   Missing requirements and suggested next steps are copied into commander-readable recommendations.

Examples:

- Officer is ready for promotion review.
- Complete GP7.
- Complete required training.
- Replace missing official portrait.
- Retirement planning should begin.

## Engine Integration

The intelligence layer uses:

- Personnel Calendar Engine for retirement timing.
- Promotion Eligibility Engine for promotion status, missing requirements, warnings, and next steps.

It does not create new promotion rules or new calendar rules.
