# Commander Workforce Intelligence ViewModel (Phase 52.1)

## Purpose

Canonical, deterministic, read-only **Workforce Intelligence ViewModel** for commanders.

Future consumers (not built in 52.1):

- Commander Workforce Dashboard
- Executive Action Center UI
- Organizational Heatmap
- Executive Reports
- Telegram / LINE / AI assistant surfaces

## Architecture

```
CommanderQueryDataset officers
  + PromotionSummary / TrainingSummary / documentIntelligence / flags
  + optional org public-code index
        ↓
composeCommanderWorkforceViewModel (pure)
        ↓
CommanderWorkforceViewModel
```

## Composition boundaries

The ViewModel **may**:

- aggregate existing fields
- count / group statuses
- compute transparent percentages
- build filter metadata and drill-down descriptors
- compute equal-weight readiness among available dimensions

The ViewModel **must not**:

- recalculate promotion eligibility
- reinterpret PromotionSummary
- invent retirement / training / document policy
- call Prisma or repositories
- import React, HTTP, or Telegram
- mutate input officers

## Filter contract

Shared `WorkforceFilterState` using **public organization codes** only (never internal FKs).

All sections use the same filtered officer set. Clearing filters restores unfiltered totals.

## Zero vs unavailable

| Meaning | Representation |
|---------|----------------|
| Evaluated, no matches | `count: 0` + `availability.status: "available"` |
| Cannot evaluate | `availability.status: "unavailable"` + reason |

Examples of unavailable:

- authorized-strength / vacancy → `SOURCE_NOT_IMPLEMENTED`
- personnel category → `NOT_APPLICABLE`
- training MissingRequired when entire set is NoPolicy → `NOT_APPLICABLE`

## Readiness formula

Equal weighting among **available** dimensions only:

1. Promotion: (EligibleThisYear + AlreadyEligible) / (total − Unknown)
2. Retirement continuity: not in (this FY / ≤1y / retired) / (total − unknown dates)
3. Training: Complete / (total − NoPolicy − NoData) when applicable
4. Documents: complete / total
5. Data quality: (total − affected) / total

Unavailable dimensions are excluded from the denominator. Breakdown text is always exposed. This is **not** an AI score.

## Action Center rules

Deterministic operational items from existing statuses only.

- Severity from transparent count thresholds
- Sort by severity then stable key
- Zero-count actions omitted (`omittedZeroCountKeys`)
- No subjective personnel ranking
- No appointment recommendations

## Drill-down contract

`WorkforceDrilldownDescriptor` → approved relative routes (`/commander-search`, `/commander-promotion`) with serializable filters. No hostnames. No internal org IDs.

## Forbidden recalculations

- `computePromotionSummary`
- `computeRetirementSummary`
- training policy invention
- document mandatory-list invention
- vacancy / authorized strength fabrication

## Phase 52.2 UI

- Primary route: `/commander-intelligence` → `loadCommanderWorkforcePageData` + Workforce UI
- Legacy CIC: `/commander-intelligence/legacy` → Phase 49B/50 CIC (unchanged semantics)
- URL filters: `lib/commander_workforce/url_filters.ts` (presentation adapter only)

### Drill-down parity gaps

Workforce drilldowns may emit query keys that Commander Search / Promotion do not fully round-trip yet:

| Param | Destination | Gap |
|-------|-------------|-----|
| `regionPublicCode` / `divisionPublicCode` / `companyPublicCode` | `/commander-search` | Search allowlist still uses internal org filters in places; public-code params may be ignored until parity work |
| `retirementWindow` (workforce keys) | `/commander-search` | Search uses `retirement=within-1-year` style; some workforce-only keys may not filter |
| `trainingStatus` / `documentStatus` / `dataQualityStatus` | `/commander-search` | Partial overlap with existing allowlisted keys |
| `promotionEligibilityStatus` | `/commander-search` | Supported when allowlisted |
| `bucket` / `ready` | `/commander-promotion` | Supported by promotion URL filter |

Documented for Phase 52.3 — UI must not invent alternate href construction.
