/**
 * Officer <-> Organization resolution helpers (Phase 20C).
 *
 * Prepares Officers to resolve into the Region -> Battalion -> Company
 * master hierarchy (Phase 20A) WITHOUT touching OCR/import behavior: these
 * are pure, opt-in helper functions that read an officer's EXISTING text
 * fields (currentUnit, region, timeline unit strings) and resolve them
 * against OrganizationService. They never invent an organization and never
 * rewrite the officer's text fields — those remain authoritative.
 *
 * Nothing in this module is wired into the import pipeline; it is available
 * for a future explicit caller (e.g. an importer opt-in, a backfill script,
 * or a read-time helper) to invoke, mirroring how Phase 20B made Gallery's
 * organization linking an optional constructor dependency rather than
 * mandatory behavior.
 *
 * No OCR, no AI, no DB writes here — resolution only.
 */

import type { OrganizationService, OrganizationResolution } from "@/lib/organization/organization_service";

/** The subset of an officer's fields these helpers read. Structurally satisfied by the Officer model. */
export interface OfficerOrganizationSource {
  currentUnit?: string | null;
  region?: string | null;
  timeline?: Array<{ unit?: string | null }>;
}

/** IDs resolved for an officer — each independently nullable (never invented). */
export interface ResolvedOfficerOrganization {
  regionId: number | null;
  battalionId: number | null;
  companyId: number | null;
}

const ORGANIZATION_SOURCE_MODULE = "officer_organization";

/**
 * The ordered list of raw text candidates to try when resolving an officer's
 * organization: current unit first (most specific/likely a company), then
 * every timeline unit (most recent first), then the officer's own region
 * text last (least specific — a last-resort region-only resolution).
 */
function candidateTexts(officer: OfficerOrganizationSource): string[] {
  const candidates: string[] = [];
  if (officer.currentUnit) candidates.push(officer.currentUnit);
  for (const entry of officer.timeline ?? []) {
    if (entry.unit) candidates.push(entry.unit);
  }
  if (officer.region) candidates.push(officer.region);
  return candidates;
}

/**
 * Resolves an officer's most specific registered Company by trying
 * `currentUnit`, then each timeline unit, in order, and returning the first
 * one that resolves to a registered Company. Returns null (never invents a
 * Company) if none resolve.
 */
export async function resolveOfficerCompany(
  service: OrganizationService,
  officer: OfficerOrganizationSource
): Promise<OrganizationResolution | null> {
  const candidates = [officer.currentUnit, ...(officer.timeline ?? []).map((t) => t.unit)].filter(
    (c): c is string => Boolean(c)
  );
  for (const raw of candidates) {
    const resolution = await service.resolveCode(raw, ORGANIZATION_SOURCE_MODULE);
    if (resolution.status === "resolved" && resolution.level === "company") return resolution;
  }
  return null;
}

/**
 * Resolves an officer's Battalion — either from a resolved Company's parent,
 * or directly from any candidate text that names a battalion. Returns null if
 * nothing resolves at least to battalion level.
 */
export async function resolveOfficerBattalion(
  service: OrganizationService,
  officer: OfficerOrganizationSource
): Promise<OrganizationResolution | null> {
  for (const raw of candidateTexts(officer)) {
    const resolution = await service.resolveCode(raw, ORGANIZATION_SOURCE_MODULE);
    if (resolution.status === "resolved" && (resolution.level === "company" || resolution.level === "battalion")) {
      return resolution;
    }
  }
  return null;
}

/**
 * Resolves an officer's Region — from a resolved Company/Battalion's parent,
 * or directly from any candidate text (including the officer's own `region`
 * field). Returns null if nothing resolves at all.
 */
export async function resolveOfficerRegion(
  service: OrganizationService,
  officer: OfficerOrganizationSource
): Promise<OrganizationResolution | null> {
  for (const raw of candidateTexts(officer)) {
    const resolution = await service.resolveCode(raw, ORGANIZATION_SOURCE_MODULE);
    if (resolution.status === "resolved") return resolution;
  }
  return null;
}

/**
 * Resolves the full Region/Battalion/Company id triple for an officer in one
 * pass (reuses a single resolution walk instead of three). Each field is
 * independently nullable: an officer whose text doesn't resolve at all gets
 * `{ regionId: null, battalionId: null, companyId: null }` — NEVER invented
 * data, matching OrganizationService's own unresolved-code review policy.
 */
export async function resolveOfficerOrganization(
  service: OrganizationService,
  officer: OfficerOrganizationSource
): Promise<ResolvedOfficerOrganization> {
  for (const raw of candidateTexts(officer)) {
    const resolution = await service.resolveCode(raw, ORGANIZATION_SOURCE_MODULE);
    if (resolution.status !== "resolved") continue;

    if (resolution.level === "company") {
      return {
        companyId: resolution.company.id,
        battalionId: resolution.company.battalion.id,
        regionId: resolution.company.region.id,
      };
    }
    if (resolution.level === "battalion") {
      return { companyId: null, battalionId: resolution.battalion.id, regionId: resolution.region.id };
    }
    return { companyId: null, battalionId: null, regionId: resolution.region.id };
  }
  return { companyId: null, battalionId: null, regionId: null };
}
