/**
 * Organization name generators (static framework).
 *
 * Pure functions that derive display names/lists from organization_master.ts
 * — no hardcoded unit names anywhere in this file, only the code lists from
 * the master data plus a formatting rule per level. Adding a new
 * battalion/company means editing organization_master.ts only; every
 * generator below picks it up automatically.
 */

import { BATTALION_CODES, COMPANY_NUMBER_CODES } from "@/lib/organization/organization_master";

/** "กก.ตชด.NN" for every battalion code, in master-data order. */
export function getBattalionOptions(): string[] {
  return BATTALION_CODES.map((code) => `กก.ตชด.${code}`);
}

/** "ร้อย ตชด.NNN" for every company code, in master-data order. */
export function getCompanyOptions(): string[] {
  return COMPANY_NUMBER_CODES.map((code) => `ร้อย ตชด.${code}`);
}

/** The bare 3-digit company number for every company, in master-data order. */
export function getCompanyNumberOptions(): string[] {
  return [...COMPANY_NUMBER_CODES];
}

/**
 * "{prefix}NNN" for every company number, e.g. prefix="ชปข." ->
 * ["ชปข.114", "ชปข.115", ...]. Works with ANY prefix — a plain string
 * concatenation with no per-prefix special-casing.
 */
export function getCompanyNameOptions(prefix: string): string[] {
  return COMPANY_NUMBER_CODES.map((code) => `${prefix}${code}`);
}

/**
 * "{prefix} NNN" (space-separated) for every company number, e.g.
 * prefix="แผนที่หน่วยข้างเคียง" -> ["แผนที่หน่วยข้างเคียง 114", ...].
 * Use this variant when the prefix is a full word/phrase that reads better
 * with a space before the number (getCompanyNameOptions concatenates
 * directly, matching prefixes like "ชปข." that already end in a period).
 */
export function getCompanyNameOptionsSpaced(prefix: string): string[] {
  return COMPANY_NUMBER_CODES.map((code) => `${prefix} ${code}`);
}
