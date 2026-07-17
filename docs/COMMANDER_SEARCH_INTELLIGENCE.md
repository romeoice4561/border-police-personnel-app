# Commander Search Intelligence — Phase 43

**Phase 43 — Commander Search Intelligence, Table UX, and Official Portrait
Consistency.** The Commander Search-specific companion to
`docs/Personnel_Intelligence_Architecture.md`, mirroring how
`docs/COMMANDER_DASHBOARD_INTELLIGENCE.md` documents the Dashboard.

## Data flow

```
Master Data (Prisma / OfficerWithRelations)
    -> Intelligence Engines (lib/intelligence/{promotion,age,service,retirement})
    -> Commander Search read model (lib/server/commander_query_service.ts,
       getCommanderQueryDataset() -> CommanderQueryOfficer[])
    -> Commander Search View Model / client state (commander_query_center.tsx:
       filtering, sorting, drilldown — pure client state over the already-
       computed dataset)
    -> Commander Search UI (summary cards, charts, insight sentence, results
       table, export) — presentation ONLY, never recalculates eligibility,
       age, service, retirement, or fiscal-year logic.
```

`getCommanderQueryDataset()` is the single source both Commander Search and
Commander Dashboard consume (`lib/server/commander_dashboard_service.ts`
calls the same function) — there is one dataset, not two parallel builds.

## Official Portrait single source of truth (Workstream C)

**Root cause found in the Phase 43 audit:** `CommanderQueryOfficer` exposed
only the raw, `@deprecated`, systematically-unreliable `Officer.thumbnailUrl`
/`driveFileId`/`webViewUrl` fields (Phase 23B finding — the original OCR
import linkage). Commander Dashboard's own service layer
(`commander_dashboard_service.ts`) separately batch-resolved portraits on
top of the shared dataset; Commander Search's route/table did not, so the
**same officer** could show two different photos depending on which page
rendered them. A second, independent bug was found in the Dashboard's own
Birthday Intelligence panel: `view_model.ts`'s `toBirthdayViewModel()` read
`officer.thumbnailUrl` instead of the already-resolved `officialPortraitUrl`
sitting on the same object — the Promotion Priority list had already been
fixed in Phase 42, but Birthday Intelligence was missed.

**Fix:** `getCommanderQueryDataset()` now batch-resolves every officer's
Official Portrait ONCE, via the canonical resolver
(`resolveOfficerPortraitsBatch`, `lib/server/officer_portrait_service.ts`),
before building `CommanderQueryOfficer` rows — upstream of both Commander
Search and Commander Dashboard. `CommanderQueryOfficer.officialPortraitUrl`
is the ONE field any UI component should render; `thumbnailUrl`/
`driveFileId`/`webViewUrl` remain on the type only for back-compat callers
and are marked `@deprecated`. `commander_dashboard_service.ts` no longer
resolves portraits itself — it reads the value straight off the shared
dataset, removing a redundant resolver call.

**Architecture rule (binding):** All officer avatars in operational and
Commander-facing pages must use the canonical Official Portrait resolver.
Feature components must not independently select images from gallery or
document media.

No caller may re-implement the resolver's priority (Official Portrait >
Manual Upload > Verified Manual Match > Google Drive Portrait > Placeholder)
independently — see `lib/server/officer_portrait_service.ts`'s own header
comment for the full policy. Batch resolution is a constant number of
queries for the whole dataset (never N+1).

## Search summary (Task A2) — Commander Intelligence Summary

