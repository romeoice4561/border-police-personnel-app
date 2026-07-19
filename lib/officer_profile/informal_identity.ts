/**
 * Compact nickname + academy-class line for the officer profile hero.
 * Pure — no I/O. Does not invent values when both sides are empty.
 */

import type { Language } from "@/lib/i18n/dictionary";
import { isValidAcademyClass } from "@/lib/officer_profile/academy_class_options";

export interface OfficerInformalIdentityInput {
  nickname?: string | null;
  academyClass?: number | string | null;
}

/**
 * Normalize a stored academy class to an integer in the approved range.
 * Accepts 61, "61", "นรต.61", "นรต.รุ่น 61" — never doubles the prefix.
 */
export function normalizeAcademyClassValue(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return isValidAcademyClass(value) ? value : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(?:นรต\.?\s*(?:รุ่น\s*)?)?(\d{2,3})\s*$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return isValidAcademyClass(n) ? n : null;
}

/** Hero short form: "นรต.61" (not "นรต.รุ่น 61"). */
export function formatAcademyClassShortTh(academyClass: number): string {
  return `นรต.${academyClass}`;
}

export function formatAcademyClassShortEn(academyClass: number): string {
  return `Police Cadet Class ${academyClass}`;
}

/**
 * Builds the compact informal identity line, or null when there is nothing to show.
 *
 *   { nickname: "โตส", academyClass: 61 } → "โตส · นรต.61" (th)
 *   { nickname: "โตส", academyClass: null } → "โตส"
 *   { nickname: null, academyClass: 61 } → "นรต.61"
 *   { nickname: null, academyClass: null } → null
 */
export function formatOfficerInformalIdentity(
  input: OfficerInformalIdentityInput,
  language: Language = "th"
): string | null {
  const nickname = input.nickname?.trim() ?? "";
  const cls = normalizeAcademyClassValue(input.academyClass);
  const classPart =
    cls == null ? "" : language === "en" ? formatAcademyClassShortEn(cls) : formatAcademyClassShortTh(cls);

  if (nickname && classPart) return `${nickname} · ${classPart}`;
  if (nickname) return nickname;
  if (classPart) return classPart;
  return null;
}
