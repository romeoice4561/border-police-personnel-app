# lib/organization — Organization Engine

**One consolidated Region → Battalion → Company → Unit API, backed by the
live database.** Every screen that needs organization data — Officer
Workspace, Career Timeline, Gallery (browser + edit modal), Officer Search /
More Filters — reads through `OrganizationEngine` instead of hand-rolling its
own dropdown list, cascade filter, or normalization regex.

**Never hardcode a unit/battalion/company name outside this folder — import
from here instead.**

## Canonical source: the database

The `Region`/`Battalion`/`Company`/`Headquarters` Prisma tables (seeded by
`organization_seed.ts`) are the ONLY editable, admin-manageable hierarchy.
`organization_master.ts` (a plain hardcoded file) is a **bootstrap/fallback
dataset only** — it seeds the DB and is not read directly by any UI or
business logic anymore. Editing a unit's name in the DB propagates to every
screen automatically, with no code change, because every screen reads
through `OrganizationEngine`, and the engine reads the DB tree.

This is a deliberate inversion from an earlier phase, where a static
`organization_master.ts` file and the DB-backed tables were two separate
systems. They are now one system: DB-backed, with the static file only as
a seed source (see "Future migration path" below).

## Files

- **`organization_engine.ts`** — **the main entry point.** Client-safe (no
  I/O, no Prisma/pg import) — safe to import from any component, server or
  client.
  - `class OrganizationEngine` — the synchronous facade wrapping an
    already-fetched `OrgTree` snapshot: `getRegions()`, `getBattalions(regionId?)`,
    `getCompanies(battalionId?)`, `getCompany(id)`, `getCompanyByCode(code)`,
    `getBattalionByCode(code)`, `getRegionByCode(code)`, `resolveLabels(selection)`,
    `.cascade.fromCompany/fromBattalion/fromRegion(id)` (Smart Auto Fill),
    `getRegionOptions()/getBattalionOptions()/getCompanyOptions()`
    (ready-to-render `DropdownOption[]`), `searchOrganization(query)`,
    `validateOrganization(selection)`.
  - `organizationEngineFromTree(tree)` — wraps an already-known `OrgTree`
    (e.g. one a client component received as a prop from a Server
    Component, or fetched via `useOrganizationEngine()`) into an engine. No
    I/O.
  - `class OrganizationNormalizer` — the async normalize/validate surface:
    `normalizeRegion/Battalion/Company/Unit(raw)`, `validateOrganizationText(raw)`,
    `registerAlias(...)`. Dependency-injected over `{ repository, service }`
    (mirrors `OrganizationService`'s own DI pattern) so it's unit-testable
    with `InMemoryOrganizationRepository` — no real DB needed.
- **`organization_engine_server.ts`** — **server-only** production entry
  points. Import ONLY from Server Components / API routes / scripts, never
  from a client component (it pulls in Prisma/pg).
  - `loadOrganizationEngine()` — fetches (and memoizes per-process, 5 min
    TTL) the `OrgTree` from the DB and returns an `OrganizationEngine`.
  - `getOrganizationNormalizer()` — the production `OrganizationNormalizer`
    singleton, backed by the real DB.
  - `normalizeRegion/Battalion/Company/Unit(raw)`,
    `validateOrganizationText(raw)` — convenience functions using the
    production normalizer.

**Why the split:** `OrganizationEngine`/`OrganizationNormalizer` are classes
— they cannot cross the Server → Client Component boundary (React Server
Components only serialize plain data). A Server Component fetches an engine
via `loadOrganizationEngine()`, then hands the **plain**
`engine.getOrganizationTree()` down as a prop; the client component wraps it
back into an engine via `organizationEngineFromTree(tree)`. See
`app/officers/[id]/page.tsx` + `components/officer/officer_workspace.tsx`
for the pattern, and `lib/ui/hooks.ts`'s `useOrganizationEngine()` for the
client-fetch equivalent (used by `app/officers/page.tsx`,
`components/gallery/gallery_browser.tsx`).

## Supporting files

- **`org_tree.ts`** — the pure, dependency-free `OrgTree` shape (flat
  Headquarters/Region/Battalion/Company snapshot) plus the underlying cascade/
  auto-fill/label-resolution functions `OrganizationEngine` wraps
  (`battalionsForRegion`, `companiesForBattalion`, `autoFillFromCompany`,
  `autoFillFromBattalion`, `autoFillFromRegion`, `resolveOrgLabels`). Rarely
  imported directly anymore — go through `OrganizationEngine` instead unless
  you're working inside `lib/organization/` itself.
- **`org_tree_service.ts`** (in `lib/server/`) — the raw DB fetch
  (`getOrgTree()`) `loadOrganizationEngine()` wraps. Server-only.
- **`organization_repository.ts`** / **`prisma_organization_repository.ts`**
  / **`organization_service.ts`** / **`organization_container.ts`** — the
  DB persistence layer: `OrganizationRepository` (CRUD + `listAliases`/
  `createAlias`), `OrganizationService` (`resolveCode` — parses raw OCR/
  folder text against the seeded hierarchy), and the DI container
  `OrganizationNormalizer` is built from.
- **`organization_helpers.ts`** — `parseOrganizationCode` and friends: pure
  digit-relationship parsing/validation of a raw code string against the
  Region/Battalion/Company hierarchy shape (company's first 2 digits = its
  battalion, battalion's first digit = its region). Used by
  `OrganizationService.resolveCode`, which `OrganizationNormalizer` wraps.
- **`organization_master.ts`** — the static bootstrap dataset
  `organization_seed.ts` seeds the DB from. Border Patrol Headquarters +
  Regions 1-4 + their battalions/companies ONLY (per spec — do not add
  Region 5-7 here; see `gallery_region_options.ts` for how Gallery's
  broader region needs are layered on top without polluting this).
- **`organization_generator.ts`** — pure prefix-formatting helpers
  (`getCompanyNameOptions(prefix)`, `getCompanyNameOptionsSpaced(prefix)`)
  used by `gallery_generator.ts`. Not an organization data source itself —
  callers always supply the company code list.
- **`gallery_generator.ts`** — `createGalleryUnitNames(prefix, companyList, options?)`:
  every Gallery unit-name convention (org-chart "ชปข./ชปส.NNN", deployment-map
  "แผนผังวางกำลังพล NNN", neighbor-map "แผนที่หน่วยข้างเคียง NNN") only supplies a
  prefix; `companyList` is REQUIRED and should always come from
  `OrganizationEngine` (e.g. `engine.getCompanies().map(c => c.code)`), never
  a static array.
- **`gallery_org_helpers.ts`** — Gallery's Region/Battalion/Company fields
  are free TEXT (`Asset.region/battalion/company`), not id-linked like
  Officer/Timeline. This is a thin text↔id adapter OVER `OrganizationEngine`
  (`battalionLabelsForRegion(engine, regionLabel)`,
  `companyLabelsForBattalion(engine, battalionLabel)`,
  `autoFillFromCompanyLabel(engine, companyLabel)`) — every lookup ultimately
  calls engine methods; it just also knows how to parse Gallery's plain
  strings back into the ids the engine's sync API expects.
- **`gallery_region_options.ts`** — `galleryRegionOptions(engine)` extends
  the engine's Border-Patrol-only regions (1-4) with the extra legacy
  regions (5-7) Gallery's free-text `Asset.region` has historically allowed,
  without polluting the shared Border Patrol master data.
- **`gallery_battalion_normalization.ts`** — a fixed set of
  spacing/wording formatting-variant rules (e.g. `"กก.ตชด. 44"`,
  `"กองกำกับการ ตชด.44"` ≈ `"กก.ตชด.44"`), applied server-side in the
  `AssetRepository`/`PrismaAssetRepository`'s `where` clause so Gallery's
  Battalion filter (a strict dropdown sourced from the engine) still matches
  real legacy/OCR-formatted stored text.
- **`headquarters_options.ts`** / **`border_patrol_division_options.ts`** —
  suggestion-label helpers specific to `OrgHierarchyPicker` (Officer/Timeline
  editing): the Headquarters combobox's suggestion list, and the "Border
  Patrol Division" friendly label mapping (`divisionLabelForRegion`) used by
  `OrganizationEngine.getRegionOptions()`/`resolveLabels()` internally.
- **`organization_types.ts`** — shared types: DB row shapes
  (`Region`/`Battalion`/`Company`/`CompanyWithAncestry`), `OrganizationAliasEntry`,
  and `DropdownOption`.

## What this engine deliberately does NOT replace

Kept as their own domain-specific parsing/filtering — a genuinely different
*operation* from organization lookup/normalization, not duplicated
organization data. Each calls into this engine for the final canonical-code
lookup where it needs one, rather than being absorbed into it:

- **`lib/officer_profile/unit_filter.ts`** — a suggestion-VALIDITY predicate
  (is this OCR'd string plausibly a real unit, for autocomplete purposes?),
  not a normalizer.
- **`lib/import/timeline_normalization.ts`** — split-BOUNDARY detection
  (where does a unit name START inside a combined "position + unit"
  string?) — a string-splitting operation, not normalization of an
  already-isolated string.
- **`lib/gallery/asset_metadata.ts`** — Drive folder-CHAIN scanning
  (extracts candidate region/battalion/company text from a list of folder
  names) — the extracted text is what gets handed to this engine to
  normalize, not a duplicate of the engine's own data.
- **`lib/ocr/*`** — never touched organization text at all; nothing to
  migrate.

## Usage

```ts
// Server Component / API route / script:
import { loadOrganizationEngine } from "@/lib/organization/organization_engine_server";
const engine = await loadOrganizationEngine();

// Client component that already has an engine-built tree as a prop:
import { organizationEngineFromTree } from "@/lib/organization/organization_engine";
const engine = organizationEngineFromTree(orgTree);

// Client component fetching its own tree (React Query):
import { useOrganizationEngine } from "@/lib/ui/hooks";
const engine = useOrganizationEngine(); // OrganizationEngine | undefined (loading)

// Reading:
engine.getRegionOptions();                 // [{value, label}, ...] for a <select>
engine.getBattalions(regionId);            // cascaded by parent
engine.cascade.fromCompany(companyId);     // Smart Auto Fill -> {headquartersId, regionId, battalionId, companyId}
engine.resolveLabels(selection);           // ids -> display labels
engine.searchOrganization("434");          // free-text search across every level

// Normalizing raw text (server-only — needs the DB/alias table):
import { normalizeCompany } from "@/lib/organization/organization_engine_server";
await normalizeCompany("ร้อย ตชด.434"); // -> { code: "434", viaAlias: false } | null
```

## Rules

1. Never hardcode a Region/Battalion/Company name/list in a component,
   route, or other lib module. Read through `OrganizationEngine`.
2. Never import `OrganizationEngine`/`OrganizationNormalizer` classes from
   `organization_engine_server.ts` into a client component — always
   `organization_engine.ts` (client-safe) plus a plain `OrgTree` handed down
   as a prop, or `useOrganizationEngine()`.
3. Adding/removing an OFFICIAL unit means editing the DB (via
   `organization_seed.ts`'s seed data, or a future admin UI) — not any code
   file. `organization_master.ts` is bootstrap-only.
4. A legacy/OCR-variant text form that should resolve to a real unit belongs
   in the `OrganizationAlias` table (via `OrganizationNormalizer.registerAlias`),
   not a new hardcoded regex/map.

## Future migration path: static bootstrap → fully live database master

The architecture already treats the database as canonical (see above) — this
section is about closing the remaining gaps:

1. **Reconcile `organization_master.ts` vs. the seeded DB data.** The
   current DB seed (`organization_seed.ts`'s `OBSERVED_STRUCTURE`) was
   grounded in observed imported data and differs slightly from
   `organization_master.ts`'s official list (a few extra/missing company
   codes). A dedicated future phase should decide, per discrepancy, whether
   to add the missing official codes to the DB and move the non-official
   observed codes into `OrganizationAlias` rows (preserving them as
   resolvable aliases, never silently dropping data that real
   officer/timeline/asset rows might still reference).
2. **Wire an admin UI to `OrganizationRepository`'s existing
   upsert*/createAlias methods**, so adding/renaming a unit or registering
   an alias no longer requires editing a seed file and redeploying.
3. **Populate `OrganizationAlias`** with the common OCR-variant text forms
   already known from `gallery_battalion_normalization.ts`'s fixed rule set
   and any patterns found in `UnresolvedOrganizationCode` review data, so
   `OrganizationNormalizer.normalizeUnit` resolves more real-world text
   without a code change.
4. **Once the DB is the complete, actively-maintained source**, retire
   `organization_master.ts` and `organization_seed.ts` (or repurpose the
   seed as a one-time migration script only) — no application code needs to
   change, since nothing but the seed reads that file today.
