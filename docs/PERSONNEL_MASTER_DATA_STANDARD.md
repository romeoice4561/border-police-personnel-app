# Personnel Master Data Standard (Phase 45.1)

Governs the "ข้อมูลสมาชิกและการเงิน" (Membership and Financial Information)
fields added in Phase 45.1 — the personnel Master Data fields deferred when
Phase 40A was narrowed to architecture-only work. This document is the
reference for what these fields mean, how they're stored, and how they may
be surfaced.

## Approved fields

| Field | TH label | EN label | Type | Storage |
|---|---|---|---|---|
| Police Cadet Academy Class | รุ่น นรต. | Police Cadet Academy Class | `Officer.academyClass` | `Int?` (40-100, or null) |
| GPF Member | สมาชิก กบข. | GPF Member | `Officer.isGpfMember` | `Boolean?` (tri-state) |
| Police Funeral Welfare Member | สมาชิกฌาปนกิจสงเคราะห์ ตร. | Police Funeral Welfare Member | `Officer.isPoliceFuneralWelfareMember` | `Boolean?` (tri-state) |
| Cooperative Member | สมาชิกสหกรณ์ | Cooperative Member | `Officer.isCooperativeMember` | `Boolean?` (tri-state) |
| Cooperative Name | ชื่อสหกรณ์ | Cooperative Name | `Officer.cooperativeName` | `String?` |
| Salary Level | ระดับเงินเดือน | Salary Level | `Officer.salaryLevel` | `String?` (free text) |
| Salary Step | ขั้นเงินเดือน | Salary Step | `Officer.currentSalaryStep` | `String?` (free text) |
| Current Salary | เงินเดือนปัจจุบัน | Current Salary | `Officer.currentSalary` | `Int?` (whole Baht) |
| Net Salary | เงินเดือนรับจริง | Net Salary | `Officer.netSalary` | `Int?` (whole Baht) |
| Bank | ธนาคาร | Bank | `Officer.bankName` | `String?` |
| Bank Account Number | เลขบัญชี | Bank Account Number | `Officer.bankAccountNumber` | `String?` (never numeric) |

## Master Data ownership

These are **factual Master Data**, not calculated Intelligence values. No
engine under `lib/intelligence/` reads or writes them in this phase. A
future **Salary Intelligence** engine (unscheduled — see
`docs/INTELLIGENCE_ROADMAP.md`) may eventually read `currentSalary`/
`netSalary`/`salaryLevel`/`currentSalaryStep` the same way Promotion
Intelligence reads `Timeline`, but that calculation does not exist today.

