# Timeline Intelligence Engine

## Purpose

The Timeline Intelligence Engine creates one unified chronological personnel timeline. Dashboard pages, officer profiles, commander pages, commander calendar views, and AI assistants should consume this engine instead of assembling their own timeline logic.

This phase is pure engine work only. It does not add UI, database schema, OCR, AI, or media changes.

## Architecture

Location: `lib/timeline/`

- `types.ts` defines event types, categories, severity, sources, input records, filters, and summary shape.
- `builder.ts` merges all supported input sources into normalized `TimelineEvent` records.
- `sort.ts` provides deterministic sorting and duplicate prevention.
- `filters.ts` filters by date range, category, severity, future/past, source, officer, and organization.
- `summary.ts` calculates event counts.
- `engine.ts` provides a reusable facade.
- `service.ts` adapts existing `OfficerWithRelations` profile data into timeline builder input.
- `index.ts` exports the public API.

## Timeline Flow

1. A caller provides `TimelineBuilderInput`.
2. The builder converts each source into `TimelineEvent`.
3. Events are deduplicated by ID.
4. Events are sorted chronologically.
5. Summary counts are calculated.
6. Consumers can apply `TimelineFilter` for dashboard or commander workflows.

## Event Types

Supported event types include:

- Officer Created
- Government Service Started
- Promotion
- Rank Change
- Position Change
- Salary Step
- Training
- Award
- Document Uploaded
- Document Updated
- Official Portrait Updated
- Organization Changed
- Retirement Eligible
- Retirement
- Commander Note
- Manual Event
- Future Event
- Upcoming Eligibility

## Categories

Timeline categories are:

- Career
- Promotion
- Salary
- Training
- Award
- Document
- Portrait
- Organization
- Retirement
- System
- Manual

## Future Timeline

The builder can generate future events from existing engines and explicit inputs:

- Retirement eligibility and retirement dates from the Personnel Calendar Engine.
- Promotion eligibility events from Promotion Engine results.
- Salary review events from Salary Step Engine results.
- Training/document expiration when supplied.
- Manual future events for commander planning.

## Reused Engines

- Personnel Calendar Engine: date math, retirement, fiscal-year support.
- Promotion Engine: structured promotion evaluation results.
- Salary Step Engine: salary-step history and evaluation result inputs.
- Commander Intelligence Engine: consumed indirectly by promotion/salary-step contexts and future callers.

## Design Notes

- Pure TypeScript.
- No React.
- No database access.
- No schema changes.
- No media changes.
- Future sources can be added by mapping data into `TimelineBuilderInput` without changing UI consumers.
