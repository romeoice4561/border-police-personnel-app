# Training Intelligence Engine — Phase 45

**Phase 45 — Training Intelligence Engine & Integration.** The public API layer is
`lib/intelligence/training/`, following the same thin-facade convention as
`lib/intelligence/{age,service,promotion,retirement}/`. This document is the
Training-specific companion to `docs/Personnel_Intelligence_Architecture.md`.

**Phase 45 completion pass (product visibility):** a follow-up pass strengthened HOW
this already-working engine is surfaced to users — the Officer Workspace card, the
Commander Dashboard's KPI/Overview/Action Center/Priority sections, and the Commander
Search filter/column — without changing any Training Intelligence calculation, policy
source, or the engine's public API. Every section below that changed in this pass is
marked "(Phase 45 completion pass)".

## Factual training-record ownership

`Training` (`prisma/schema.prisma`) remains the ONE factual source — one row per
training-course entry an officer completed, unchanged by this phase:

```prisma
model Training {
  id           Int      @id @default(autoincrement())
  officerId    Int
  year         String?   // free text — NOT a real date column
  course       String    // free text — no catalog/enum/FK
  organization String?
  notes        String?
}
```

**Schema reality (audited before implementation):** `Training` has NO completion-date
column (only a free-text `year`), NO expiry/valid-until date, NO certificate number, and
NO verification-status field. This is a genuine data limitation, not an oversight —
every `TrainingSummary`/`TrainingRecordEvidence` field that depends on one of those is
consequently `null` for real data today, never fabricated. `components/officer/
training_section.tsx`/`training_editor.tsx` (the factual record list/editor) are
UNCHANGED by this phase — Training Intelligence reads `Training` rows, it does not
alter how they are stored or edited.

## Data flow

```
Training rows (Master Data)
    -> lib/intelligence/training/evidence.ts (toTrainingRecordEvidenceBatch —
       normalizes course names, best-effort completion date from the year field)
    -> lib/intelligence/training/index.ts's computeTrainingSummary()
       (requirement evaluation against TrainingPolicy, data-quality flags)
    -> lib/commander_query/query_officer.ts's toQueryOfficer()
       (the SAME per-officer composition Commander Search/Dashboard/Officer
       Workspace all already call for age/service/promotion/retirement)
    -> CommanderQueryOfficer.trainingIntelligence
       -> OfficerIntelligenceViewModel.training (Officer Workspace)
       -> DashboardSourceOfficer.training -> CommanderDashboardViewModel.training
          (Commander Dashboard)
       -> Commander Search filters/column (via CommanderQueryOfficer directly)
```

One computation, three consumers, identical output for the same officer (Task 15 item
22 — asserted directly in `lib/commander_query/__tests__/training_integration.test.ts`).

## TrainingSummary model

`lib/intelligence/training/types.ts`'s `TrainingSummary` is the ONE shape every
consumer reads. Key fields: `totalRecords`/`verifiedRecords`/`unverifiedRecords`,
`completedCourseCount`/`missingRequiredCourseCount`/`expiringSoonCount`/`expiredCount`,
`requiredRequirements`/`missingRequirements`/`expiringSoon`/`expired`
(`TrainingRequirementResult[]`), `trainingStatus` (the headline status),
`displayStatusTh`, `recommendationsTh`, and `dataQualityFlags`. `available: false` is
reserved for "the underlying officer/training data itself could not be loaded" — it is
NEVER used to mean "no policy" or "no records"; those are the explicit `NoPolicy`/
`NoData` `trainingStatus` values instead, each with its own truthful counts.

`TrainingRecordEvidence` is the normalized per-row shape (`courseName`,
`normalizedCourseKey`, `provider`, `completionDate`, `expiryDate`, `certificateNumber`,
`verified`, `source`) — the last four are always `null` today per the schema reality
above.

## Course normalization rules

`lib/intelligence/training/course_normalization.ts`'s `normalizeCourseName()`:

1. Whitespace/punctuation cleanup (collapse repeated spaces, full-width space →
   normal space, repeated dots → one dot) — never strips meaningful abbreviation dots.
2. A **structural key**: cleaned text, lowercased, spaces/dots removed. Two course
   names identical except for spacing/punctuation collapse to the SAME key
   (`confidence: "exact"`).
3. An explicit, documented **alias map** (`COURSE_ALIAS_MAP`) — currently EMPTY (no
   curator-approved alias exists yet); wired and tested so a future curator can add
   entries without touching the matching logic (`confidence: "alias"`).
4. Blank/unmatchable input returns `normalizedCourseKey: null`, `confidence:
   "unmatched"` — never a guess.