`components/commander/summary/commander_intelligence_summary.tsx` renders 8
clickable cards reflecting the CURRENTLY-FILTERED result set (the exact
`officers` array the table/charts receive — never a separate query):
ผลลัพธ์ทั้งหมด, ครบคุณสมบัติปีนี้, มีคุณสมบัติครบแล้ว, รอการแต่งตั้ง,
ขาดหลักสูตร, ขาดเอกสาร, ใกล้เกษียณ, ไม่สามารถวิเคราะห์ได้. Every count is a
plain `.filter()` over `officer.promotionIntelligence.promotionStatus`
(`PromotionSummary` — Phase 41's single source of truth). Clicking a status
card (except the total) sets `filters.promotionEligibilityStatus` — the
same filter field Commander Dashboard drill-down links already use, so a
card click is a filter change, not a separate code path. This is additive
alongside the pre-existing `CommanderQuerySummary` (average-age/rank tiles)
and `CommanderEligibilityCards` (per-target-level readiness), which are
unchanged.

## Smart Filters (Task A3)

The filter builder (`commander_query_builder.tsx`) already covered nearly
every reliable field; Phase 43 adds two manual controls for data that was
previously reachable only via URL/preset/drill-down, both backed by fields
the dataset already computes reliably:

- **Promotion Intelligence status** (`promotionEligibilityStatus`) — a
  dropdown of all 8 `PromotionEligibilityStatus` values with their canonical
  Thai labels (`PROMOTION_STATUS_DISPLAY_TH`).
- **Retirement horizon** (`retirementWithin`) — within 1/3/5 years, reusing
  the same field the Dashboard's retirement drill-down and the retirement
  timeline chart already read.

No new filter was added for a field without a reliable source. Known
UI-unreachable legacy fields (`yearsInRank`, `yearsInPosition`,
`governmentServiceYears`, `toRank`) are left as-is — out of scope for this
phase; `toRank` in particular is dead (never read by `applyFilters`), noted
here for a future cleanup phase rather than silently left undocumented.

## Revised table column semantics (Task A4)

`components/commander/results/commander_results_table.tsx` — 16 columns, in
order. These five concepts are easily confused; each has ONE column and ONE
source field:

| Column | Source | Meaning |
|---|---|---|
| ดำรงตำแหน่งนี้มาตั้งแต่ปี | `positionLevelStartYearBe` | The Buddhist-Era year the officer FIRST reached their CURRENT structured position level (earliest matching timeline row, recovered via fallback text classification for legacy rows missing a stored `positionLevel` — Phase 44.1). Not a cycle bucket. |
| จำนวนปีในระดับนี้ | `positionLevelYearCount` (Phase 44.1) | The commander-facing YEAR COUNT: `currentYearBe - positionLevelStartYearBe`, a Buddhist-Era calendar-year subtraction, never `+1`. **Not** the deprecated `yearsInPositionLevel` (an exact elapsed decimal-years duration that can truncate to one year less — e.g. showing "4 ปี" for an officer whose start/current year difference is unambiguously 5). See `docs/OFFICER_INTELLIGENCE_WORKSPACE.md`'s "Exact elapsed duration vs. commander-facing position-level year count" for the full distinction and the bug this fixed. |
| ปีที่ครบครั้งแรก | `promotionIntelligence.eligibleFiscalYearBe` | The Buddhist-Era FISCAL YEAR the officer first became eligible for their NEXT level — a promotion-eligibility date, unrelated to their current level's start year. |
| รอการแต่งตั้งมาแล้ว | `overdueOpportunities(promotionIntelligence.overdueYears)` | Whole promotion opportunities already missed since first becoming eligible (`overdueYears - 1`, floored at 0). Renamed from the legacy "เกินกำหนด" — clearer, does not imply misconduct. Internal field/filter name (`commander.overdueYears`) unchanged for compatibility. |
| ปีนี้เป็นปีที่ | `promotionIntelligence.overdueYears` (bare number) | Which numbered eligibility year THIS fiscal year is (year 1 = first eligible year). Never calculated from today's date in the component — read directly from `PromotionSummary`. |

Worked example (matches the existing, already-tested
`overdueOpportunities()` helper in `lib/commander_query/promotion_display.ts`):
first eligible fiscal year 2568, current fiscal year 2569 → `overdueYears=2`
("ปีนี้เป็นปีที่ 2") → `รอการแต่งตั้งมาแล้ว` = "1 ปี".

Two columns were added versus the pre-Phase-43 table:
**ปีเกษียณอายุราชการ** (`retirementYearBe`, Buddhist Era only, e.g.
"พ.ศ. 2588") and **อายุราชการ** (`displayServiceDurationTh`, Service
Intelligence, exact/compact, e.g. "18 ปี 6 เดือน", never decimal). Every
other column was already present pre-Phase-43 and unchanged in source.

Photo column: `officialPortraitUrl` (Workstream C fix), 72px minimum width,
48px avatar diameter (within the phase's 48–56px range).

## Analytics charts (Task A5)

`commander_query_charts.tsx`'s result-distribution pie now reads
`officer.promotionIntelligence.promotionStatus` (via `PROMOTION_STATUS_DISPLAY_TH`)
instead of the legacy score-ratio `promotionStatus` field — the SAME status
the results table's badge and the Intelligence Summary cards use, so totals
match by construction (same array, same status field, same render pass).
`commander_timeline_charts.tsx`'s promotion-cycle distribution now emits
Thai bucket labels ("N รอบ", "ครบ 5 รอบขึ้นไป") instead of raw English
("5+ cycles"); both charts' "Unknown"/"No timeline data available." English
fallbacks are now `commander.summaryUnknown`/`commander.noTimelineData`.

## Commander Insight (Task A6)

`lib/commander_query/commander_insight.ts`'s `buildCommanderInsightTh()` is
a pure, deterministic (non-LLM) function: `CommanderQueryOfficer[] ->
string`. Same input always produces the same sentence — no external model
call, no randomness. Counts `EligibleThisYear`/`AlreadyEligible`/
`MissingTraining`/`MissingDocuments`/`RetirementRestricted` from
`promotionIntelligence.promotionStatus` and composes a single Thai sentence
above the results table. Empty input returns a fixed "no results" sentence,
never a fabricated statement. Unit-tested in
`lib/commander_query/__tests__/commander_insight.test.ts`.

## Export / print (Task A7)

The previous three disabled Excel/PDF/CSV buttons were a non-functional
stub (no handlers, no library). Phase 43 implements:

- **Excel** — `lib/commander_query/commander_export.ts`'s
  `buildCommanderExportCsv()` builds an RFC-4180-escaped, UTF-8-BOM-prefixed
  CSV (Excel opens it directly with correct Thai text) over the
  CURRENTLY-FILTERED result set, using the same revised column names/status
  labels as the results table. Header block includes the Thai title, active
  filters (`describeFiltersTh()`), result count, a Buddhist-Era generation
  date, and the current Thai fiscal year (`computeFiscalYearSummary`).
- **Print** — the native `window.print()` dialog; no separate render path.
- **PDF — NOT implemented.** Documented here as future work per the
  phase's explicit scope allowance; the "PDF" button remains visibly
  disabled with a Thai note that it's planned for a future phase.

No new dependency was added — CSV/print use only browser/DOM primitives
already available.

## Table UX (Workstream B)

`components/ui/dual_scroll_table.tsx` (already existed, built in the prior
Commander Promotion UX refinement phase) was extended, not replaced:

- **B3** — the top scrollbar (and its spacer) now render ONLY when the
  table's real content overflows the viewport (`ResizeObserver`-driven
  `scrollWidth > clientWidth + 1px` check) — no decorative scrollbar on a
  table that already fits.
- **B4** — `user-select: none` is applied during an active drag so text
  doesn't get selected while dragging; cursor is `default` (not
  grab/grabbing) when there's nothing to scroll.
