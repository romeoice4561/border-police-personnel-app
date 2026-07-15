# Border Patrol Personnel Intelligence System

## Current Status

**Current Phase**

Phase 44 — Personnel Capability Intelligence (Skills Registry)

---

## Latest Stable Commit

```
cbbd530
```

---

# Current Architecture Version

v1.44

---

# Completed Modules

## Internationalization (Phase 43)

- ✅ Global Language Provider (localStorage-persisted, hydration-safe)
- ✅ Central namespaced dictionary (`lib/i18n/dictionary.ts`) + pure `translate()`
- ✅ Language-agnostic design (add zh/ms without architecture changes)
- ✅ Single global TH | EN switch in the app shell (no per-page switches)
- ✅ Locale-aware dates (TH Buddhist Era พ.ศ. / EN Gregorian A.D.)
- ✅ Translated: Navigation, Commander Search, Officer Detail/Workspace, Dashboard, shared components
- ⏳ Deferred to later phase: Gallery, Statistics, Review, Portrait Cleanup, Admin; runtime switching already works app-wide

## Personnel Capability Intelligence (Phase 44)

- ✅ Skill master tables (SkillCategory / Skill / SkillLevel) — 11 categories, 7 levels, 119 skills, idempotent seed (`npm run db:seed:skills`)
- ✅ OfficerSkill (per-officer, replace-all save) + OfficerSkillCertificate (forward-compatible multi-certificate table, unused by current UI)
- ✅ Officer Profile "ความเชี่ยวชาญและศักยภาพ / Professional Skills & Competencies" accordion card (after Personal Info, before Salary History)
- ✅ Commander Search capability filter (category / skill / min level / verified / certificate / expiring / expert / instructor / deployment-ready / experience)
- ✅ Dashboard capability analytics (coverage, languages, AI/Drone experts, instructors, medical/legal/IT/PR staff, expiring certs, deployment-ready, top skills)
- ✅ Fully i18n (capability.* keys); additive only — no engine/business-logic changes
- ⏳ Data-ready (not built this phase): AI Intelligence, Printable Profile, Mission Planning, Team Builder

## Organization

- ✅ Organization Engine
- ✅ Organization Repository
- ✅ Organization Normalizer
- ✅ Organization Alias
- ✅ Region/Battalion/Company Cascading
- ✅ Gallery Integration

---

## Personnel

- ✅ Officer Workspace
- ✅ Portrait Upload
- ✅ Portrait History
- ✅ Google Drive Portrait Sync

---

## Career

- ✅ Timeline
- ✅ Career Position Level (structured, authoritative)
- ✅ Salary History
- ✅ Salary Evaluation
- ✅ Draft Simulation

---

## Commander

- ✅ Commander Intelligence Engine
- ✅ Commander Query Center
- ✅ Personnel Query
- ✅ Promotion Eligibility Search (config-driven policy engine)
- ✅ Eligibility Summary Cards (drill-down)
- ✅ Search Presets
- ✅ Reset All / Clear Filters
- ✅ i18n Foundation (TH/EN dictionaries; toggle placeholder — Thai default)

---

## Gallery

- ✅ Gallery Organization
- ✅ Organization Combobox
- ✅ Metadata Editor

---

## AI Import

- ✅ OCR Pipeline
- ✅ Vision Import
- ✅ Google Drive Import
- ✅ Timeline Extraction

---

# Database

Stable

---

# Build Status

- ✅ lint
- ✅ typescript
- ✅ tests
- ✅ build

---

# Current Test Count

1130 / 1130 Passing

---

# Current Branch

main

---

# Next Planned Phase

Phase 29A

Officer Document Vault Foundation

---

# Future Roadmap

Phase 29A

Officer Document Vault

Phase 29B

Document Upload

Phase 29C

Document Viewer

Phase 29D

AI Document Classification

Phase 29E

Officer Package Export

---

# Rules

Always continue from the latest completed commit.

Never redesign completed architecture.

Never duplicate existing modules.

Reuse existing repositories.

Prefer additive database changes.

Maintain backward compatibility.

Always run:

- npm run lint
- npx tsc --noEmit
- npm test
- npm run build

before finishing a phase.