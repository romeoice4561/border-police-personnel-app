/**
 * OrganizationEngine (Phase 27).
 *
 * THE single consolidated Region -> Battalion -> Company -> Unit API. Every
 * screen that needs organization data — Officer Workspace, Career Timeline,
 * Gallery (browser + edit modal), Officer Search / More Filters, Review
 * Queue, AI Import, OCR-adjacent normalization — reads through this module
 * instead of hand-rolling its own dropdown list, cascade filter, or
 * normalization regex.
 *
 * ARCHITECTURE (see this folder's README.md for the full write-up):
 *
 *   Canonical source: the DB-backed Region/Battalion/Company/Headquarters
 *   tables (Prisma models, seeded by organization_seed.ts) — the ONLY
 *   editable, admin-manageable hierarchy. organization_master.ts (the
 *   static file from Phase 26C/27) is now a BOOTSTRAP/FALLBACK dataset only:
 *   it seeds the DB and is read directly by nothing else. Editing a unit's
 *   name in the DB propagates to every screen automatically — no code
 *   change, because every screen calls this engine, and this engine reads
 *   the DB tree.
 *
 *   Fast synchronous reads (getRegions/getBattalions/getCompanies/
 *   getOrganizationTree/searchOrganization/cascading helpers) operate on an
 *   in-memory OrgTree snapshot — the whole hierarchy is small (~30 + 4 + 16
 *   + 64 rows) and changes rarely, so it is fetched ONCE per server process
 *   (see loadOrganizationEngine below) and memoized, never re-queried or
 *   re-parsed per keystroke/render. This is a continuation of the existing
 *   org_tree.ts/org_tree_service.ts pattern — OrganizationEngine WRAPS that
 *   pure module rather than reimplementing tree logic.
 *
 *   Async normalize/validate/resolve methods (normalizeRegion/
 *   normalizeBattalion/normalizeCompany/normalizeUnit/validateOrganization)
 *   consult the DB-backed OrganizationService (parseOrganizationCode +
 *   OrganizationAlias table) because resolving an OCR/legacy text variant to
 *   its canonical code may need the alias table, which is DB-backed.
 *
 * WHAT THIS ENGINE DOES NOT REPLACE (kept as domain-specific parsing/
 * filtering that CALLS this engine for the final canonical-code lookup,
 * rather than being absorbed into it — see the migration report in this
 * folder's README.md):
 *   - lib/officer_profile/unit_filter.ts's autocomplete-suggestion filter
 *     (a validity predicate, not a normalizer)
 *   - lib/import/timeline_normalization.ts's split-boundary detection (finds
 *     where a unit name STARTS inside a combined string — a different
 *     operation from normalizing an already-isolated unit string)
 *   - lib/gallery/asset_metadata.ts's Drive-folder-chain scanner (extracts
 *     candidate region/battalion/company TEXT from folder names — the
 *     extracted text is then handed to this engine to normalize)
 *   - the OCR engine itself (lib/ocr/*) — never touched organization text at
 *     all, nothing to migrate there.
 *
 * No I/O anywhere in THIS file (delegates entirely to org_tree.ts / a
 * DI'd OrganizationService) — safe to import from client components. The
 * production, DB-fetching entry points (loadOrganizationEngine,
 * getOrganizationNormalizer, and the normalizeRegion/normalizeBattalion/
 * normalizeCompany/normalizeUnit/validateOrganizationText convenience
 * functions) live in organization_engine_server.ts instead, specifically so
 * importing OrganizationEngine's TYPES/CLASSES from a client component (as
 * every migrated component in this phase does) never pulls the Prisma/pg
 * runtime into the browser bundle.
 */

import {
  battalionsForRegion,
  companiesForBattalion,
  autoFillFromCompany,
  autoFillFromBattalion,
  autoFillFromRegion,
  resolveOrgLabels,
  EMPTY_ORG_TREE,
  type OrgTree,
  type OrgTreeRegion,
  type OrgTreeBattalion,
  type OrgTreeCompany,
  type OrgSelection,
  type OrgLabels,
} from "@/lib/organization/org_tree";
import { divisionLabelForRegion } from "@/lib/organization/border_patrol_division_options";
import { OrganizationService, type OrganizationResolution } from "@/lib/organization/organization_service";
import type { OrganizationRepository } from "@/lib/organization/organization_repository";
import type { DropdownOption } from "@/lib/organization/organization_types";

