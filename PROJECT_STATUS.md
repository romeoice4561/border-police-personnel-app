# Border Patrol Personnel Intelligence System

## Current Status

**Current Phase**

Phase 43 — Global Internationalization (TH/EN Foundation)

---

## Latest Stable Commit

```
a17c4a7
```

---

# Current Architecture Version

v1.43

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

1113 / 1113 Passing

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