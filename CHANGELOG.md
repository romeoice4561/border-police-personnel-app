# Border Patrol Personnel Intelligence System

# Development Changelog

---

# Phase 26

## Organization Framework

Commit

```
11fe625
```

Summary

- Organization Engine
- Organization Repository
- Organization Normalizer
- Gallery Integration

---

# Phase 27

Commit

```
ba17119
```

Summary

- Fixed remaining Organization regressions
- Official organization structure
- Region/Battalion/Company consistency

---

# Phase 28A

Commit

```
13bcc22
```

Summary

Career Intelligence Foundation

Implemented

- Salary History
- Salary Repository
- Salary Section
- Salary Engine Foundation

---

# Phase 28B

Commit

```
429c8b3
```

Summary

Career Intelligence Engine

Implemented

- Two-Step Eligibility Engine
- Evaluation Card
- Deterministic Rule Engine

---

# Phase 28C

Commit

```
b18c46c
```

Summary

Career Intelligence Live Simulation

Implemented

- Draft Simulation
- Live Preview
- Current Eligibility
- Shared Evaluation Engine

---

# Phase 41

Commit

```
bcb452a
```

Summary

Commander Search Enhancement & Career Position Level

Implemented

- Career Position Level (structured `Timeline.positionLevel`, authoritative;
  no longer inferred from position text at runtime)
- Position Level dropdown in Career Timeline editor (after Position)
- Backfill migration (known titles → level, unmapped → Unknown)
- Configurable, policy-driven promotion-eligibility engine
  (eligible now / soon / overdue / not eligible + missing requirements)
- Commander Search: Promotion Eligibility mode (rank→rank, level→level,
  eligibility-duration filters)
- Commander eligibility summary cards with drill-down
- One-click search presets
- Apply / Reset All / Clear Filters
- i18n foundation (centralized TH/EN dictionaries; TH|EN toggle placeholder —
  Thai remains default, runtime switching deferred)
- Responsive Commander Search layout + accessibility pass

Tests

- 1089 / 1089 passing

---

# Phase 43

Commit

```
a17c4a7
```

Summary

Global Internationalization (TH/EN Foundation)

Implemented

- Global Language Provider (React context), persisted to localStorage
  ("bpp.language"), hydration-safe via useSyncExternalStore, restored across
  sessions, cross-tab synced — one provider app-wide, no duplicate state
- Central namespaced translation dictionary (lib/i18n/dictionary.ts) with a
  pure translate(key, lang) usable by React, and by future Report Builder /
  PDF / Print templates and AI-summary rendering (framework-free)
- Language-agnostic architecture: Language is an open union; adding zh/ms is a
  dictionary column + no structural change
- Single global TH | EN switch moved into the app shell (keyboard + ARIA
  radiogroup, focus states, active indication); per-page Commander switch
  removed
- Existing bilingual seams (formatBilingual, BilingualLabel, FIELD_LABELS) made
  language-aware so they render the active language only
- Locale-aware dates: Thai Buddhist Era (พ.ศ.) / English Gregorian (A.D.)
- Fully translated: Navigation, Commander Search (filters, presets, cards,
  charts, table, badges, buttons), Officer Detail/Workspace (sections, fields,
  buttons, empty states), Dashboard (KPIs, filters, panel), and shared
  components (loading/error/empty states, pagination)
- No new hardcoded user-visible strings — all new text via the dictionary
- Secondary pages (Gallery, Statistics, Review, Portrait Cleanup, Admin) get
  the working global switch now; full translation deferred to a later phase
- No database / business-logic / promotion / retirement / intelligence / AI
  engine changes (presentation only)

Tests

- 1113 / 1113 passing

---

# Current Stable Version

Phase 43

Commit

```
a17c4a7
```

---

# Next Planned Phase

Phase 29A

Officer Document Vault Foundation