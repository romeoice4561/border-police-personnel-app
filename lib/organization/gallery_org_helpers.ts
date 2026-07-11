/**
 * Gallery organization text helpers (Phase 27 Part 2/3/4/7).
 *
 * Gallery's Region/Battalion/Company fields (Asset.region/battalion/company)
 * are free-text labels, not id-linked like Officer/Timeline's OrgHierarchyPicker
 * (which cascades via OrgTree ids — see org_tree.ts's autoFillFromCompany/
 * autoFillFromBattalion/autoFillFromRegion). These helpers give Gallery's
 * Combobox fields the same cascading/auto-fill behavior, but working off the
 * label text itself, resolved against organization_master.ts via
 * organization_generator.ts/organization_helpers.ts — never a duplicated
 * unit list of its own.
 */

import { getBattalionOptions, getCompanyOptions } from "@/lib/organization/organization_generator";
import { findBattalion, findDivisionOfBattalion } from "@/lib/organization/organization_helpers";
import { BATTALIONS, DIVISIONS, COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";

const ALL_BATTALION_LABELS = getBattalionOptions();
const ALL_COMPANY_LABELS = getCompanyOptions();

/** Extracts the bare company number (e.g. "416") from a company label (e.g. "ร้อย ตชด.416"), or null if it isn't a recognized company. */
export function companyCodeFromLabel(label: string): string | null {
  const match = label.match(/(\d{3})/);
  if (!match) return null;
  const code = match[1];
  return COMPANY_NUMBER_CODES.includes(code) ? code : null;
}

/** Extracts the bare battalion number (e.g. "44") from a battalion label (e.g. "กก.ตชด.44"), or null if it isn't a recognized battalion. */
export function battalionCodeFromLabel(label: string): string | null {
  const match = label.match(/(\d{2})/);
  if (!match) return null;
  const code = match[1];
  return Object.prototype.hasOwnProperty.call(BATTALIONS, code) ? code : null;
}

/** Extracts the bare division/region number (e.g. "4") from a region label (e.g. "ภาค 4" or "ตชด.ภาค 4"), or null if it isn't a recognized Border Patrol region. */
export function divisionCodeFromLabel(label: string): string | null {
  const match = label.match(/(\d)/);
  if (!match) return null;
  const code = match[1];
  return Object.prototype.hasOwnProperty.call(DIVISIONS, code) ? code : null;
}

/** Battalion label suggestions scoped to a region (by its label text), or every battalion when the region doesn't resolve to a known Border Patrol division. */
export function battalionLabelsForRegion(regionLabel: string): readonly string[] {
  const divisionCode = divisionCodeFromLabel(regionLabel);
  if (!divisionCode) return ALL_BATTALION_LABELS;
  const battalionCodes = DIVISIONS[divisionCode] ?? [];
  return ALL_BATTALION_LABELS.filter((label) => {
    const code = battalionCodeFromLabel(label);
    return code !== null && battalionCodes.includes(code);
  });
}

/** Company label suggestions scoped to a battalion (by its label text), or every company when the battalion doesn't resolve to a known Border Patrol battalion. */
export function companyLabelsForBattalion(battalionLabel: string): readonly string[] {
  const battalionCode = battalionCodeFromLabel(battalionLabel);
  if (!battalionCode) return ALL_COMPANY_LABELS;
  const companyCodes = BATTALIONS[battalionCode] ?? [];
  return ALL_COMPANY_LABELS.filter((label) => {
    const code = companyCodeFromLabel(label);
    return code !== null && companyCodes.includes(code);
  });
}

export interface CompanyAutoFill {
  companyNumber: string;
  battalionLabel: string;
  divisionCode: string;
}

/** Given a selected company label, derives its bare unit number and ancestor battalion label — for auto-filling Unit Number / re-deriving the Battalion Combobox (Part 7). Returns null when the company doesn't resolve against the master hierarchy. */
export function autoFillFromCompanyLabel(companyLabel: string): CompanyAutoFill | null {
  const companyNumber = companyCodeFromLabel(companyLabel);
  if (!companyNumber) return null;
  const battalionCode = findBattalion(companyNumber);
  if (!battalionCode) return null;
  const divisionCode = findDivisionOfBattalion(battalionCode);
  if (!divisionCode) return null;
  return { companyNumber, battalionLabel: `กก.ตชด.${battalionCode}`, divisionCode };
}
