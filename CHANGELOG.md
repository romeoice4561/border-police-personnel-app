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
(recorded on commit)
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

# Current Stable Version

Phase 41

Commit

```
(recorded on commit)
```

---

# Next Planned Phase

Phase 29A

Officer Document Vault Foundation