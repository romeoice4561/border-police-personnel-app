/**
 * Border Patrol unit filtering (Phase 23B — bug #4).
 *
 * Pure predicate that decides whether a free-text `currentUnit` value from
 * the imported data is a genuine Border Patrol / Royal Thai Police unit,
 * versus OCR pollution that should NOT appear in the Unit combobox's
 * suggestions: bare ranks ("ร.ต.ต.", "พ.ต.อ."), rank-prefixed name strings
 * ("พ.ต.ท.อาคม การบรรจง ..."), schools ("รร.นรต.", "โรงเรียน..."), provinces
 * ("จว.สุรินทร์"), phone numbers, and other garbage ("ตำรวจ", "11", English).
 *
 * This filters SUGGESTIONS ONLY — it never rewrites or deletes any officer's
 * stored unit. The Unit field itself remains free text (a user can still type
 * any value); this only cleans the autocomplete list.
 *
 * Pure — no I/O, no DB.
 */

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Genuine BPP/RTP organizational unit tokens. A valid unit must contain one. */
const UNIT_TOKENS = [
  /กก\.\s*ตชด\./, // กองกำกับการ ตชด.
  /ร้อย\s*ตชด\./, // กองร้อย ตชด.
  /ร้อยตชด\./,
  /มว\.\s*ตชด\./, // หมวด ตชด.
  /บก\.\s*ตชด\./, // กองบังคับการ ตชด.
  /บช\.\s*ตชด\./, // กองบัญชาการ ตชด.
  /ตชด\.\s*\d/, // ตชด. followed by a number (unit number)
  /กองร้อย/,
  /กองกำกับ/,
  /กองบังคับการ/, // Phase 26A stabilization (bug #2): full-word บก. spelling, e.g. "กองบังคับการตำรวจตระเวนชายแดน"
  /กองบัญชาการ/, // full-word บช. spelling
  /ตำรวจตระเวนชายแดน/, // full-word "ตชด." spelling, with or without an abbreviation nearby
];

/** A leading rank marker — a value that STARTS with one is a rank/person string, not a unit. */
const LEADING_RANK = /^(พล\.ต\.|พ\.ต\.|ร\.ต\.|ด\.ต\.|จ\.ส\.ต\.|ส\.ต\.)/;

/** School / training-institution markers — never a Border Patrol operational unit. */
const SCHOOL_MARKERS = [/โรงเรียน/, /รร\./, /มหาวิทยาลัย/, /วิทยาลัย/, /ศูนย์ฝึก/, /ศฝร/, /สำเร็จการศึกษา/];

/** Obvious non-unit garbage: phone numbers, provinces/districts, plain "ตำรวจ", pure numbers, latin text. */
const GARBAGE_MARKERS = [
  /\d{2,3}\s*-\s*\d/, // phone-number-like
  /เบอร์|โทรศัพท์|โทร\s/, // phone labels
  /^จว\./, // province
  /^อ\./, // amphoe/district
  /^ตำรวจ$/,
  /^[0-9]+$/, // pure number
  /[A-Za-z]{3,}/, // latin words (e.g. "Border patrol police company")
];

/**
 * True when `value` looks like a genuine Border Patrol unit worth suggesting.
 * Requires a real unit token AND passes the rank/school/garbage exclusions.
 */
export function isValidBorderPatrolUnit(value: string): boolean {
  const v = clean(value);
  if (v.length === 0) return false;

  if (LEADING_RANK.test(v)) return false;
  if (SCHOOL_MARKERS.some((re) => re.test(v))) return false;
  if (GARBAGE_MARKERS.some((re) => re.test(v))) return false;

  return UNIT_TOKENS.some((re) => re.test(v));
}

/** Filters a list of candidate unit strings down to the valid Border Patrol units, de-duplicated, preserving order. */
export function filterValidBorderPatrolUnits(units: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of units) {
    const cleaned = clean(u);
    if (isValidBorderPatrolUnit(cleaned) && !seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}
