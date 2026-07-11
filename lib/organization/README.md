# lib/organization — Organization Framework

Reusable Border Patrol organization data: dropdown option lists, unit-name
generators, and lookup helpers, all derived from a single static source of
truth. **Never hardcode a unit/battalion/company name outside this folder —
import from here instead.**

## Two systems live in this folder

There are two, deliberately separate, organization systems here. Know which
one you need before importing:

| | Static framework (this doc) | DB-backed system |
|---|---|---|
| Source of truth | `organization_master.ts` (hardcoded) | `Region`/`Battalion`/`Company` Prisma tables, seeded by `organization_seed.ts` |
| Editable at runtime? | No — edit the file, redeploy | Yes — rows can be added/edited without a deploy |
| Used by | New dropdowns: Gallery, generated unit-name lists, any new feature needing a static Division/Battalion/Company list | Officer profile + Career Timeline editing (`OrgHierarchyPicker`, `org_tree.ts`, `org_tree_service.ts`) |
| Level names | Headquarters / Division / Battalion / Company | Headquarters / Region / Battalion / Company (same hierarchy, "Region" = "Division") |

**Do not mix them.** If you're building a new dropdown that doesn't need to
be edited by an admin at runtime, use the static framework below. If you're
touching Officer/Timeline editing, keep using `org_tree.ts` +
`OrgHierarchyPicker` — that flow is unchanged by this framework.

## Files (static framework)

- **`organization_master.ts`** — the ONLY source of truth for the static
  hierarchy. `DIVISIONS` (division code -> battalion codes) and `BATTALIONS`
  (battalion code -> company codes), plus flattened `DIVISION_CODES` /
  `BATTALION_CODES` / `COMPANY_NUMBER_CODES`. To add/remove a unit, edit this
  file only — every generator, dropdown, and helper below picks it up
  automatically.
- **`organization_generator.ts`** — pure name generators built from the
  master data: `getBattalionOptions()`, `getCompanyOptions()`,
  `getCompanyNumberOptions()`, `getCompanyNameOptions(prefix)` (concatenated,
  e.g. `"ชปข.414"`), `getCompanyNameOptionsSpaced(prefix)` (space-separated,
  e.g. `"แผนที่หน่วยข้างเคียง 414"`).
- **`dropdown_options.ts`** — ready-to-render `DropdownOption[]` arrays:
  `regionDropdown` / `divisionDropdown`, `battalionDropdown`,
  `companyDropdown`, `companyNumberDropdown`, `headquartersDropdown`. Import
  these directly in a component instead of mapping the generator output
  yourself.
- **`gallery_generator.ts`** — `createGalleryDropdown({ prefix, spaced? })`.
  Every Gallery unit-name dropdown should call this instead of hardcoding a
  list of unit names.
- **`organization_types.ts`** — shared types. The static framework's types
  are prefixed `Master*` (`MasterOrganization`, `MasterDivision`,
  `MasterBattalion`, `MasterCompany`, `OrganizationPath`, `DropdownOption`) to
  stay distinct from the DB-backed system's `Region`/`Battalion`/`Company`
  row types already in this file.
- **`organization_helpers.ts`** — in addition to the existing
  code-parsing/validation helpers for the DB-backed system
  (`parseOrganizationCode`, `normalize*Code`, ...), this file now also has
  static-framework lookups: `findBattalion(companyNumber)`,
  `findDivision(companyNumber)` (alias: `findRegion`),
  `getOrganizationPath(companyNumber)`, `isValidBattalion(code)`,
  `isValidCompany(code)`.

## Usage

```ts
import { battalionDropdown, companyDropdown } from "@/lib/organization/dropdown_options";
import { findDivision, getOrganizationPath } from "@/lib/organization/organization_helpers";
import { createGalleryDropdown } from "@/lib/organization/gallery_generator";

// A plain <select> of every battalion:
battalionDropdown.map((o) => <option key={o.value} value={o.value}>{o.label}</option>);

// Which division does company "434" belong to?
findDivision("434"); // -> "4"

// Full path for a company:
getOrganizationPath("434"); // -> { divisionCode: "4", battalionCode: "43", companyCode: "434" }

// A Gallery dropdown of "ชปข.NNN" for every company:
createGalleryDropdown({ prefix: "ชปข." });
```

## Rules

1. Never hardcode a Division/Battalion/Company name/list in a component,
   route, or other lib module. Import from this folder.
2. Adding/removing a unit means editing `organization_master.ts` only.
3. Don't add a new naming-prefix special case to the generators — they
   already accept any prefix string (`getCompanyNameOptions`/
   `getCompanyNameOptionsSpaced`/`createGalleryDropdown`).
4. Keep the static framework and the DB-backed system separate (see table
   above). If a feature needs runtime-editable organization data, that's the
   DB-backed system's job, not this static one's.