// ---------------------------------------------------------------------------
// Search result shape
// ---------------------------------------------------------------------------

export interface OrganizationSearchResult {
  level: "headquarters" | "region" | "battalion" | "company";
  id: number;
  code: string;
  label: string;
  /** The full ancestor path's ids, for auto-filling every level above the match. */
  path: OrgSelection;
}

export interface OrganizationValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * The synchronous facade — everything a component needs to render Region /
 * Battalion / Company dropdowns, cascade them, resolve display labels, and
 * do free-text search, given an already-loaded OrgTree snapshot. Pure, no
 * I/O — this is what client components hold onto (passed down as a prop or
 * built once from a server-fetched tree), mirroring how OrgTree already
 * flows through the app today.
 */
export class OrganizationEngine {
  constructor(private readonly tree: OrgTree) {}

  /** The raw underlying snapshot, for a caller (e.g. OrgHierarchyPicker) that still needs direct tree access. */
  getOrganizationTree(): OrgTree {
    return this.tree;
  }

  getRegions(): readonly OrgTreeRegion[] {
    return this.tree.regions;
  }

  /** Every battalion, or only those under `regionId` when given. */
  getBattalions(regionId?: number | null): readonly OrgTreeBattalion[] {
    return regionId === undefined ? this.tree.battalions : battalionsForRegion(this.tree, regionId);
  }

  /** Every company, or only those under `battalionId` when given. */
  getCompanies(battalionId?: number | null): readonly OrgTreeCompany[] {
    return battalionId === undefined ? this.tree.companies : companiesForBattalion(this.tree, battalionId);
  }

  getCompany(companyId: number): OrgTreeCompany | null {
    return this.tree.companies.find((c) => c.id === companyId) ?? null;
  }

  getCompanyByCode(code: string): OrgTreeCompany | null {
    return this.tree.companies.find((c) => c.code === code) ?? null;
  }

  getBattalionByCode(code: string): OrgTreeBattalion | null {
    return this.tree.battalions.find((b) => b.code === code) ?? null;
  }

  getRegionByCode(code: string): OrgTreeRegion | null {
    return this.tree.regions.find((r) => r.code === code) ?? null;
  }

  /** Display labels for an org-hierarchy selection (never invents a label for an unset/unresolved level). */
  resolveLabels(selection: OrgSelection): OrgLabels {
    return resolveOrgLabels(this.tree, selection);
  }

  /** Auto Fill (Part D/7): given ANY single selected level's id, derives every ancestor id above it. */
  cascade = {
    fromCompany: (companyId: number | null): OrgSelection => autoFillFromCompany(this.tree, companyId),
    fromBattalion: (battalionId: number | null): OrgSelection => autoFillFromBattalion(this.tree, battalionId),
    fromRegion: (regionId: number | null): OrgSelection => autoFillFromRegion(this.tree, regionId),
  };

  /** Ready-to-render {value, label} pairs for a Region dropdown. */
  getRegionOptions(): DropdownOption[] {
    return this.tree.regions.map((r) => ({ value: String(r.id), label: divisionLabelForRegion(r) }));
  }

  /** Ready-to-render {value, label} pairs for a Battalion dropdown, optionally cascaded by region. */
  getBattalionOptions(regionId?: number | null): DropdownOption[] {
    return this.getBattalions(regionId).map((b) => ({ value: String(b.id), label: b.nameTh }));
  }

  /** Ready-to-render {value, label} pairs for a Company dropdown, optionally cascaded by battalion. */
  getCompanyOptions(battalionId?: number | null): DropdownOption[] {
    return this.getCompanies(battalionId).map((c) => ({ value: String(c.id), label: c.nameTh }));
  }