**No fuzzy/similarity matching is used anywhere** — two course names that merely LOOK
similar (e.g. different courses with overlapping words) never collapse to the same key.
This is a hard architecture rule (see below), not a missing feature.

## Policy source and NoPolicy behavior

`lib/intelligence/training/policy.ts` defines `TrainingPolicy` (`policyId`,
`targetPositionLevel`, `requiredCourseKeys`, optional `targetRank`/`effectiveFrom`/
`effectiveTo`) and the extension point `TRAINING_POLICIES` — **currently an empty
array**. Audit confirmed no real, curator-approved "this course is required for this
position level" policy exists anywhere in the codebase (`PROMOTION_POLICIES` already
has a wired-but-unused `requiredTrainingCodes` field — see Promotion Intelligence
Integration below). `trainingPoliciesForTargetLevel()`/`hasTrainingPolicyForTargetLevel()`
are the single choke-point every caller uses; an empty result means `computeTrainingSummary`
reports `NoPolicy` (records exist) or `NoData` (no records at all) — **never**
`MissingRequired`. Displayed as `ยังไม่ได้กำหนดนโยบายหลักสูตร`
(`TRAINING_STATUS_DISPLAY_TH.NoPolicy`).

## Requirement evaluation

`lib/intelligence/training/requirement_evaluation.ts`'s `evaluateRequirement()`/
`evaluateRequirements()` — pure comparison of an officer's normalized evidence against
a policy's `requiredCourseKeys`. Distinguishes:

- **Completed** — an exact normalized-key match with `verified: true`.
- **Unverified** — a match exists but `verified` is `false` (explicitly failed
  verification) OR `null` (verification is not tracked for this record type — the
  current `Training` reality). Both report `Unverified`, never a false-confidence
  `Completed`.
