# Border Patrol Personnel Intelligence System — Roadmap

This roadmap tracks completed and planned phases at a high level. See
`PROJECT_STATUS.md` for the authoritative current state and `CHANGELOG.md` for
per-phase change detail.

---

## Recently Completed

- **Phase 28A** — Salary History Foundation
- **Phase 28B** — Two-Step Eligibility Engine
- **Phase 28C** — Career Intelligence Live Simulation
- **Phase 41** — Commander Search Enhancement & Career Position Level
  - Structured `Timeline.positionLevel` as the authoritative, system-wide
    position-level source (never inferred from position text at runtime).
  - Configurable, policy-driven promotion-eligibility engine (eligible now /
    soon / overdue / not eligible + missing requirements + recommended actions).
  - Commander Search: promotion-eligibility mode (rank→rank, level→level,
    eligibility-duration filters), summary cards with drill-down, one-click
    presets, Apply / Reset All / Clear Filters.
  - i18n foundation (centralized TH/EN dictionaries; TH|EN toggle placeholder,
    Thai remains the default — runtime switching deferred).
  - Responsive Commander Search layout + accessibility pass.

---

## Planned

### Officer Document Vault (Phase 29 series)

- **Phase 29A** — Officer Document Vault Foundation
- **Phase 29B** — Document Upload
- **Phase 29C** — Document Viewer
- **Phase 29D** — AI Document Classification
- **Phase 29E** — Officer Package Export

### Commander Analytics (future)

- Runtime language switching (build on the Phase 41 i18n foundation).
- Per-level promotion policy administration UI (edit `PROMOTION_POLICIES`
  from the app rather than in code).
- Position-level statistics dashboards & charts.
- Export writers (Excel / PDF / CSV) for Commander Search results.

### Known Deferred Work

- **Media / Document thumbnail polish** — the document thumbnail white-canvas
  sizing is a known cosmetic issue, deferred to a dedicated Media Polish phase.

---

## Guiding Rules

- Always continue from the latest completed commit.
- Never redesign completed architecture; never duplicate existing modules.
- Prefer additive, backward-compatible database changes.
- Always run lint / tsc / tests / build before finishing a phase.
