/**
 * Asset metadata parsers (Phase 19A — Gallery Foundation).
 *
 * Pure functions that derive an asset's organizational metadata from the Drive
 * FOLDER HIERARCHY — never from OCR or image content. Given the folder chain an
 * asset lives under (root-first folder names) and/or individual folder names,
 * they extract:
 *   - region:    "ภาค N" (from a semantic top-level folder like
 *                "Profile รายบุคคล ภาค 1" or "แผนที่หน่วยข้างเคียง ภาค 2");
 *   - company:   "ตชด.NNN" (a company subfolder under แผนที่ตั้งกองร้อย);
 *   - battalion: "กก.ตชด.NN" (a battalion subfolder under แผนที่ตั้ง กองกำกับ ตชด).
 *
 * Each returns null when the pattern is absent (never guessed). No I/O, no OCR,
 * no AI, no globals.
 */

/** "ภาค" followed by digits (whitespace-tolerant): "ภาค 1", "ภาค  12". */
const REGION_PATTERN = /ภาค\s*([0-9๐-๙]+)/;
/**
 * A company unit token: "ตชด." + digits, e.g. "ตชด.447". The negative lookbehind
 * excludes the "กก.ตชด." battalion form. No `\b` here — Thai characters are not
 * JS "word" characters, so `\b` before ตชด never matches.
 */
const COMPANY_PATTERN = /(?<!กก\.)ตชด\.\s*([0-9๐-๙]+)/;
/** A battalion unit token: "กก.ตชด." + digits, e.g. "กก.ตชด.44". */
const BATTALION_PATTERN = /กก\.\s*ตชด\.\s*([0-9๐-๙]+)/;

const THAI_DIGITS: Record<string, string> = {
  "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
  "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9",
};

function toArabic(value: string): string {
  return value.replace(/[๐-๙]/g, (d) => THAI_DIGITS[d] ?? d);
}

function normalize(name: string | null | undefined): string {
  return typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
}

/**
 * Extracts the region ("ภาค N") from any folder name in the chain. Scans the
 * chain (top-level first) and returns the first match, so a nested asset under
 * "แผนที่ตั้งกองร้อย/ตชด.447" still inherits a region if any ancestor names one.
 */
export function extractRegion(folderChainNames: Array<string | null | undefined>): string | null {
  for (const raw of folderChainNames) {
    const name = normalize(raw);
    const m = name.match(REGION_PATTERN);
    if (m) return `ภาค ${toArabic(m[1])}`;
  }
  return null;
}

/** Extracts a company unit ("ตชด.NNN") from any folder name in the chain, else null. */
export function extractCompany(folderChainNames: Array<string | null | undefined>): string | null {
  for (const raw of folderChainNames) {
    const name = normalize(raw);
    // Skip battalion-form tokens so "กก.ตชด.44" is not read as company "ตชด.44".
    if (BATTALION_PATTERN.test(name)) continue;
    const m = name.match(COMPANY_PATTERN);
    if (m) return `ตชด.${toArabic(m[1])}`;
  }
  return null;
}

/** Extracts a battalion unit ("กก.ตชด.NN") from any folder name in the chain, else null. */
export function extractBattalion(folderChainNames: Array<string | null | undefined>): string | null {
  for (const raw of folderChainNames) {
    const name = normalize(raw);
    const m = name.match(BATTALION_PATTERN);
    if (m) return `กก.ตชด.${toArabic(m[1])}`;
  }
  return null;
}

/** The organizational metadata parsed from a folder chain. */
export interface ParsedAssetPlacement {
  region: string | null;
  company: string | null;
  battalion: string | null;
}

/**
 * Convenience: derive all three placement fields from a folder chain in one
 * call. The chain is root-first folder NAMES (the relative-path segments).
 */
export function parseAssetPlacement(folderChainNames: Array<string | null | undefined>): ParsedAssetPlacement {
  return {
    region: extractRegion(folderChainNames),
    company: extractCompany(folderChainNames),
    battalion: extractBattalion(folderChainNames),
  };
}