- **Missing** — no matching evidence at all.
- **Expired**/**ExpiringSoon** — a match exists with an `expiryDate` inside the
  relevant band (see Expiry below).

**Never marks a course complete from a partial/fuzzy name match** — only an exact
`normalizedCourseKey` equality counts (unit-tested explicitly:
`requirement_evaluation.test.ts`'s "a partial/substring name match does NOT count as
complete").

## Expiry support (currently unreachable from real data)

`lib/intelligence/training/expiry.ts`'s `computeExpirySummary()` implements the default
bands (valid >90 days, expiring_soon 31-90, urgent 1-30, expires_today 0, expired
negative) — **fully built and tested**, but `Training` has no expiry column today, so
`TrainingRecordEvidence.expiryDate` is always `null` for real rows and this logic is
never reached in production. It exists so a future schema/data extension (e.g. a
certificate-tracking addition analogous to `OfficerSkillCertificate`) needs only a new
evidence source, not a new calculation. Never stores a countdown — always computed
dynamically from a deterministic `asOfDate`. Distinct from Phase 46 (Document & Expiry
Intelligence) — see that section below.

## Promotion Intelligence integration

Audit confirmed (Phase 41 finding, reconfirmed here): `PROMOTION_POLICIES`
(`lib/promotion/eligibility_policy.ts`) already has a `requiredTrainingCodes` field
wired into `createRequiredTrainingRule` — but every one of its 6 entries currently
OMITS it, so `PromotionEligibilityStatus.MissingTraining` is structurally unreachable
today (confirmed unit-tested: `lib/commander_query/__tests__/training_integration.test.ts`'s
"MissingTraining is reachable only through a real policy").

**What Phase 45 changed:** `lib/commander_query/query_officer.ts`'s
`buildEligibilityOfficer()` now sources `EligibilityOfficer.trainingCodes` from Training
Intelligence's **normalized course keys** (`normalizeCourseName(t.course).normalizedCourseKey`)
instead of raw free-text `Training.course` strings. Since `PROMOTION_POLICIES.requiredTrainingCodes`
remains empty for every level, **no eligibility outcome changed** (full test suite
confirms zero regressions) — `createRequiredTrainingRule` never runs without a
configured code list. If a future policy adds `requiredTrainingCodes`, matching becomes
correct-by-construction (exact normalized key) rather than an accidental raw-string
match.

**Direction preserved, no circular dependency:** Training policy/evaluation → Promotion
facade input (`trainingCodes`) → `PromotionSummary`. `PromotionSummary` remains the
single source of truth for promotion eligibility; Training Intelligence never reads
`PromotionSummary` or React state.

## Dashboard integration

`CommanderDashboardViewModel.training` (additive) — `missingRequiredCount`,
`expiredCount`, `expiringSoonCount`, `unverifiedCount`, `noPolicyCount`, `noDataCount`,
`unavailableCount` (Phase 45 completion pass — officers whose `TrainingSummary` itself
could not be loaded; always 0 today, kept as an honest explicit field rather than
folded into `noDataCount`), `policyConfigured`, `priorityOfficers` (Task 12's
deterministic list — see below).

**`components/intelligence/dashboard_kpi_section.tsx`'s "ขาดหลักสูตร" card** (Phase 45
completion pass, Task 5) now distinguishes FOUR states, checked in this order:
1. **Unavailable** (`training.unavailableCount > 0`) — shows `ข้อมูลไม่เพียงพอ`.
2. **Real policy, positive count** — the confirmed `missingRequiredCount`, linked to a
   Commander Search drill-down, `warning` tone.
3. **Real policy, confirmed zero** — `missingRequiredCount === 0` under a real policy
   renders the SAME numeric `0`, plus a `hint` reading `ไม่พบผู้ขาดหลักสูตรตามนโยบายที่
   กำหนด` so a zero reads as "evaluated and clean," not "not yet checked."
4. **No policy configured** (`policyConfigured === false`, true everywhere today) —
   shows `ยังไม่ได้กำหนดนโยบาย` plus a `hint` explaining evaluation isn't possible yet;
   no drill-down link (nothing real to filter to).

This replaced the LEGACY `CommanderDashboardSummary.missingTraining`
(`lib/intelligence/flags.ts`'s `NEEDS_TRAINING` — a score-based "has zero training rows
at all" signal, unrelated to any promotion policy, kept unchanged elsewhere for
backward compatibility but no longer this card's source).

**`components/intelligence/dashboard_training_overview.tsx`** (Phase 45 completion
pass, Task 6, new) — a small, visually-secondary card group (placed after Promotion
Priority, before Birthday Intelligence — see `app/dashboard/page.tsx`) surfacing
`มีกำลังพลที่มีข้อมูลการอบรม` (`totalPersonnel - noDataCount`, a plain subtraction of two
already-truthful counts), `ยังไม่มีข้อมูลการอบรม` (`noDataCount`), `มีข้อมูลหลักสูตรที่ควร
ตรวจสอบ` (`unverifiedCount`), and either `ขาดหลักสูตรตามนโยบาย` (when
`policyConfigured`) or `นโยบายหลักสูตรยังไม่กำหนด` (otherwise, no drill-down). Every
card with a genuinely-positive count supports click-through to the matching Commander
Search training filter.

**Action Center** (Task 7) gained a `TRAINING` category with THREE entry types: (A)
`training-missing-required`/`training-expired` — real conditions only, `medium`
severity, structurally absent today; (B) `training-data-quality` — a real
`unverifiedCount > 0`, `medium` severity (a caveat about data trustworthiness, not a
promotion blocker); (C) `training-no-policy` — informational ONLY (`severity: "info"`,
`href: null`), fires whenever `noPolicyCount > 0` (true for the whole roster today) so
a commander understands WHY the training KPI/filters can't yet report a real
missing-required count — never presented as individual officer misconduct, never the
same severity as a real blocker.

## Commander Search integration

`CommanderQueryFilters.trainingStatus` filters on
`officer.trainingIntelligence.trainingStatus` — every real, reliably-computable status
is offered (`Complete`, `MissingRequired`, `ExpiringSoon`, `Expired`, `Unverified`,
`NoPolicy`, `NoData`, `Unknown`); none is fabricated. `lib/commander_query/
search_params.ts`'s `filtersFromSearchParams()` (extracted from
`app/commander-search/page.tsx` in the Phase 45 completion pass so it is unit-testable
without pulling in the page's server-only Prisma import) parses `?trainingStatus=...`
from the URL, matching the `promotionEligibilityStatus` drilldown convention (used by
the Dashboard KPI card, Training Overview cards, and Action Center training entries
above).

**Discoverability (Phase 45 completion pass, Task 8):** the filter now lives in its own
visually distinct, bordered group labeled `สถานะการฝึกอบรม` in the filter builder
(`components/commander/filters/commander_query_builder.tsx`) — previously a plain
unlabeled dropdown row indistinguishable from the surrounding promotion/retirement
filters.

The results table's OPTIONAL, hidden-by-default "สถานะหลักสูตร" column (toggle button
in the table header, labeled `commander.showTrainingColumn`/`commander.hideTrainingColumn`)
is unchanged from the original Phase 45 build — the table is already 16 columns wide,
so a 17th column defaults to hidden per the task's explicit "column visibility may
default to hidden if the table is already wide" rule.

## Officer Workspace integration

`components/officer/officer_training_intelligence_card.tsx` (Phase 45 completion pass:
fully localized via the canonical dictionary — the original build's hardcoded bilingual
heading `"Training Intelligence / การวิเคราะห์หลักสูตร"` is fixed) sits ABOVE the factual
`TrainingSection`/`TrainingEditor` record list (never replaces it) in
`components/officer/officer_workspace.tsx`, hidden in Edit Mode like the other
Intelligence cards. Shows: สถานะการฝึกอบรม, หลักสูตรทั้งหมด, ข้อมูลที่ตรวจสอบแล้ว, ข้อมูล
ที่ยังไม่ตรวจสอบ, ข้อมูลผิดปกติ (data-quality issue count, when any exist), and — only
when a real policy exists for the officer's target level — หลักสูตรตามนโยบาย/หลักสูตรที่
ขาด plus ข้อเสนอแนะ. When no policy exists (every officer today), shows a distinct,
informational-tone (never red/warning) `ระบบพบข้อมูลการฝึกอบรม แต่ยังไม่สามารถประเมินว่า
หลักสูตรครบตามเกณฑ์หรือไม่ เนื่องจากยังไม่ได้กำหนดนโยบายหลักสูตรสำหรับตำแหน่งเป้าหมายนี้`
panel instead of an empty/misleading requirement list.

**Factual training history** (`components/officer/training_section.tsx`, Phase 45
completion pass, Task 3) now presents the raw `Training` records SORTED
chronologically, reusing the SAME `completionDate` Training Intelligence already
derives (`lib/ui/training_history.ts`'s `sortTrainingRowsChronologically`/
`displayTrainingYear` — extracted as pure, unit-tested helpers). When a row's
free-text `year` field parses as an unambiguous 4-digit Buddhist-Era year, the
canonical `พ.ศ. YYYY` format is shown; otherwise the raw stored string is shown
VERBATIM (e.g. `"2563-2564"`, `"ปัจจุบัน"`) — never reformatted into a fabricated full
date. Rows without a parseable year sort last, keeping their relative order.

**Data-quality visibility** (Phase 45 completion pass, Task 4): the card now renders
`TrainingSummary.dataQualityFlags` — each flag localized via
`officer.trainingFlag.<CODE>` dictionary keys (not the engine's Thai-only `messageTh`
directly, so EN mode renders correctly) under a `ประเด็นข้อมูลที่ควรตรวจสอบ` heading, or
`ไม่พบปัญหาคุณภาพข้อมูลที่ตรวจสอบได้` when the array is empty. Never claims a record is
"verified" beyond what the schema tracks — the unverified-count copy reads as "not yet
verified," never "failed verification."

## Commander Training Priority (Task 12; UI added Phase 45 completion pass Task 10)

`lib/intelligence/training/priority.ts`'s `buildTrainingPriorityList()` — a
**deterministic, rule-ordered list, NOT an AI recommendation, NOT a numerical score**
(the task explicitly forbids inventing one without a real policy). Fixed tier order:
(1) MissingRequired + promotion-eligible, (2) Expired, (3) ExpiringSoon, (4) Unverified,
(5) NoData. Officers matching none of these tiers are omitted entirely — it is a
priority list, not a full roster; NoPolicy alone never produces a record (the engine's
own tier rules exclude it — see priority.ts). Computed into
`CommanderDashboardViewModel.training.priorityOfficers`.

**`components/intelligence/dashboard_training_priority.tsx`** (Phase 45 completion
pass, new) renders this list — "กำลังพลที่ควรพิจารณาส่งเข้ารับการอบรม" — with columns
รูป (canonical Official Portrait, matching `DashboardPromotionPriority`'s
`OfficialPortraitAvatar` exactly), ยศ ชื่อ–สกุล, ตำแหน่ง, หน่วย, สถานะการฝึกอบรม,
หลักสูตรที่ขาด, สถานะการเลื่อนตำแหน่ง, ข้อเสนอแนะ, ดูประวัติ. **The whole panel returns
`null` (renders nothing) when `officers.length === 0`** — never a decorative empty
panel; since `priorityOfficers` is empty for the entire roster today (no policy is
configured, so tier 1 is unreachable and every other tier is also currently empty in
this codebase's real data), the panel does not currently appear on the live Dashboard —
this is the correct, truthful behavior, not a bug.

## Unavailable-data rules

Every layer distinguishes confirmed-zero from unavailable:
`TrainingSummary.available` (data-loading failure) vs. `trainingStatus: "NoData"` (zero
real records, truthfully zero) vs. `trainingStatus: "NoPolicy"` (records exist, nothing
to check them against). `TrainingRecordEvidence.verified: null` (untracked) is
distinguished from `verified: false` (explicitly failed) throughout — both currently
render as `Unverified` for requirement evaluation (a caveat, not a false confidence
signal), but `dataQualityFlags`'s `UNVERIFIED_RECORD` flag fires only for the explicit
`false` case.

## Data-quality rules

`lib/intelligence/training/data_quality.ts`'s `detectDataQualityFlags()` — read-only,
never deletes/mutates a record. Detects: `MISSING_COURSE_NAME`, `INVALID_DATE`,
`COMPLETION_AFTER_EXPIRY`, `DUPLICATE_CERTIFICATE_NUMBER`, `DUPLICATE_COURSE_RECORD`
(same normalized course + completion date + provider), `UNVERIFIED_RECORD`. The
certificate/expiry-based checks are permanently inert against real `Training` rows
today (no such columns exist) but are implemented and tested against the
`TrainingRecordEvidence` shape so they activate automatically if a future schema change
populates those fields.

## Architecture rule (binding)

**Training requirements must come from explicit policy configuration.** UI components,
labels, and generic course counts must never define promotion requirements. Only
`lib/intelligence/training/policy.ts`'s `TRAINING_POLICIES` (and, downstream,
`PROMOTION_POLICIES.requiredTrainingCodes`) may establish that a course is required —
never a component-level heuristic, never a raw string comparison, never a "has at least
one training record" boolean treated as "meets requirements."

## Known limitations

- **`Training` has no completion date, expiry date, certificate number, or
  verification-status column.** Every `TrainingSummary` field depending on one of these
  is structurally unavailable for real data today — not a bug, a genuine schema gap
  (see Schema Reality above).
- **No real `TrainingPolicy`/`PROMOTION_POLICIES.requiredTrainingCodes` is configured.**
  `MissingRequired`/`MissingTraining` are fully built and tested but unreachable in
  production until a curator configures one.
- **`COURSE_ALIAS_MAP` is empty.** No documented alias exists yet; the mechanism is
  wired and tested for when curated aliases are added.
- **Commander Training Priority now has a Dashboard UI panel** (Phase 45 completion
  pass, Task 10) but it does not currently render on the live Dashboard, since
  `priorityOfficers` is empty for the entire roster today — this is correct/truthful
  behavior (no real policy exists to populate tier 1, and no real expiry/unverified
  data exists to populate the other tiers), not a bug. It will begin appearing
  automatically once real policy/data conditions exist, with no further code change.
- **The legacy `NEEDS_TRAINING` flag** (`lib/intelligence/flags.ts`, score-based) is
  UNCHANGED and still used as a Commander Search filter option — a separate, older
  signal from Training Intelligence's `trainingStatus`, kept for backward
  compatibility, not unified this phase.
- **Action Center's `training-no-policy` entry fires for nearly the entire roster
  today** (every officer with a resolvable target level reports `NoPolicy`) — by
  design (Task 7C requires this informational entry to exist so a commander
  understands why training evaluation is unavailable), but it is a large `info`-severity
  count, not a filtered/curated list. It disappears automatically once any real
  `TrainingPolicy` is configured for at least one target level.
- **No live browser verification** was performed against a running, authenticated
  session in this phase (environment constraint) — verification relied on `tsc
  --noEmit`, the full test suite, and `next build`.

## Future policy configuration

`lib/intelligence/training/policy.ts`'s `TRAINING_POLICIES` array is the extension
point — a future curator adds `{ policyId, targetPositionLevel, requiredCourseKeys }`
entries (using normalized course keys, never raw free-text course names) with no engine
change required. Once populated, `PROMOTION_POLICIES.requiredTrainingCodes` can
reference the same normalized keys to make `MissingTraining` reachable in Promotion
Intelligence too.

## Future document/certificate linkage (Phase 46 — not implemented this phase)

See `docs/INTELLIGENCE_ROADMAP.md`'s Phase 46 section. Document & Expiry Intelligence
(บัตรประชาชน, ใบขับขี่, หนังสือเดินทาง, ประกันภัยรถยนต์, พ.ร.บ. รถยนต์, ภาษีรถยนต์, and
other expiring documents) is a SEPARATE system from Training Intelligence — training
certificates are a possible future extension of `Training`/a new certificate-tracking
model (analogous to `OfficerSkillCertificate`), not the same document-expiry
infrastructure Phase 46 will build for personal/vehicle documents. This phase's
`lib/intelligence/training/expiry.ts` bands (valid/expiring_soon/urgent/expires_today/
expired) were deliberately built to the SAME default thresholds Phase 46 is expected to
use, so the two systems can share the band logic later without redesign — but they
remain two separate features.