`SalaryHistory` (the existing per-year `yearBE`/`salaryStep` table feeding
Salary Intelligence's "2 ขั้น" eligibility calculation) is a **distinct**
concept from `currentSalaryStep`/`salaryLevel` here — one is a yearly
history of step increments, the other is the officer's current stated
level/step. Neither reads nor writes the other.

## Nullable / unknown semantics

Every field is nullable. `null` means "not yet recorded" — never
backfilled, never guessed, never coerced to `false`/`0`/`""`. This matters
most for the three membership fields: a `Boolean?` lets "unknown" (a legacy
record that was never asked) stay distinct from an explicit "No" — the UI's
tri-state control (ใช่/ไม่ใช่/ไม่ระบุ) maps 1:1 onto (`true`/`false`/`null`).

**Known limitation:** the schema cannot distinguish "this field was never
asked" from "this field was asked and the answer is unknown" — both are
`null`. The UI treats both identically (renders the tri-state
"ไม่ระบุ"/"Not specified" in the edit form; renders "—" in the read-only
profile when the WHOLE membership/salary/bank section has no data at all,
or the tri-state label when at least one sibling field has a value).

## Academy Class range

`รุ่น นรต.` is a closed dropdown, 40 through 100 inclusive
(`lib/officer_profile/academy_class_options.ts`), plus "ไม่ระบุ / Not
specified" (the empty selection, not a stored value). Never free text —
arbitrary values are rejected by both the dropdown and the server-side Zod
validator. Never inferred from age, appointment date, filename, or
timeline — always an explicit human entry.

Display: TH `นรต.รุ่น 61`, EN `PCA Class 61`
(`formatAcademyClassTh`/`formatAcademyClassEn`).

## Membership tri-state behavior

`lib/officer_profile/tri_state.ts` is the single source of truth:
`TriState = "yes" | "no" | "unspecified"`, converted to/from
`boolean | null` via `booleanToTriState`/`triStateToBoolean`. Every
tri-state `<Select>` in the edit form is built from `TRI_STATE_OPTIONS` +
`TRI_STATE_LABELS` — never a plain HTML checkbox (which would have no way
to represent "unspecified" and would silently write `false` for an
unclicked box).

Cooperative Name is only editable when Cooperative Member = ใช่. Switching
away from ใช่ while a name is already entered triggers an inline
confirm/keep prompt (`MembershipFinancialEditor`'s `pendingClearConfirm`
state) rather than silently discarding the entered text.

## Salary storage/display rules

- `currentSalary`/`netSalary` are independent `Int?` columns — net is never
  calculated from gross, and vice versa.
- Whole Baht only (`Int`, not `Decimal`) — Thai civil-service pay carries no
  satang in this domain.
- Empty input → `null`, never `0`. Negative values are rejected
  (`nonNegativeMoney` in `officer_profile_api_schemas.ts`, max 10,000,000).
- Display: TH `38,500 บาท`, EN `THB 38,500`
  (`lib/officer_profile/money_format.ts`) — no decimal places, since none
  are stored.
- `salaryLevel`/`currentSalaryStep` are free TEXT, not a DB enum — the
  Phase 45.1 audit found no existing closed vocabulary for either field, so
  (matching Rank/Position's "curated-suggestion, never forced" convention)
  no enum was invented.

## Bank account privacy/masking (updated — hardening pass)

`bankAccountNumber` is stored as `String?`, **never** a numeric column, so
leading zeros survive exactly as entered
(`lib/officer_profile/bank_account.ts`'s `normalizeBankAccountNumber`
trims/collapses whitespace only — it never strips leading digits). Accepts
digits and hyphens; no pattern tied to one specific bank.

**The unmasked value is never sent to the browser, for any viewer, under
the current architecture.** `redactOfficerForClient()`
(`lib/officer_profile/officer_financial_redaction.ts`) masks
`bankAccountNumber` at the Server Component boundary
(`app/officers/[id]/page.tsx`), BEFORE the officer object is serialized
into the RSC payload and handed to the Client Component tree — not as a
React render-time decision. `MembershipFinancialSection` (read-only) simply
displays whatever value it receives; it has no unmask branch at all,
because there is nothing to unmask by the time it runs.

This is a deliberate, permanent-until-real-sessions-exist policy, not a
placeholder for a `canViewFinancial`-gated unmask path — see "RBAC
requirements" below for why a per-viewer unmask decision cannot be made
correctly today.

**Consequence for editing:** because the value the page hands to the client
is already masked, the edit form must never treat it as "the current real
value" — `ProfileDraft.bankAccountNumber` is always seeded **blank**
(write-only, like a password field;
`use_officer_workspace.ts`'s `toProfileDraft`), and a blank save means
"leave the stored value unchanged," never "clear it"
(`bankAccountNumberSavePatch`). `hasStoredBankAccountNumber(officer)` lets
the editor show a "•••• on file — type to change" placeholder without ever
exposing the value.

## RBAC requirements (updated — hardening pass, read this before granting `officers.viewFinancial`)

`lib/auth/roles.ts` defines **`officers.viewFinancial`** — independent of
`officers.view`/`officers.edit`, granted to `admin` only in the default
bundle. **This permission is a USABILITY control only, not a security
boundary.** `components/officer/officer_workspace.tsx` computes
`canViewFinancial` from it and uses it to decide whether the bank account
NUMBER INPUT renders in Edit Mode — but by the time any of this runs, the
Server Component has already sent the SAME masked value to every viewer
regardless of what their local `can("officers.viewFinancial")` check
returns, because that check cannot be trusted or even evaluated
server-side.

**Root cause — no server-verifiable session exists in this codebase.**
`lib/auth/roles.ts`'s `hasPermission()` is evaluated entirely client-side,
against a session object that lives in `localStorage`/`sessionStorage`
(`components/auth/auth_provider.tsx`). The one cookie mirrored "for a
future middleware" holds only the literal string `"1"` — presence, not
identity, not role, not permissions. No HTTP request in this codebase
today carries any server-verifiable claim about who the caller is. Given
that, no Server Component or API route can correctly answer "is THIS
specific viewer authorized to see the unmasked bank account number" —
there is no trustworthy input to that decision. Building one (e.g. trusting
a client-supplied `X-User-Permissions` header) would not be real security —
it would let any caller self-declare authorization, which is worse than
today's masked-for-everyone default.

**What this means in practice today:**
- The unmasked bank account number is **not retrievable through the
  application at all** — not by an admin, not by the officer viewing their
  own profile via the /officers/[id] page. (An officer's own edit,
  entering the number for the first time, still works — that value only
  ever comes FROM the client's own typed input, never a stored value read
  back to them.)
- `officers.viewFinancial` remains defined and documented so the UI has a
  ready-made hook, and so a FUTURE real-session implementation has an
  existing, tested permission to key off — but no code path today grants
  actual visibility of a previously-stored value based on it.
- `PATCH /api/officers/{id}` also has NO server-side permission check on
  any field, financial or otherwise (pre-existing, not introduced by
  Phase 45.1) — any caller who can reach the route can write any field.
  This remains a genuinely open gap, not mitigated by this hardening pass,
  because closing it requires the same missing session infrastructure.

**Future requirement (binding — do not close this gap with a client-trust
workaround):** real server-side authorization for financial read AND write
requires a server-verifiable session — e.g. a signed cookie or JWT
validated in middleware or a Server Component, checked against
`lib/auth/roles.ts`'s existing permission vocabulary (no new RBAC framework
needed — `hasPermission()`/`officers.viewFinancial`/`officers.editFinancial`
already exist and are ready to be evaluated server-side once a trustworthy
identity input exists). Until that lands, treat this application as
suitable only for a trusted-administrator deployment model where every
person who can reach the app is already implicitly authorized — the RBAC
UI is a workflow aid in that model, not an access-control boundary.

## Commander Search exposure

Task 9 exposes exactly 4 privacy-safe fields as Commander Search filters:
รุ่น นรต. (`academyClass`), สมาชิก กบข. (`isGpfMember`), สมาชิกสหกรณ์
(`isCooperativeMember`), ชื่อสหกรณ์ (`cooperativeName`). These 4 fields are
also the only ones added to `CommanderQueryOfficer`
(`lib/commander_query/types.ts`) — **salary and bank fields are not part of
this type at all**, so they cannot leak into the results table, any
drilldown, or any future consumer built on `CommanderQueryOfficer` by
construction (verified by a `@ts-expect-error` test in
`lib/commander_query/__tests__/personnel_master_data_privacy.test.ts`).

## Export exclusions

The Commander Search CSV export (`lib/commander_query/commander_export.ts`)
is a fixed 14-column allow-list built from `CommanderQueryOfficer` — since
that type never carries salary/bank fields, the export cannot include them
without a deliberate, separate future change. No other export surface
exists in this codebase today (confirmed during the Phase 45.1 audit).

## Migration behavior

`prisma/migrations/20260721000000_personnel_master_data_expansion/` adds 11
nullable columns to `Officer` via `ALTER TABLE ... ADD COLUMN` only — no
column altered, no row deleted, no backfill. Every existing Officer record
gets these columns as `NULL` until a human explicitly fills them in through
the new "ข้อมูลสมาชิกและการเงิน" editor section.

## Known limitations

- "Never asked" and "asked, marked unknown" are both `null` and render
  identically (see Nullable/unknown semantics above).
- **No server-side RBAC enforcement exists for ANY permission in this
  codebase** (not `officers.viewFinancial`, not `officers.edit`, not any
  other) — root cause: no server-verifiable session exists at all. See
  "RBAC requirements" above for the full explanation and the binding future
  requirement. The Phase 45.1 hardening pass closed the one leak that WAS
  fixable without a real session (the bank account number reaching the
  browser's RSC payload unmasked) by masking it unconditionally at the
  server boundary — it did not, and could not, add genuine per-user
  read/write authorization.
- `salaryLevel`/`currentSalaryStep` have no closed vocabulary; the UI
  offers no curated suggestions yet (a future pass could add a Combobox
  suggestion list once real-world value patterns are known, matching
  Rank/Position's convention — not implemented in this phase).
- Commander Search's `cooperativeName` filter is a case-insensitive
  substring match, not a Combobox against known cooperative names (no
  existing data to seed such a list from).
- Because the bank account number is now always masked server-side, there
  is currently no way for ANY viewer (including an admin) to retrieve a
  previously-saved bank account number through the application — only to
  overwrite it with a new value. This is the direct, accepted cost of
  closing the RSC-payload leak without a real session to authorize a
  genuine unmask.

## Future Salary Intelligence integration

Not implemented in this phase. When it lands (unscheduled), it would read
`currentSalary`/`netSalary`/`salaryLevel`/`currentSalaryStep` as the
factual base, and continue to read `SalaryHistory` independently for the
existing "2 ขั้น" eligibility logic — the two never merge into one
calculation without an explicit design decision to do so.
