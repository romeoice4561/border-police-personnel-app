/**
 * Headquarters default values (Phase 26B Part C/H — top-level Royal Thai
 * Police organization master data).
 *
 * The default headquarters list every Headquarters dropdown offers as
 * suggestions — never a closed set (Part C explicitly allows custom values,
 * same convention as Rank/Position/Unit). `code` is a stable slug used only
 * to seed the Headquarters table (scripts/seed_headquarters.ts); the display
 * value everywhere else is `nameTh`.
 *
 * Pure data — no I/O, no React.
 */

export interface HeadquartersSeedEntry {
  code: string;
  nameTh: string;
  displayOrder: number;
}

export const HEADQUARTERS_DEFAULTS: readonly HeadquartersSeedEntry[] = [
  { code: "BPP", nameTh: "บช.ตชด.", displayOrder: 1 },
  { code: "MPB", nameTh: "บช.น.", displayOrder: 2 },
  { code: "PROV_1", nameTh: "ภ.1", displayOrder: 3 },
  { code: "PROV_2", nameTh: "ภ.2", displayOrder: 4 },
  { code: "PROV_3", nameTh: "ภ.3", displayOrder: 5 },
  { code: "PROV_4", nameTh: "ภ.4", displayOrder: 6 },
  { code: "PROV_5", nameTh: "ภ.5", displayOrder: 7 },
  { code: "PROV_6", nameTh: "ภ.6", displayOrder: 8 },
  { code: "PROV_7", nameTh: "ภ.7", displayOrder: 9 },
  { code: "PROV_8", nameTh: "ภ.8", displayOrder: 10 },
  { code: "PROV_9", nameTh: "ภ.9", displayOrder: 11 },
  { code: "CIB", nameTh: "บช.ก.", displayOrder: 12 },
  { code: "NSB", nameTh: "บช.ปส.", displayOrder: 13 },
  { code: "SB", nameTh: "บช.ส.", displayOrder: 14 },
  { code: "TD", nameTh: "บช.ทท.", displayOrder: 15 },
  { code: "CCIB", nameTh: "บช.สอท.", displayOrder: 16 },
  { code: "IMM", nameTh: "สตม.", displayOrder: 17 },
  { code: "EDU", nameTh: "บช.ศ.", displayOrder: 18 },
  { code: "RPCA", nameTh: "รร.นรต.", displayOrder: 19 },
  { code: "HOSP", nameTh: "รพ.ตร.", displayOrder: 20 },
  { code: "ACAD", nameTh: "สยศ.ตร.", displayOrder: 21 },
  { code: "LOGI", nameTh: "สกบ.", displayOrder: 22 },
  { code: "PERS", nameTh: "สกพ.", displayOrder: 23 },
  { code: "BUDGET", nameTh: "สงป.", displayOrder: 24 },
  { code: "LEGAL", nameTh: "กมค.", displayOrder: 25 },
  { code: "SECGEN", nameTh: "สง.ก.ตร.", displayOrder: 26 },
  { code: "INSPECT", nameTh: "จต.", displayOrder: 27 },
  { code: "AUDIT", nameTh: "สตส.", displayOrder: 28 },
  { code: "STRAT", nameTh: "สพฐ.ตร.", displayOrder: 29 },
  { code: "IT", nameTh: "สทส.", displayOrder: 30 },
];

/** Display-only list (nameTh), for suggestion-driven Comboboxes that don't need the code/displayOrder. */
export const HEADQUARTERS_OPTIONS: readonly string[] = HEADQUARTERS_DEFAULTS.map((h) => h.nameTh);
