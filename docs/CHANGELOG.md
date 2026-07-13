# Changelog

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