  /**
   * Free-text search across every level's code + display label (Region,
   * Battalion, Company) — case-insensitive substring match, most specific
   * level first. The ONE search implementation every organization filter
   * (Gallery, Officer Search, More Filters, Review) should call instead of
   * hand-rolling its own `.filter(...)`.
   */
  searchOrganization(query: string): OrganizationSearchResult[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: OrganizationSearchResult[] = [];

    for (const c of this.tree.companies) {
      if (c.code.toLowerCase().includes(q) || c.nameTh.toLowerCase().includes(q)) {
        results.push({ level: "company", id: c.id, code: c.code, label: c.nameTh, path: autoFillFromCompany(this.tree, c.id) });
      }
    }
    for (const b of this.tree.battalions) {
      if (b.code.toLowerCase().includes(q) || b.nameTh.toLowerCase().includes(q)) {
        results.push({ level: "battalion", id: b.id, code: b.code, label: b.nameTh, path: autoFillFromBattalion(this.tree, b.id) });
      }
    }
    for (const r of this.tree.regions) {
      const label = divisionLabelForRegion(r);
      if (r.code.toLowerCase().includes(q) || label.toLowerCase().includes(q) || r.nameTh.toLowerCase().includes(q)) {
        results.push({ level: "region", id: r.id, code: r.code, label, path: autoFillFromRegion(this.tree, r.id) });
      }
    }
    for (const h of this.tree.headquarters) {
      if (h.code.toLowerCase().includes(q) || h.nameTh.toLowerCase().includes(q)) {
        results.push({
          level: "headquarters",
          id: h.id,
          code: h.code,
          label: h.nameTh,
          path: { headquartersId: h.id, regionId: null, battalionId: null, companyId: null },
        });
      }
    }
    return results;
  }

  /** True when `regionId`/`battalionId`/`companyId` are a real, currently-registered organization at their given level. */
  validateOrganization(selection: Partial<OrgSelection>): OrganizationValidationResult {
    if (selection.companyId != null && !this.getCompany(selection.companyId)) {
      return { valid: false, reason: `Company id ${selection.companyId} is not registered` };
    }
    if (selection.battalionId != null && !this.tree.battalions.some((b) => b.id === selection.battalionId)) {
      return { valid: false, reason: `Battalion id ${selection.battalionId} is not registered` };
    }
    if (selection.regionId != null && !this.tree.regions.some((r) => r.id === selection.regionId)) {
      return { valid: false, reason: `Region id ${selection.regionId} is not registered` };
    }
    return { valid: true };
  }
}

/**
 * An engine over an already-known tree (e.g. one already fetched server-side,
 * or received over the wire by a client component) — no I/O, no caching of
 * its own. This is the ONLY tree->engine constructor safe to import from
 * client code. For the server-side, DB-fetching, memoized loader, see
 * loadOrganizationEngine in organization_engine_server.ts (kept in a
 * separate module specifically so this file — and everything that imports
 * types/classes from it, including client components — never pulls in the
 * Prisma/pg runtime).
 */
export function organizationEngineFromTree(tree: OrgTree = EMPTY_ORG_TREE): OrganizationEngine {
  return new OrganizationEngine(tree);
}

// ---------------------------------------------------------------------------
// Async normalize/resolve/validate — DB + alias-table backed.
//
// Dependency-injected over { repository, service } (mirrors
// OrganizationService's own DI pattern exactly), so it is unit-testable with
// InMemoryOrganizationRepository — no real DB, no dynamic import — the same
// way organization_service.test.ts already tests OrganizationService.
// ---------------------------------------------------------------------------

export interface NormalizedCode {
  code: string;
  /** True when resolved via a registered OrganizationAlias entry rather than an exact/parsed code match. */
  viaAlias: boolean;
}

export type NormalizedUnit = NormalizedCode & { level: "region" | "battalion" | "company" };

export interface OrganizationNormalizerDependencies {
  repository: OrganizationRepository;
  service: OrganizationService;
}

/**
 * The engine's async normalize/validate surface — normalizeRegion/
 * normalizeBattalion/normalizeCompany/normalizeUnit/validateOrganization.
 * THE one place a raw region/battalion/company/unit-reference string (OCR
 * text, an imported folder name, a legacy free-text field, ...) is mapped to
 * its canonical code — consulting both the parsed-code match
 * (organization_helpers.ts's parseOrganizationCode, via OrganizationService)
 * and the OrganizationAlias table (legacy/OCR-variant text that doesn't
 * parse as a code at all, e.g. "กองกำกับการตำรวจตระเวนชายแดนที่ 41").
 */
export class OrganizationNormalizer {
  private readonly repository: OrganizationRepository;
  private readonly service: OrganizationService;

  constructor(dependencies: OrganizationNormalizerDependencies) {
    this.repository = dependencies.repository;
    this.service = dependencies.service;
  }

