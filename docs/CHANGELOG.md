# Changelog

## Phase 42A - Thai Calendar, Promotion Cycle & Data Entry UX Hotfix

### Added
- Buddhist Era personnel date parsing/display helpers for `DD/MM/YYYY` input.
- Promotion Cycle Engine for appointment-cycle eligibility.
- `Timeline.appointmentCycle` persistence and Commander Search cycle fields.

### Changed
- Officer birth date entry now uses Thai BE text input instead of native AD date input.
- Officer profile age/retirement display uses the Personnel Calendar fiscal-year retirement calculation.
- Commander Search promotion filters and summary cards include eligible-cycle buckets.
- Religion and education level fields are closed dropdowns with server validation.

### Verified
- TypeScript, ESLint, unit tests, and production build pass.

## v0.1.0 — Initial Bootstrap

- Scaffolded enterprise folder structure (components, lib, database, docs,
  scripts, imports, exports, storage, supabase, prisma, public).
- Created initial documentation set: project rules, status, roadmap,
  architecture, database design, AI import engine, Google Drive sync,
  Supabase setup, handoff notes.
- No application features implemented.

## Phase 30.2 - Media Display & UI Consistency

### Added
- Unified media display standards
- Media Design System documentation

### Changed
- Official portraits standardized
- Portrait history standardized
- OfficerPhoto adopted as canonical portrait component

### Verified
- Dashboard
- Search
- Officer List
- Officer Detail
- Admin Portraits

### Notes
- Admin gallery metadata preview remains unchanged by design.

## Phase 37 - Commander Dashboard UI Integration

### Added
- Commander Dashboard widgets powered by the Commander Intelligence Engine.
- Officer Profile intelligence card with promotion status, retirement status, priority, profile completion, flags, and recommendations.
- Dashboard filters for promotion readiness, retirement risk, missing documents, missing portrait, training needs, and priority.

### Changed
- Dashboard now focuses on commander intelligence instead of generic recent-officer statistics.
- Commander Intelligence Engine card output now includes prepared profile completion percentage for UI progress display.

### Notes
- No media UI, document thumbnail UI, database schema, OCR, AI, or storage behavior changed.

## Phase 38 - Personnel Query Center (Commander Search)

### Added
- Commander Search Center at `/commander-search`.
- Personnel Query sidebar navigation entry.
- Query Builder for rank, current position, position level, organization, years in rank, years in position, age, service years, intelligence flags, priority, and profile completeness.
- Query Summary cards with commander-focused aggregate values.
- Interactive charts for result distribution, rank, position level, company, promotion timeline, and retirement timeline.
- Sortable results table with portrait, rank, name, current position, position level, tenure, service, age, promotion, retirement, and priority.
- Placeholder export actions for Excel, PDF, and CSV.

### Notes
- Uses existing Personnel Calendar, Promotion, Commander Intelligence, and Organization engines.
- No media UI, document thumbnail UI, portrait UI, database schema, OCR, AI, or storage behavior changed.

## Phase 39 - Salary Step Intelligence Engine

### Added
- Pure Salary Step Intelligence Engine under `lib/salary_step/`.
- Salary-step history model with fiscal year, review cycle, steps awarded, award type, and remarks.
- Pluggable salary-step rule registry.
- Configurable example rules for double-step candidacy, must-skip decisions, maximum-step limits, missing history, and manual review.
- Commander Query filter hooks for salary-step intelligence.
- Dashboard summary helpers for eligible double step, must skip, manual review, missing records, and average salary steps.
- Unit tests for salary-step history, rules, registry, filters, and summaries.
- `docs/SALARY_STEP_ENGINE.md`.

### Notes
- No UI, media UI, database schema, OCR, AI, storage, or payroll behavior changed.
- Regulations are intentionally not hardcoded and can be configured later.

## Phase 40 - Timeline Intelligence Engine

### Added
- Pure Timeline Intelligence Engine under `lib/timeline/`.
- Unified `TimelineEvent` model with event type, date, title, description, category, severity, source, officer, metadata, future, and past fields.
- Timeline builder for career, promotion, salary-step, training, award, document, portrait, retirement, manual, and future events.
- Timeline sorting, duplicate prevention, filtering, summary, and engine facade.
- `OfficerWithRelations` adapter service for existing profile data.
- Unit tests for mixed event ordering, future/past flags, filtering, summaries, sorting, and duplicate prevention.
- `docs/TIMELINE_ENGINE.md`.

### Notes
- No UI, media UI, database schema, OCR, AI, or storage behavior changed.
- Future dashboard, officer profile, commander calendar, and AI assistant surfaces should consume this engine for timeline data.