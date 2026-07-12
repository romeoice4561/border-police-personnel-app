/**
 * Organization master-data seed (Phase 20A; corrected to the official
 * nationwide list in Phase 27 Bug #4/#7).
 *
 * This is the ONE place the Region → Battalion → Company hierarchy is
 * defined as data — no organization codes are hardcoded anywhere else
 * (services/repositories/importers only ever read through this file or the
 * database it seeds). Replacing the nationwide list later means editing
 * OFFICIAL_STRUCTURE below (or swapping in a JSON import) — no application
 * code changes.
 *
 * OFFICIAL DATA: exactly the nationwide Border Patrol structure — 4 regions,
 * 16 battalions, 66 companies (battalion "44" has 6 companies, every other
 * battalion has 4). Mirrors organization_master.ts's DIVISIONS/BATTALIONS
 * (the static bootstrap file), which is the source of truth for this list.
 *
 * A prior version of this seed (OBSERVED_STRUCTURE) was grounded in
 * observed-but-unreconciled imported data and diverged from the official
 * list: it was missing companies 448/449, and included 8 non-official codes
 * (123, 143, 223, 241, 255, 311, 313, 331) that don't fit the real
 * hierarchy. Those 8 codes are preserved as OrganizationAlias rows (see the
 * organization_alias_legacy_codes migration) rather than silently dropped —
 * any OCR/import text still bearing one of those codes resolves through the
 * alias table to its real battalion instead of failing to resolve at all.
 */

import type { OrganizationSeedEntry } from "@/lib/organization/organization_types";
import { BATTALION_DISPLAY_NAME, COMPANY_DISPLAY_NAME, REGION_DISPLAY_NAME } from "@/lib/organization/organization_helpers";
import type { OrganizationRepository } from "@/lib/organization/organization_repository";

/** regionCode -> battalionCode -> companyCodes — the official nationwide Border Patrol structure (4 regions, 16 battalions, 66 companies). */
const OFFICIAL_STRUCTURE: Record<string, Record<string, string[]>> = {
  "1": {
    "11": ["114", "115", "116", "117"],
    "12": ["124", "125", "126", "127"],
    "13": ["134", "135", "136", "137"],
    "14": ["144", "145", "146", "147"],
  },
  "2": {
    "21": ["214", "215", "216", "217"],
    "22": ["224", "225", "226", "227"],
    "23": ["234", "235", "236", "237"],
    "24": ["244", "245", "246", "247"],
  },
  "3": {
    "31": ["314", "315", "316", "317"],
    "32": ["324", "325", "326", "327"],
    "33": ["334", "335", "336", "337"],
    "34": ["344", "345", "346", "347"],
  },
  "4": {
    "41": ["414", "415", "416", "417"],
    "42": ["424", "425", "426", "427"],
    "43": ["434", "435", "436", "437"],
    "44": ["444", "445", "446", "447", "448", "449"],
  },
};

function buildSeed(): OrganizationSeedEntry[] {
  const entries: OrganizationSeedEntry[] = [];
  for (const [regionCode, battalions] of Object.entries(OFFICIAL_STRUCTURE)) {
    for (const [battalionCode, companyCodes] of Object.entries(battalions)) {
      for (const companyCode of companyCodes) {
        entries.push({
          regionCode,
          regionNameTh: REGION_DISPLAY_NAME(regionCode),
          battalionCode,
          battalionNameTh: BATTALION_DISPLAY_NAME(battalionCode),
          companyCode,
          companyNameTh: COMPANY_DISPLAY_NAME(companyCode),
        });
      }
    }
  }
  return entries;
}

/** The full seed: one row per (region, battalion, company). Deterministic order (region, battalion, company ascending). */
export const ORGANIZATION_SEED: readonly OrganizationSeedEntry[] = buildSeed();

/** Summary of a seed run — counts of distinct regions/battalions/companies upserted. */
export interface OrganizationSeedSummary {
  regions: number;
  battalions: number;
  companies: number;
}

/**
 * Idempotently upserts ORGANIZATION_SEED into the given repository. Safe to
 * re-run: each region/battalion/company is upserted by its unique code, so a
 * repeat run creates no duplicates and just refreshes display order/names.
 */
export async function seedOrganization(
  repository: OrganizationRepository,
  entries: readonly OrganizationSeedEntry[] = ORGANIZATION_SEED
): Promise<OrganizationSeedSummary> {
  const regionOrder = new Map<string, number>();
  const battalionOrder = new Map<string, number>();
  const companyOrder = new Map<string, number>();

  const regionIds = new Map<string, number>();
  const battalionIds = new Map<string, number>();

  for (const entry of entries) {
    if (!regionOrder.has(entry.regionCode)) regionOrder.set(entry.regionCode, regionOrder.size);
    if (!battalionOrder.has(entry.battalionCode)) battalionOrder.set(entry.battalionCode, battalionOrder.size);
    if (!companyOrder.has(entry.companyCode)) companyOrder.set(entry.companyCode, companyOrder.size);
  }

  for (const [regionCode, order] of regionOrder) {
    const entry = entries.find((e) => e.regionCode === regionCode);
    if (!entry) continue;
    const region = await repository.upsertRegion(regionCode, entry.regionNameTh, order);
    regionIds.set(regionCode, region.id);
  }

  const battalionToRegion = new Map<string, string>();
  for (const entry of entries) battalionToRegion.set(entry.battalionCode, entry.regionCode);

  for (const [battalionCode, order] of battalionOrder) {
    const entry = entries.find((e) => e.battalionCode === battalionCode);
    if (!entry) continue;
    const regionId = regionIds.get(battalionToRegion.get(battalionCode) ?? "");
    if (regionId === undefined) continue;
    const battalion = await repository.upsertBattalion(battalionCode, entry.battalionNameTh, regionId, order);
    battalionIds.set(battalionCode, battalion.id);
  }

  const companyToBattalion = new Map<string, string>();
  for (const entry of entries) companyToBattalion.set(entry.companyCode, entry.battalionCode);

  for (const [companyCode, order] of companyOrder) {
    const entry = entries.find((e) => e.companyCode === companyCode);
    if (!entry) continue;
    const battalionId = battalionIds.get(companyToBattalion.get(companyCode) ?? "");
    if (battalionId === undefined) continue;
    await repository.upsertCompany(companyCode, entry.companyNameTh, battalionId, order);
  }

  return { regions: regionOrder.size, battalions: battalionOrder.size, companies: companyOrder.size };
}