  /**
   * Normalizes a raw region-reference string ("ภาค4", "Border Patrol Region
   * 4", an alias-table entry, ...) to its canonical region code, or null if
   * it doesn't resolve to any registered region.
   */
  async normalizeRegion(raw: string): Promise<NormalizedCode | null> {
    return this.normalizeAtLevel(raw, "region");
  }

  /** Normalizes a raw battalion-reference string to its canonical 2-digit code, or null if unresolved. */
  async normalizeBattalion(raw: string): Promise<NormalizedCode | null> {
    return this.normalizeAtLevel(raw, "battalion");
  }

  /** Normalizes a raw company-reference string to its canonical 3-digit code, or null if unresolved. */
  async normalizeCompany(raw: string): Promise<NormalizedCode | null> {
    return this.normalizeAtLevel(raw, "company");
  }

  /**
   * Normalizes a raw "unit" string — the loosest level, accepting any text
   * that resolves to a company, battalion, or region (whichever is most
   * specific). Returns the resolved level + code, or null if nothing matches.
   */
  async normalizeUnit(raw: string): Promise<NormalizedUnit | null> {
    const aliasHit = await this.findAlias(raw);
    if (aliasHit) return { ...aliasHit, viaAlias: true };

    const resolution = await this.service.resolveCode(raw, "organization_engine.normalizeUnit");
    return resolutionToNormalized(resolution);
  }

  /**
   * Validates a raw region/battalion/company-reference string against the
   * canonical hierarchy (including aliases) — true if it resolves to
   * SOMETHING registered. Use normalizeRegion/Battalion/Company directly
   * when the level matters, not just whether it resolves at all.
   */
  async validateOrganizationText(raw: string): Promise<boolean> {
    const normalized = await this.normalizeUnit(raw);
    return normalized !== null;
  }

  /** Registers a new alias (additive — never overwrites an existing entry for the same text). */
  async registerAlias(
    aliasText: string,
    canonical: { regionId?: number; battalionId?: number; companyId?: number },
    source: string
  ) {
    return this.repository.createAlias(aliasText, canonical, source);
  }

  private async normalizeAtLevel(raw: string, level: "region" | "battalion" | "company"): Promise<NormalizedCode | null> {
    const aliasHit = await this.findAlias(raw);
    if (aliasHit && aliasHit.level === level) return { code: aliasHit.code, viaAlias: true };

    const resolution = await this.service.resolveCode(raw, `organization_engine.normalize${level}`);
    const normalized = resolutionToNormalized(resolution);
    if (normalized && normalized.level === level) return { code: normalized.code, viaAlias: false };
    return null;
  }

  /** Looks up `raw` (trimmed, case-insensitive) against the registered OrganizationAlias table. */
  private async findAlias(raw: string): Promise<{ level: "region" | "battalion" | "company"; code: string } | null> {
    const aliases = await this.repository.listAliases();
    const needle = raw.trim().toLowerCase();
    const match = aliases.find((a) => a.aliasText.trim().toLowerCase() === needle);
    if (!match) return null;

    if (match.companyId != null) {
      const companies = await this.service.getCompanies();
      const company = companies.find((c) => c.id === match.companyId);
      return company ? { level: "company", code: company.code } : null;
    }
    if (match.battalionId != null) {
      const battalions = await this.service.getBattalions();
      const battalion = battalions.find((b) => b.id === match.battalionId);
      return battalion ? { level: "battalion", code: battalion.code } : null;
    }
    if (match.regionId != null) {
      const regions = await this.service.getRegions();
      const region = regions.find((r) => r.id === match.regionId);
      return region ? { level: "region", code: region.code } : null;
    }
    return null;
  }
}

function resolutionToNormalized(resolution: OrganizationResolution): NormalizedUnit | null {
  if (resolution.status !== "resolved") return null;
  if (resolution.level === "company") return { level: "company", code: resolution.company.code, viaAlias: false };
  if (resolution.level === "battalion") return { level: "battalion", code: resolution.battalion.code, viaAlias: false };
  return { level: "region", code: resolution.region.code, viaAlias: false };
}

// Production convenience singletons (loadOrganizationEngine,
// getOrganizationNormalizer, and the normalizeRegion/normalizeBattalion/
// normalizeCompany/normalizeUnit/validateOrganizationText free functions
// backed by the real DB) live in organization_engine_server.ts — server-only,
// so this file stays importable from client components.
