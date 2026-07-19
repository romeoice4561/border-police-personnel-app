# Officer Intelligence Workspace — Phase 44

**Phase 44 — Officer Intelligence Workspace.** The Officer Profile/Workspace-specific
companion to `docs/Personnel_Intelligence_Architecture.md`, mirroring how Phase 42/43
have their own companion docs (`docs/COMMANDER_DASHBOARD_INTELLIGENCE.md`,
`docs/COMMANDER_SEARCH_INTELLIGENCE.md`).

## Data flow

```
Master Data (Prisma / OfficerWithRelations)
    -> Intelligence Engines (lib/intelligence/{promotion,age,service,retirement})
       + lib/commander_query/query_officer.ts's toQueryOfficer() — the SAME
       per-officer composition Commander Search already runs for this officer
    -> Officer Intelligence View Model (lib/officer_intelligence/view_model.ts,
       composeOfficerIntelligenceViewModel())
    -> Officer Workspace UI (Header, Promotion/Age-Service-Retirement cards,
       Commander Actions) — presentation ONLY, never recalculates age,
       service, retirement, promotion eligibility, or Buddhist Era.
```

`lib/server/officer_intelligence_service.ts`'s `getOfficerIntelligenceViewModel(officerId)`
is the server entry point (loads the officer, resolves the canonical portrait, resolves
org labels, composes the view model). `app/officers/[id]/page.tsx` instead composes the
view model INLINE from data it already fetched for the rest of the page (officer, portrait,
organization engine) — avoiding a second Prisma round-trip for the same officer. Both paths
call the identical `composeOfficerIntelligenceViewModel()`.

## View Model ownership