- Pure predicates extracted to `lib/ui/dual_scroll_table_logic.ts`
  (`tableOverflowsViewport`, `isInteractiveDragTarget`, `dragScrollLeft`) so
  the scroll-UX rules are unit-tested without a DOM harness — see
  `lib/ui/__tests__/dual_scroll_table_logic.test.ts`.

Both large tables (`dashboard_promotion_priority.tsx`,
`commander_results_table.tsx`) moved off percentage-based
`<colgroup>`/`table-fixed` compression (Dashboard table) and hardcoded
`left-14` sticky offsets (both tables) onto explicit per-column
`min-width`/`width` styles and a shared `PHOTO_COL_PX = 72` constant, so the
sticky name column's `left` offset always matches the actual (now wider)
photo column instead of a stale hardcoded value.

## Known limitations

- **PDF export is not implemented** — see Task A7 above.
- **No live browser verification** was performed against a running,
  authenticated session in this phase (environment constraint) —
  verification relied on `tsc --noEmit`, the full test suite (1267 tests
  passing), and `next build`.
- **Retirement Intelligence facade (`lib/intelligence/retirement`) is still
  not consumed by `commander_query_service.ts`** — `retirementYear`/
  `retirementYearBe` continue to go through `calculateRetirement()` directly
  (a pre-existing gap, out of scope for this phase; flagged in the Phase 43
  audit for a future cleanup).
- **`components/officer/officer_summary_header.tsx`** is confirmed dead
  code (zero call sites) still reading raw portrait fields — left in place
  (deletion was out of this phase's explicit scope) but should be removed
  in a future phase rather than fixed, since nothing imports it.
- **No pagination/virtualization** — `getCommanderQueryDataset()` loads
  every officer with full relational depth on every request; the client
  filters/sorts the complete array in a single `useMemo`. Functions
  correctly at current data volumes; flagged in the Phase 43 audit as a
  natural target if officer count grows materially (unscheduled).

## Document & Expiry Intelligence (Phase 46 — future plan, unchanged)

Not implemented in this phase. Planned scope (carried forward unchanged
from `docs/COMMANDER_DASHBOARD_INTELLIGENCE.md`): บัตรประชาชน, ใบขับขี่,
ประกันภัยรถยนต์, พ.ร.บ., ภาษีรถยนต์, วันที่ออกเอกสาร, วันหมดอายุ, a Thai
Date Picker, dynamic countdown, expiry status, reminder thresholds,
commander drill-down, and future LINE/Telegram/in-app notifications.
