/**
 * Query / unit / name normalization for Personnel Search Gateway (Phase 51).
 * Deterministic — no AI, no fuzzy ML.
 */
import { normalizeSearchText, stripAllWhitespace } from "@/lib/search/query_normalization";
import type { NormalizedPersonQuery, NormalizedUnitRef, UnitLevel } from "@/lib/personnel_search/types";

/** Strip dots, commas, and collapse whitespace for unit token matching. */
export function normalizeUnitToken(value: string): string {
  return stripAllWhitespace(
    value
      .replace(/[.,·•_/\\-]+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

/**
 * Map Thai/English unit shorthand → canonical unit ref.
 * Examples: ร้อย414, ตชด.414, กก41, ภาค4
 */
export function normalizeUnitQuery(raw: string): NormalizedUnitRef | null {
  const token = normalizeUnitToken(raw);
  if (!token) return null;

  // Company / กองร้อย / ร้อย / ตชด.###
  const company =
    token.match(/^(?:กองร้อย|ร้อย|company|co)?(?:ตชด)?(\d{3,4})$/) ||
    token.match(/^(?:ตชด)(\d{3,4})$/) ||
    token.match(/^ร้อยตชด(\d{3,4})$/) ||
    token.match(/^กองร้อยตชด(\d{3,4})$/);
  if (company) {
    const number = Number(company[1]);
    return unitRef("company", number);
  }

  // Division / กองกำกับการ / กก
  const division =
    token.match(/^(?:กองกำกับการ|กองกำกับ|กกตชด|กก|division|div)(\d{1,3})$/) ||
    token.match(/^กก\.?ตชด\.?(\d{1,3})$/);
  // Also: กก41 after normalize strips dots → กก41
  const division2 = token.match(/^กก(\d{1,3})$/) || token.match(/^กองกำกับ(?:การ)?(\d{1,3})$/);
  const divMatch = division || division2;
  if (divMatch) {
    const number = Number(divMatch[1]);
    // 3–4 digit numbers are companies, not divisions
    if (number < 100 || String(number).length <= 2) {
      return unitRef("division", number);
    }
  }

  // Region / ภาค
  const region = token.match(/^(?:ภาค|region|reg)(\d{1,2})$/);
  if (region) {
    return unitRef("region", Number(region[1]));
  }

  return null;
}

function unitRef(level: UnitLevel, number: number): NormalizedUnitRef {
  if (level === "company") {
    return {
      level,
      number,
      key: `company:${number}`,
      labelTh: `กองร้อย ${number}`,
      labelEn: `Company ${number}`,
    };
  }
  if (level === "division") {
    return {
      level,
      number,
      key: `division:${number}`,
      labelTh: `กองกำกับการ ${number}`,
      labelEn: `Division ${number}`,
    };
  }
  return {
    level: "region",
    number,
    key: `region:${number}`,
    labelTh: `ภาค ${number}`,
    labelEn: `Region ${number}`,
  };
}

/** Normalize free-text person query into structured hints. */
export function normalizePersonQuery(raw: string): NormalizedPersonQuery {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  const normalized = normalizeSearchText(trimmed);
  const stripped = stripAllWhitespace(normalized);

  let rankHint: string | null = null;
  let rest = trimmed;

  const rankMatch = trimmed.match(
    /^(พ\.?ต\.?[ทตอ]|ร\.?ต\.?[ทตอ]|ด\.?ต\.?[ทตอ]|ส\.?ต\.?[ทตอ]|ว่าที่\s*ร\.?ต\.?[ทตอ]|Pol\.?\s*Lt\.?\s*Col\.?|Pol\.?\s*Maj\.?)\s+(.+)$/i
  );
  if (rankMatch) {
    rankHint = rankMatch[1].replace(/\s+/g, "");
    rest = rankMatch[2].trim();
  }

  const officerIdHint = /[ก-๙a-z0-9]+\/\d+/i.test(trimmed)
    ? trimmed.match(/[ก-๙a-z0-9]+\/\d+/i)?.[0] ?? null
    : null;

  const academy =
    rest.match(/(?:นรต\.?|รุ่น)\s*(\d{2,4})/i) || trimmed.match(/(?:นรต\.?|รุ่น)\s*(\d{2,4})/i);
  const academyClass = academy ? Number(academy[1]) : null;

  const nickMatch = rest.match(/(?:ชื่อเล่น|เล่น|nick(?:name)?)\s*([ก-๙a-z0-9]+)/i);
  const nickname = nickMatch ? nickMatch[1] : null;

  const namePart = rest
    .replace(/(?:ชื่อเล่น|เล่น|nick(?:name)?)\s*[ก-๙a-z0-9]+/i, "")
    .replace(/(?:นรต\.?|รุ่น)\s*\d{2,4}/i, "")
    .trim();

  const parts = namePart.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  return {
    raw: trimmed,
    normalized,
    stripped,
    firstName,
    lastName,
    nickname,
    rankHint,
    officerIdHint,
    academyClass,
    positionHint: null,
  };
}

export function collapsePunctuation(value: string): string {
  return value.replace(/[.,·•_/\\-]+/g, " ").replace(/\s+/g, " ").trim();
}

export { normalizeSearchText, stripAllWhitespace, fuzzyContains } from "@/lib/search/query_normalization";