`lib/officer_intelligence/types.ts`'s `OfficerIntelligenceViewModel` is the single shape
every Intelligence-driven section of the Officer Workspace reads from — `identity`,
`age`, `service`, `promotion`, `retirement`, `commander`, `profileQuality`. No React
component may recalculate any of these values; every field is either a direct pass-through
of an Intelligence facade's output or a documented, presentation-only reinterpretation
(e.g. `promotion.waitingYears` = `overdueOpportunities(overdueYears)`, the same pure
helper Commander Search's results table already uses).

**Refactor to make this possible without duplicating calculations (Phase 44):**

- `lib/commander_query/query_officer.ts` — `toQueryOfficer()` (the full per-officer
  Commander read-model composition: age/service/promotion/retirement/timeline/portrait)
  was extracted from `lib/server/commander_query_service.ts` into this new, `server-only`-free
  pure module, so it can be unit-tested directly and called by BOTH Commander Search's batch
  dataset builder and the Officer Intelligence View Model without either one re-deriving
  the same values. `commander_query_service.ts` now imports and re-exports it — no
  behavior change for existing callers.
- `lib/intelligence/officer_intelligence_input.ts` — `toIntelligenceInput()`/
  `buildOfficerProfileIntelligence()` (the Phase 36 Commander Intelligence Card composition)
  was extracted the same way from `lib/server/commander_intelligence_service.ts`, which now
  re-exports it. This was necessary because `toQueryOfficer()` itself calls
  `buildOfficerProfileIntelligence()`, and the old location was behind a `server-only`
  import guard even though the function itself does no I/O.

Neither extraction changed any calculation — the exact same code moved to a location
without a `server-only` import, and the original files re-export for compatibility.

## Header KPI definitions (Task 3)

`components/officer/officer_intelligence_header.tsx` replaces the old `ProfileHeader`'s
ad-hoc `calculateCareerYearsSimple`/`calculateCurrentAge` HeaderFields (which bypassed the
Intelligence facades) with a KPI grid read directly from the view model:

| KPI | Source field | Format |
|---|---|---|
| อายุปัจจุบัน | `age.displayAgeTh` | "40 ปี 11 เดือน 6 วัน" — exact, never decimal |
| อายุราชการ | `service.displayServiceDurationTh` | exact, never decimal |
| ปีเกษียณอายุราชการ | `retirement.retirementYearBe` | "พ.ศ. 2588" — Buddhist Era only |
| ดำรงตำแหน่งระดับนี้มา | `service.yearsInCurrentPositionLevel` (reads `positionLevelYearCount` — see below) | whole years, calendar year-count |
| คุณสมบัติ | `promotion.qualificationTextTh` | "ครบขึ้น {targetPosition}" |
| สถานะ | `promotion.displayStatusTh` | Thai badge, same tone map as Commander Search |

Portrait, rank, name, position, unit, and the verification badge are unchanged from the
old header — only the KPI area (previously "Career Years"/"Current Age") was redesigned.

## Exact elapsed duration vs. commander-facing position-level year count (Phase 44.1 fix)

These are two DIFFERENT concepts and must not be confused:

| Concept | Example | Source | Field |
|---|---|---|---|
| **A. Exact elapsed duration** | "4 ปี 7 เดือน 11 วัน" | A chronological duration computed from a real anchor date to `asOf` (`differenceYMD`) | `yearsInPositionLevel` (deprecated for display; still feeds Promotion Intelligence's tenure-requirement eligibility check — never repurpose it) |
| **B. Commander-facing position-level year count** | "5 ปี" | Buddhist-Era calendar-year subtraction: `currentYearBe - positionLevelStartYearBe`, never `+1` | `positionLevelYearCount` (the ONLY field "ดำรงตำแหน่งระดับนี้มา"/"จำนวนปีในระดับนี้" may render) |

**The bug (found and fixed in Phase 44.1):** the results table, export, Dashboard, and
both Officer Workspace consumers all displayed `Math.trunc(yearsInPositionLevel)` — an
exact elapsed duration truncated to a whole number. For an officer whose current position
level started 1 January 2564 (BE), observed at an `asOf` early in Gregorian year 2026 (BE
2569), the exact duration can be short of a full 5th anniversary and truncates to 4, even
though the calendar-year count (`2569 - 2564`) is unambiguously 5. Root cause was TWO
compounding issues, both fixed at the shared `toQueryOfficer()` layer
(`lib/commander_query/query_officer.ts`), never patched per-consumer:

1. **Wrong calculation.** `yearsInPositionLevel` (`yearsSince`, exact duration) was being
   read for a display purpose that needs `yearCountSince` (year-count subtraction,
   `lib/intelligence/shared/duration.ts`) instead. Fixed by introducing
   `positionLevelYearCount` as a distinct field, computed via the new `yearCountSince()`
   helper, and repointing every display consumer (Commander Search table, CSV export,
   Commander Dashboard's `displayYearsAtLevelTh`, and both Officer Workspace consumers) to
   it. `yearsInPositionLevel` itself is UNCHANGED — it still feeds
   `EligibilityOfficer.yearsInPositionLevel` (Promotion Intelligence's tenure-requirement
   check), which this fix does not touch.
2. **Wrong start-year selection for legacy rows.** `positionLevelStartedAt()` selected the
   earliest Timeline row whose STORED `positionLevel` exactly matched the officer's current
   level — but a legacy row that was never backfilled with a structured `positionLevel`
   (while its free-text `position`, e.g. "รอง ผกก.2 ส.3", IS reliably classifiable) was
   silently skipped, anchoring tenure at a LATER row instead. Fixed via
   `effectivePositionLevel()`: the stored `positionLevel` remains authoritative whenever
   present and valid; only when it is missing/Unknown does the row fall back to
   `mapPositionTextToLevel(row.position)` — the SAME canonical classifier already used
   everywhere else, not a second competing one. A row that is unclassifiable by EITHER path
   is excluded, never guessed. No Timeline record is modified.

`positionLevelYearCount` is null (never a fabricated 0) whenever
`positionLevelStartYearBe` is unavailable. It is computed once in `toQueryOfficer()` and
consumed identically by Commander Search and the Officer Intelligence Workspace — both call
the exact same function for the exact same officer, so their displayed values cannot diverge.

## Promotion Intelligence card semantics (Task 4)

`components/officer/officer_promotion_intelligence_card.tsx` replaces
`PromotionCycleSection` (`lib/promotion_cycle/*`, an older, separate display system with
its own English-mixed labels — see Known Limitations) as the ONE primary Promotion
Intelligence presentation on the profile page. Column semantics are identical to Commander
Search's Phase 43 table (see `docs/COMMANDER_SEARCH_INTELLIGENCE.md`'s five-concept table),
applied to a single officer:

- **ดำรงตำแหน่งระดับนี้มาตั้งแต่ปี** — `service.currentPositionLevelStartYearBe`.
- **ดำรงตำแหน่งระดับนี้มา** — `promotion.yearsInCurrentLevel` (reads `positionLevelYearCount`,
  a Buddhist-Era calendar-year count — see "Exact elapsed duration vs. commander-facing
  position-level year count" above) — explicitly NOT `promotionCyclesPassed` (kept on the
  view model for traceability but never rendered here) and explicitly NOT the deprecated
  exact-duration `yearsInPositionLevel`.
- **ปีที่ครบครั้งแรก** — `promotion.firstEligibleYearBe`, from `PromotionSummary.eligibleFiscalYearBe`.
- **รอการแต่งตั้งมาแล้ว** — `promotion.waitingYears`, same `overdueYears - 1` semantics as
  Commander Search.
- **ปีนี้เป็นปีที่** — `promotion.eligibilityYearNumber`, bare number from
  `PromotionSummary.overdueYears`.

Never shows Priority Score or algorithm internals. Always ends with the disclaimer note
`ข้อมูลนี้ใช้สนับสนุนการพิจารณา ไม่ใช่คำสั่งแต่งตั้งอัตโนมัติ`.

## Age/Service/Retirement rules (Tasks 5–6)

`components/officer/officer_personal_timeline_card.tsx` — birth date (Master Data,
formatted via `formatFullThaiDateTh`), exact age, next birthday + days-until, exact
service duration. When `service.available` is false, shows the explicit fallback
`ยังไม่มีข้อมูลวันเริ่มรับราชการที่เชื่อถือได้` — never fabricates a start date.

`components/officer/officer_retirement_intelligence_card.tsx` closes the Phase 43-noted
gap: `computeRetirementSummary` (`lib/intelligence/retirement`) was not consumed anywhere
in the Officer Workspace before this phase. Retirement date, Buddhist-Era retirement year,
exact remaining duration, and an awareness badge (`เกษียณตามเกณฑ์ปกติ` /
`ใกล้เกษียณภายใน 3 ปี` / `ใกล้เกษียณภายใน 1 ปี` / `เกษียณแล้ว`) derived only from the
already-computed `remainingDays`/`isRetired` — no new date math. The 1 October fiscal-year
rule lives entirely in the facade, unchanged.

## Commander action rules (Task 7)

`components/officer/officer_commander_actions.tsx` renders
`view_model.ts`'s `buildCommanderActions()` output — deterministic, non-AI-generated,
derived only from already-computed fields (promotion status, retirement proximity,
official portrait/GP7/training/documents presence, timeline emptiness, age/service
availability). Three severities: `เร่งด่วน` (urgent — only retirement within 1 year today),
`ควรดำเนินการ` (recommended), `ข้อมูลประกอบ` (informational). Birthday proximity is
NEVER included — enforced in the composer itself (`buildCommanderActions` has no
birthday-related branch at all), not filtered in the UI layer, so it cannot regress via a
UI-only change.

## Section ordering (Task 8)

`components/officer/officer_workspace.tsx`'s `OfficerFullWorkspace`, read-only mode:

1. Officer Intelligence Summary Header (`OfficerIntelligenceHeader`)
2. ประเด็นที่ควรดำเนินการ (`OfficerCommanderActions`)
3. Promotion Intelligence (`OfficerPromotionIntelligenceCard`)
4. Age/Service/Retirement Summary (`OfficerPersonalTimelineCard` + `OfficerRetirementIntelligenceCard`, side by side on desktop)
5. Personal Information (+ Basic Information/Career/Current Organization/Contact)
6. Career Timeline
7. Skills, Salary History
8. Training and Education
9. Achievements
10. Media / e-PF
11. Profile Quality and Data Completeness, Commander Intelligence card (legacy Phase 36), Profile Actions

Sections 2–4 are hidden while Edit Mode is active (nothing in them is editable, and
showing Intelligence output next to an in-progress unsaved edit risks reading as stale).

## Master Data vs Intelligence separation

`PersonalInformationSection` (Task 9) keeps only factual Master Data (citizen ID, nickname,
blood group, family, residence, health, uniform sizes) plus date of birth (now formatted via
`formatFullThaiDateTh`, never the raw `11/08/2528` numeric-slash format). Current Age and the
entire Retirement group were REMOVED from this section — both are now shown exactly once, in
the dedicated Intelligence cards, per the phase's "no duplicate presentation" rule.

Career Timeline (Task 10) remains unchanged: factual history, Thai/Buddhist-Era dates,
verification badges, source labels. Audited and found already compliant — no raw enum
leaks, no overstated certainty ("รอบ {N}" is the officer's actual recorded appointment-cycle
year, a factual timeline attribute, distinct from and not confused with the Promotion
Intelligence card's "รอการแต่งตั้งมาแล้ว"/"ปีนี้เป็นปีที่" language).

**Phase 45.1 addition:** `MembershipFinancialSection`/`MembershipFinancialEditor`
("ข้อมูลสมาชิกและการเงิน") is placed immediately after `PersonalInformationSection`,
following the same rule — every value shown is factual Master Data (Academy Class,
membership tri-state, salary level/step/gross/net, bank name/account number), never an
Intelligence calculation. Unlike its sibling section, it is a CLIENT component: several
of its display VALUES (not just labels) are language-dependent — money format,
membership Yes/No/Not-specified — and must render through `useBilingualText()` in the
single active language, never TH+EN simultaneously. Bank account number is masked
(`maskBankAccountNumber`) unless the viewer holds `officers.viewFinancial` or is viewing
their own profile — see `docs/PERSONNEL_MASTER_DATA_STANDARD.md` for the full field
list, tri-state semantics, and RBAC rule.

## Unavailable-data behavior (Task 11)

Every new card defines its own explicit Thai fallback (`ยังไม่มีข้อมูลเพียงพอ` for most
fields, `ยังไม่มีข้อมูลวันเริ่มรับราชการที่เชื่อถือได้` for missing service start) and
renders it via a `value ?? <fallback>` pattern — never `null`/`undefined`/`NaN`/"Invalid
Date"/a raw enum key/a silent zero. `commander.flags` (raw `OfficerFlagCode[]`) is carried
on the view model for programmatic use but is NEVER rendered directly in any Task 3–7
component — only the Thai `CommanderActionItem.textTh` strings are shown.

## Official Portrait rule (Task 12)

The header uses `identity.officialPortraitUrl` — the SAME canonical resolver
(`resolveOfficerPortrait`, `lib/server/officer_portrait_service.ts`) Commander
Dashboard/Search already use (batch variant), never a raw `Officer.thumbnailUrl`/
`driveFileId`/gallery-first-image/document-thumbnail fallback. `PortraitManager` (upload/
replace/history UI) is unchanged — it still receives the full `ResolvedOfficerPortrait`
(needed for its own source badge/history features), not just the URL.

## Files added

- `lib/officer_intelligence/types.ts` — `OfficerIntelligenceViewModel`, `CommanderActionItem`.
- `lib/officer_intelligence/view_model.ts` — `composeOfficerIntelligenceViewModel()`, `buildCommanderActions()`.
- `lib/server/officer_intelligence_service.ts` — `getOfficerIntelligenceViewModel(officerId)`.
- `lib/commander_query/query_officer.ts` — `toQueryOfficer()` (extracted, pure).
- `lib/intelligence/officer_intelligence_input.ts` — `toIntelligenceInput()`/`buildOfficerProfileIntelligence()` (extracted, pure).
- `lib/intelligence/promotion/status_tone.ts` — `PROMOTION_STATUS_TONE` (extracted, shared).
- `components/officer/officer_intelligence_header.tsx`
- `components/officer/officer_promotion_intelligence_card.tsx`
- `components/officer/officer_personal_timeline_card.tsx`
- `components/officer/officer_retirement_intelligence_card.tsx`
- `components/officer/officer_commander_actions.tsx`
- `lib/officer_intelligence/__tests__/view_model.test.ts`

## Files modified

`app/officers/[id]/page.tsx`, `components/officer/officer_workspace.tsx`,
`components/officer/personal_information_section.tsx`,
`components/commander/results/commander_results_table.tsx` (status-tone extraction only),
`lib/server/commander_query_service.ts`, `lib/server/commander_intelligence_service.ts`,
`lib/commander_dashboard/__tests__/view_model.test.ts` (test fixtures, Phase 43 carryover
— unaffected here).

## Known limitations

- **`PromotionCycleSection` (`components/officer/promotion_cycle_section.tsx`,
  `lib/promotion_cycle/*`) is now unused but NOT deleted.** It was superseded by
  `OfficerPromotionIntelligenceCard` in the workspace's render tree, but this phase's
  explicit dead-code scope named only `officer_summary_header.tsx`. Documented here as a
  cleanup candidate for a future phase — do not delete based on this note alone without
  re-confirming zero usage first.
- **`ProfileHeader` (`components/officer/profile_header.tsx`) is now also unused** —
  superseded by `OfficerIntelligenceHeader` — same reasoning: left in place, documented as
  a cleanup candidate, not deleted (out of this phase's named dead-code scope).
- **`OfficerRestrictedProfile`** (the limited view an officer sees of a colleague) was
  NOT updated to use the new Intelligence cards — out of this phase's scope (Task 3/4
  target the full workspace). It continues to use the legacy `OfficerIntelligenceCard`
  (Phase 36) only.
- **No live browser verification** was performed against a running, authenticated session
  in this phase (environment constraint) — verification relied on `tsc --noEmit`, the full
  test suite (1292 tests passing), and `next build`.
- **Retirement Intelligence facade is still not consumed by `commander_query_service.ts`
  itself** (the Phase 43-carried-forward gap) — `CommanderQueryOfficer.retirementYearBe`
  still comes from `calculateRetirement()` directly. This phase's Retirement Intelligence
  card calls `computeRetirementSummary()` independently in the Officer Intelligence View
  Model composer — a NEW, correct call to the facade, not a fix to the pre-existing gap in
  Commander Search's own dataset.

## Training Intelligence integration (Phase 45; strengthened in the Phase 45 completion pass)

`lib/intelligence/training/` is wired into this workspace:
`OfficerIntelligenceViewModel.training` (`TrainingSummary`, read straight off
`toQueryOfficer()`'s `trainingIntelligence` — never recomputed) feeds
`components/officer/officer_training_intelligence_card.tsx`, which sits ABOVE the
factual `TrainingSection`/`TrainingEditor` record list (never replaces it), hidden in
Edit Mode.

**Phase 45 completion pass changes:**
- Fixed a bilingual heading bug (`"Training Intelligence / การวิเคราะห์หลักสูตร"`) — the
  card now uses `t("officer.trainingIntelligenceTitle")` like every other localized
  heading, correctly switching between TH/EN.
- Added a `ประเด็นข้อมูลที่ควรตรวจสอบ` data-quality section rendering
  `TrainingSummary.dataQualityFlags` (previously computed but never displayed), each
  flag localized via `officer.trainingFlag.<CODE>` dictionary keys rather than the
  engine's Thai-only `messageTh` string directly.
- Corrected the "verified"/"unverified" count copy so it never implies real
  verification tracking exists (the schema has no verification field — see
  `docs/TRAINING_INTELLIGENCE.md`'s schema reality section).
- `components/officer/training_section.tsx` (the factual record list) now sorts
  chronologically and displays Buddhist-Era years via `lib/ui/training_history.ts`'s
  extracted, unit-tested `sortTrainingRowsChronologically`/`displayTrainingYear`
  helpers — reusing Training Intelligence's own `completionDate` derivation rather than
  inventing a new one. A row's raw free-text `year` is shown verbatim when it doesn't
  parse as an unambiguous year — never reformatted into a fabricated date.

`OfficerCommanderActions`'s pre-existing "ตรวจสอบข้อมูลการฝึกอบรม" item (still sourced
from the separate `hasTraining` boolean, unchanged) and
`OfficerPromotionIntelligenceCard`'s blockers list were left as-is — neither needed a
data-source change to remain correct. See `docs/TRAINING_INTELLIGENCE.md` for the full
engine detail.

## Future Phase 46 — Document & Expiry Intelligence (not implemented this phase)

Carried forward unchanged from `docs/COMMANDER_DASHBOARD_INTELLIGENCE.md` and
`docs/COMMANDER_SEARCH_INTELLIGENCE.md`'s Phase 46 sections. Planned scope: บัตรประชาชน,
ใบขับขี่, ประกันภัยรถยนต์, พ.ร.บ., ภาษีรถยนต์, issue/start date, expiry date, a Thai Date
Picker, dynamic countdown, expiring-soon/urgent/expired status bands, officer-level
document cards (a natural fit for this workspace's card-based layout), a commander summary
view, filtered drill-down, and future in-app/LINE/Telegram notifications.
