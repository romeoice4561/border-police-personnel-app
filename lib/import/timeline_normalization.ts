/**
 * Timeline field normalization (Phase 23B — bugs #3/#5/#6).
 *
 * Pure, deterministic, idempotent normalization applied in the business layer
 * (importer + officer timeline save path) — the OCR/AI output itself is left
 * RAW and untouched (BPPI architecture: OCR → Import Normalization → Database
 * → Editor). It fixes two confirmed mixing defects:
 *
 *   #3 — a career-history row's `position` embeds the unit
 *        ("รอง ผกก.สส.บก.น.5" or "ผบ.มว.กก.ตชด.44") while `unit` is empty. The
 *        embedded unit segment is split out into `unit`.
 *   #5 — `position` and `unit` hold the SAME string (a duplicate). The
 *        duplicate is collapsed (position kept, unit cleared) so the same value
 *        is never shown twice.
 *
 * CONSERVATIVE BY DESIGN: it only splits at an UNAMBIGUOUS unit-prefix token
 * that begins at a clean boundary (string start or after whitespace). Thai
 * police strings are ambiguous — e.g. the position "ผกก." (ผู้กำกับการ)
 * visually contains "กก." (กองกำกับ) — so a unit prefix embedded MID-WORD is
 * never split; only a unit prefix at a word boundary is. Anything it cannot
 * split confidently is returned UNCHANGED. Running it twice yields the same
 * result (idempotent), and it never invents data.
 */

export interface RawTimelineFields {
  position: string | null | undefined;
  unit: string | null | undefined;
}

export interface NormalizedTimelineFields {
  position: string;
  unit: string | null;
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * Unit-segment start tokens, each requiring a clean left boundary (start of
 * string OR preceded by whitespace) so we never cut inside a role word.
 * Ordered longest/most-specific first. These are genuine Border Patrol / RTP
 * organizational prefixes — a role like "ผกก." / "รอง ผกก." never matches
 * because those tokens are not in this list and "กก." only matches after a
 * space (so "ผกก." mid-word is safe).
 */
const UNIT_START_TOKENS = [
  "กก.ตชด.",
  "ร้อย ตชด.",
  "ร้อยตชด.",
  "มว.ตชด.",
  "กองร้อย ตชด.",
  "กองกำกับการ",
  "กองกำกับ",
  "บก.ตชด.",
  "บช.ตชด.",
  "บก.",
  "บช.",
];

/**
 * Finds the earliest index at which a whitespace-bounded unit token begins,
 * or -1 if none. "Whitespace-bounded" = the token is at the string start or
 * immediately preceded by a space — this is what prevents the "ผกก." → "ผ" +
 * "กก." mid-word mis-split.
 */
function findUnitBoundary(text: string): number {
  let best = -1;
  for (const token of UNIT_START_TOKENS) {
    let from = 0;
    while (from <= text.length) {
      const idx = text.indexOf(token, from);
      if (idx === -1) break;
      const boundaryOk = idx === 0 || text[idx - 1] === " ";
      if (boundaryOk) {
        if (best === -1 || idx < best) best = idx;
        break;
      }
      from = idx + 1;
    }
  }
  return best;
}

/**
 * Normalizes one timeline row's position/unit. Deterministic + idempotent.
 *
 * - #5 duplicate: if position === unit, keep position, clear unit.
 * - #3 mixing: if unit is empty and position embeds a boundary-anchored unit
 *   token, split position into role-part + unit-part.
 * - Otherwise (unit already set, or no confident split) return as-is.
 */
export function normalizeTimelinePositionUnit(fields: RawTimelineFields): NormalizedTimelineFields {
  const position = clean(fields.position);
  const unit = clean(fields.unit);

  // #5 — exact duplicate: same value in both fields. Keep it once (position).
  if (unit.length > 0 && position === unit) {
    return { position, unit: null };
  }

  // If a unit is already present, the row is considered already-separated —
  // never re-split (keeps the function idempotent and avoids touching the
  // 1033 already-correct rows).
  if (unit.length > 0) {
    return { position, unit };
  }

  // #3 — unit empty: try to split an embedded unit out of the position.
  if (position.length > 0) {
    const boundary = findUnitBoundary(position);
    // boundary > 0 means there is a genuine role-part before the unit token;
    // boundary === 0 means the whole string IS the unit (no role) — leave it
    // as position rather than blanking the position field.
    if (boundary > 0) {
      const rolePart = position.slice(0, boundary).trim();
      const unitPart = position.slice(boundary).trim();
      if (rolePart.length > 0 && unitPart.length > 0) {
        return { position: rolePart, unit: unitPart };
      }
    }
  }

  return { position, unit: unit.length > 0 ? unit : null };
}
