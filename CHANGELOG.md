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

# Phase 44

Commit

```
cbbd530
```

Summary

Personnel Capability Intelligence (Skills Registry)

Implemented

- Skill master tables: SkillCategory / Skill / SkillLevel (additive, legacy
  Int-PK convention). Idempotent catalog seed — 11 categories, 7 proficiency
  levels, 119 skills (npm run db:seed:skills)
- OfficerSkill (per-officer join, replace-all on save, FK to Officer.id
  onDelete Cascade) with level / experience / certificate / verification /
  deployment-readiness / remarks
- OfficerSkillCertificate — forward-compatible multi-certificate child table
  (schema present, current UI still writes the single inline certificate)
- Save flow: officerSkillRowSchema + OfficerProfileService.save (single
  transaction, replace-all) + api_client + workspace draft
- Officer Profile "ความเชี่ยวชาญและศักยภาพ / Professional Skills &
  Competencies" accordion card (after Personal Information, before Salary
  History): checkbox per skill revealing level / experience / certificate /
  verification / deployment / remarks
- Commander Search capability filter: category, skill, minimum level,
  verified, has certificate, certificate expiring soon, expert, instructor,
  deployment-ready, minimum experience (all constraints met by the SAME skill)
- Dashboard capability analytics: skill coverage, deployment-ready, expiring
  certificates, instructors, language speakers, AI/Drone experts,
  medical/legal/IT/PR staff, top skills
- Full i18n (capability.* dictionary keys); skill/category/level NAMES are the
  DB's bilingual columns rendered in the active language
- Structured for future AI queries (who speaks Chinese, who is a drone
  operator, who has TCCC, who is an instructor, who has legal qualifications)
- Additive architecture 100% — NO changes to Promotion / Retirement / Salary /
  Commander Intelligence / Timeline engines or existing tables. Printable
  Profile / AI Intelligence / Mission Planning / Team Builder left data-ready

Database

- Migration 20260720000000_personnel_capability: creates SkillCategory,
  Skill, SkillLevel, OfficerSkill, OfficerSkillCertificate (+ indexes/FKs).
  No existing table altered.

Tests

- 1130 / 1130 passing

---

# Current Stable Version

Phase 44

Commit

```
cbbd530
```

---

# Next Planned Phase

Phase 29A

Officer Document Vault Foundation