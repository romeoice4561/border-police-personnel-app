/**
 * BPP unit master for Create Case cascading selectors.
 *
 * Labels and Region → Battalion → Company mappings are copied exactly from
 * docs/reference/bpp-unit-master.txt. This module is a UI option source —
 * it is never imported into the production organization tables.
 *
 * Do not guess missing units. Do not infer a parent from a unit number when
 * the reference does not list that relationship.
 */

export const BPP_UNIT_MASTER: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  "บก.ตชด.ภาค 1": {
    "กก.ตชด.11": ["ร้อย ตชด.114", "ร้อย ตชด.115", "ร้อย ตชด.116", "ร้อย ตชด.117"],
    "กก.ตชด.12": ["ร้อย ตชด.124", "ร้อย ตชด.125", "ร้อย ตชด.126", "ร้อย ตชด.127"],
    "กก.ตชด.13": ["ร้อย ตชด.134", "ร้อย ตชด.135", "ร้อย ตชด.136", "ร้อย ตชด.137"],
    "กก.ตชด.14": ["ร้อย ตชด.144", "ร้อย ตชด.145", "ร้อย ตชด.146", "ร้อย ตชด.147"],
  },
  "บก.ตชด.ภาค 2": {
    "กก.ตชด.21": ["ร้อย ตชด.214", "ร้อย ตชด.215", "ร้อย ตชด.216", "ร้อย ตชด.217"],
    "กก.ตชด.22": ["ร้อย ตชด.224", "ร้อย ตชด.225", "ร้อย ตชด.226", "ร้อย ตชด.227"],
    "กก.ตชด.23": ["ร้อย ตชด.234", "ร้อย ตชด.235", "ร้อย ตชด.236", "ร้อย ตชด.237"],
    "กก.ตชด.24": ["ร้อย ตชด.244", "ร้อย ตชด.245", "ร้อย ตชด.246", "ร้อย ตชด.247"],
  },
  "บก.ตชด.ภาค 3": {
    "กก.ตชด.31": ["ร้อย ตชด.314", "ร้อย ตชด.315", "ร้อย ตชด.316", "ร้อย ตชด.317"],
    "กก.ตชด.32": ["ร้อย ตชด.324", "ร้อย ตชด.325", "ร้อย ตชด.326", "ร้อย ตชด.327"],
    "กก.ตชด.33": ["ร้อย ตชด.334", "ร้อย ตชด.335", "ร้อย ตชด.336", "ร้อย ตชด.337"],
    "กก.ตชด.34": ["ร้อย ตชด.344", "ร้อย ตชด.345", "ร้อย ตชด.346", "ร้อย ตชด.347"],
  },
  "บก.ตชด.ภาค 4": {
    "กก.ตชด.41": ["ร้อย ตชด.414", "ร้อย ตชด.415", "ร้อย ตชด.416", "ร้อย ตชด.417"],
    "กก.ตชด.42": ["ร้อย ตชด.424", "ร้อย ตชด.425", "ร้อย ตชด.426", "ร้อย ตชด.427"],
    "กก.ตชด.43": ["ร้อย ตชด.434", "ร้อย ตชด.435", "ร้อย ตชด.436", "ร้อย ตชด.437"],
    "กก.ตชด.44": ["ร้อย ตชด.444", "ร้อย ตชด.445", "ร้อย ตชด.446", "ร้อย ตชด.447", "ร้อย ตชด.448", "ร้อย ตชด.449"],
  },
};

export const BPP_REGION_LABELS: readonly string[] = Object.keys(BPP_UNIT_MASTER);

export function bppBattalionLabelsForRegion(regionLabel: string): readonly string[] {
  const battalions = BPP_UNIT_MASTER[regionLabel];
  return battalions ? Object.keys(battalions) : [];
}

export function bppCompanyLabelsForBattalion(regionLabel: string, battalionLabel: string): readonly string[] {
  return BPP_UNIT_MASTER[regionLabel]?.[battalionLabel] ?? [];
}

/** Parse the region digit from an exact-or-near BPP region label. Returns null when the label is not a known master region. */
export function bppRegionCodeFromLabel(regionLabel: string): string | null {
  const exact = regionLabel.trim();
  if (BPP_UNIT_MASTER[exact]) {
    const match = /ภาค\s*(\d+)/.exec(exact);
    return match ? match[1] : null;
  }
  return null;
}

export function bppBattalionCodeFromLabel(battalionLabel: string): string | null {
  const match = /^กก\.ตชด\.(\d{2})$/.exec(battalionLabel.trim());
  return match ? match[1] : null;
}

export function bppCompanyCodeFromLabel(companyLabel: string): string | null {
  const match = /^ร้อย ตชด\.(\d{3})$/.exec(companyLabel.trim());
  return match ? match[1] : null;
}
