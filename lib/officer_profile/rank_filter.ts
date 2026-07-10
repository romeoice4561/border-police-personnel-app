/**
 * Rank filtering for the Rank filter dropdown (Phase 26A stabilization —
 * bug #2, "Rank selector must ONLY return ranks. Never mix them.").
 *
 * Mirrors unit_filter.ts's design exactly: a pure predicate that decides
 * whether a distinct `Officer.rank` value is a genuine rank designation
 * worth suggesting in the filter dropdown, versus OCR/data-entry pollution
 * that should NOT appear there — a rank string with a person's name or a
 * unit reference appended ("พ.ต.ท.ชลัช", "กองกำกับการโรงเรียนตำรวจภูธร 4"),
 * a phone number, or other garbage.
 *
 * This filters SUGGESTIONS ONLY — it never rewrites or deletes any officer's
 * stored rank. The stored value is unchanged; this only cleans the dropdown
 * list so it doesn't mix units/names/garbage in with real ranks.
 *
 * Pure — no I/O, no DB.
 */

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** A genuine rank token — Thai police rank abbreviations (ร.ต.ต., พ.ต.อ., ...), "ว่าที่" (acting) prefix, or the full Thai rank word. */
const RANK_TOKEN =
  /^(ว่าที่\s+)?((พล|พ|ร)\.?ต\.?(อ|ท|ต|น|ว|ด)?\.?|ด\.ต\.|จ\.ส\.ต\.|ส\.ต\.(อ|ท|ต)?\.?|Pol\.\s*(Lt\.|Capt\.|Col\.|Gen\.|Maj\.)|ร้อยตำรวจ(เอก|โท|ตรี)|จ่าสิบตำรวจ|ดาบตำรวจ|สิบตำรวจ(เอก|โท|ตรี)|พันตำรวจ(เอก|โท|ตรี)|พลตำรวจ(เอก|โท|ตรี)?)\.?$/;

/** Markers indicating the value embeds a UNIT reference, not just a rank — a unit token appended to a rank string. */
const UNIT_MARKERS = [/กก\.\s*ตชด\./, /ร้อย\s*ตชด\./, /บก\.\s*ตชด\./, /บช\.\s*ตชด\./, /ตชด\.\s*\d/, /กองกำกับ/, /โรงเรียน/, /กองร้อย/];

/** Obvious non-rank garbage: phone numbers, pure numbers, latin words beyond a rank abbreviation. */
const GARBAGE_MARKERS = [/\d{2,3}\s*-\s*\d/, /เบอร์|โทรศัพท์|โทร\s/, /^[0-9]+$/];

/**
 * True when `value` looks like a genuine rank designation worth suggesting.
 * A bare rank token (optionally "ว่าที่"-prefixed) passes; a rank with a
 * name, unit, or other text appended does not — real ranks are short,
 * standalone tokens, so anything longer than a plain rank word is treated
 * as polluted rather than guessed at.
 */
export function isValidRankValue(value: string): boolean {
  const v = clean(value);
  if (v.length === 0) return false;
  if (UNIT_MARKERS.some((re) => re.test(v))) return false;
  if (GARBAGE_MARKERS.some((re) => re.test(v))) return false;
  return RANK_TOKEN.test(v);
}

/** Filters a list of candidate rank strings down to genuine ranks, de-duplicated, preserving order. */
export function filterValidRanks(ranks: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of ranks) {
    const cleaned = clean(r);
    if (isValidRankValue(cleaned) && !seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}
