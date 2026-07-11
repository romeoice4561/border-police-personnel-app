/**
 * Organization master data (static framework).
 *
 * The ONLY source of truth for the static Border Patrol Division -> Battalion
 * -> Company hierarchy used by lib/organization/organization_generator.ts,
 * dropdown_options.ts, gallery_generator.ts, and organization_helpers.ts'
 * lookup functions (findBattalion, findDivision, getOrganizationPath, ...).
 *
 * This is a plain, hardcoded data module — no DB, no I/O, no React. It is
 * intentionally separate from the existing DB-backed Region/Battalion/Company
 * Prisma models and lib/organization/organization_seed.ts (which remain the
 * source of truth for Officer/Timeline's editable OrgHierarchyPicker flow).
 * See README.md in this folder for how the two systems relate.
 *
 * No organization codes are hardcoded anywhere else in the app going forward
 * for the use cases this framework covers (generated dropdowns, unit-name
 * builders, Gallery filters) — every new consumer reads through this file.
 */

export const HEADQUARTERS_NAME = "กองบัญชาการตำรวจตระเวนชายแดน" as const;
export const HEADQUARTERS_SHORT_NAME = "บช.ตชด." as const;

/**
 * Division ("Border Patrol Region N" / "ภาค N") code -> its battalion codes,
 * in display order.
 *
 * This framework represents the Border Patrol organization ONLY: Headquarters
 * + Regions 1-4 + their battalions/companies. Do not add Region 5-7 here —
 * those are not Border Patrol regions. A module that needs a broader,
 * non-Border-Patrol region list (e.g. Gallery's free-text Asset.region field,
 * which may reference any region) should keep its own list rather than
 * expanding this one — see gallery_region_options.ts.
 */
export const DIVISIONS: Record<string, readonly string[]> = {
  "1": ["11", "12", "13", "14"],
  "2": ["21", "22", "23", "24"],
  "3": ["31", "32", "33", "34"],
  "4": ["41", "42", "43", "44"],
};

/** Battalion code -> its company (number) codes, in display order. */
export const BATTALIONS: Record<string, readonly string[]> = {
  "11": ["114", "115", "116", "117"],
  "12": ["124", "125", "126", "127"],
  "13": ["134", "135", "136", "137"],
  "14": ["144", "145", "146", "147"],

  "21": ["214", "215", "216", "217"],
  "22": ["224", "225", "226", "227"],
  "23": ["234", "235", "236", "237"],
  "24": ["244", "245", "246", "247"],

  "31": ["314", "315", "316", "317"],
  "32": ["324", "325", "326", "327"],
  "33": ["334", "335", "336", "337"],
  "34": ["344", "345", "346", "347"],

  "41": ["414", "415", "416", "417"],
  "42": ["424", "425", "426", "427"],
  "43": ["434", "435", "436", "437"],
  "44": ["444", "445", "446", "447", "448", "449"],
};

/** Every division code, in display order. */
export const DIVISION_CODES: readonly string[] = Object.keys(DIVISIONS);

/** Every battalion code across every division, in display order. */
export const BATTALION_CODES: readonly string[] = DIVISION_CODES.flatMap((division) => DIVISIONS[division]);

/** Every company (number) code across every battalion, in display order. */
export const COMPANY_NUMBER_CODES: readonly string[] = BATTALION_CODES.flatMap((battalion) => BATTALIONS[battalion]);
