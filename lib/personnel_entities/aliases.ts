/**
 * Centralized alias generation & matching for personnel entities (Phase 51.1A).
 * Do not hard-code aliases inside search_unit / gateway logic.
 */
import { stripAllWhitespace } from "@/lib/search/query_normalization";

/** Normalize a free-text token for alias lookup (punctuation / spacing insensitive). */
export function normalizeAliasKey(value: string): string {
  return stripAllWhitespace(
    value
      .replace(/[.,·•_/\\-]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

export function uniqueAliases(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const trimmed = raw.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const key = normalizeAliasKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** Standard company aliases for a public code (e.g. 414). */
export function companyAliasesForCode(publicCode: string, displayName?: string): string[] {
  const c = publicCode.trim();
  return uniqueAliases([
    c,
    `${c}.`,
    `${c}/`,
    `ร้อย${c}`,
    `ร้อย ${c}`,
    `ตชด${c}`,
    `ตชด.${c}`,
    `ตชด ${c}`,
    `กองร้อย${c}`,
    `กองร้อย ${c}`,
    `ร้อยตชด${c}`,
    `ร้อย ตชด.${c}`,
    `กองร้อยตชด${c}`,
    `กองร้อย ตชด.${c}`,
    `company${c}`,
    `co${c}`,
    displayName ?? "",
  ]);
}

/** Standard division (battalion) aliases for a public code (e.g. 41). */
export function divisionAliasesForCode(publicCode: string, displayName?: string): string[] {
  const c = publicCode.trim();
  return uniqueAliases([
    c,
    `กก${c}`,
    `กก ${c}`,
    `กก.${c}`,
    `กก. ${c}`,
    `กกตชด${c}`,
    `กก.ตชด.${c}`,
    `กก.ตชด ${c}`,
    `กองกำกับ${c}`,
    `กองกำกับ ${c}`,
    `กองกำกับการ${c}`,
    `กองกำกับการ ${c}`,
    `division${c}`,
    `div${c}`,
    displayName ?? "",
  ]);
}

/** Standard region aliases for a public code (e.g. 4). */
export function regionAliasesForCode(publicCode: string, displayName?: string): string[] {
  const c = publicCode.trim();
  return uniqueAliases([
    c,
    `ภาค${c}`,
    `ภาค ${c}`,
    `region${c}`,
    `region ${c}`,
    `reg${c}`,
    `ตชดภาค${c}`,
    `ตชด.ภาค ${c}`,
    `ตชด.ภาค${c}`,
    displayName ?? "",
  ]);
}

/**
 * Build a lookup map: normalized alias key → entity record indices.
 * Multiple indices under one key mean ambiguity.
 */
export function buildAliasIndex<T extends { aliases: readonly string[] }>(
  records: readonly T[]
): Map<string, number[]> {
  const index = new Map<string, number[]>();
  records.forEach((record, i) => {
    for (const alias of record.aliases) {
      const key = normalizeAliasKey(alias);
      if (!key) continue;
      const list = index.get(key) ?? [];
      if (!list.includes(i)) list.push(i);
      index.set(key, list);
    }
  });
  return index;
}
