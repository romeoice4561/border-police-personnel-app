/**
 * Person Matching Engine (Phase DI-2 — Sections 10-12).
 *
 * Supersedes DI-1's minimal `findDrugPersonDuplicateCandidates` (Section 14)
 * with a structured, EXPLAINABLE signal engine. The engine's only job is to
 * answer "why might these be the same person?" — it never returns a verdict,
 * never auto-merges, and never fabricates a numeric probability (Section 12:
 * "ห้ามใช้ AI probability ปลอม"). Every signal names exactly which fields
 * matched and is bucketed into an explainable STRONG/MEDIUM/WEAK strength so
 * a caller (duplicate-check UI, review queue) can derive a HIGH/MEDIUM/LOW
 * confidence category purely from the signal list — the category is always a
 * deterministic function of the signals actually present, never a
 * free-standing score.
 *
 * Pure computation over rows already fetched by the repository layer — no
 * direct Prisma/DatabaseClient access here, so this module is trivially unit
 * testable and reusable from both the real-time duplicate-check endpoint AND
 * the Duplicate Review Queue's batch matching pass.
 */

import { normalizePhoneMatchingKey } from "@/lib/drug_intelligence/phone_matching_key";

export type DrugMatchSignalStrength = "STRONG" | "MEDIUM" | "WEAK";

export type DrugMatchSignalKind =
  | "IDENTIFIER_THAI_ID"
  | "IDENTIFIER_PASSPORT"
  | "IDENTIFIER_ALIEN_ID"
  | "IDENTIFIER_OTHER"
  | "PHONE_NUMBER"
  | "DEVICE_IMEI"
  | "VEHICLE_VIN"
  | "NAME_EXACT"
  | "ALIAS_MATCH"
  | "DATE_OF_BIRTH"
  | "SAME_CASE";

export interface DrugMatchSignal {
  kind: DrugMatchSignalKind;
  strength: DrugMatchSignalStrength;
  /** The concrete value that matched on both sides (e.g. the identifier value, the normalized phone key) — NOT masked here; masking is a presentation concern applied by the caller before display, same convention as every other DI-1/DI-2 sensitive field. */
  matchedValue: string;
}

export type DrugMatchConfidence = "HIGH" | "MEDIUM" | "LOW";

/**
 * Section 12: confidence is DERIVED from the signal set, never assigned
 * independently. Deliberately simple and auditable — a reviewer can always
 * re-derive "why HIGH" by reading the signal list themselves:
 *   HIGH   — at least one STRONG signal (an exact identifier match)
 *   MEDIUM — at least one MEDIUM signal (phone/device/vehicle overlap), no STRONG
 *   LOW    — only WEAK signals (name/alias/DOB/same-case), no STRONG or MEDIUM
 */
export function deriveMatchConfidence(signals: DrugMatchSignal[]): DrugMatchConfidence {
  if (signals.some((s) => s.strength === "STRONG")) return "HIGH";
  if (signals.some((s) => s.strength === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

const IDENTIFIER_SIGNAL_KIND: Record<string, DrugMatchSignalKind> = {
  THAI_ID: "IDENTIFIER_THAI_ID",
  PASSPORT: "IDENTIFIER_PASSPORT",
  ALIEN_ID: "IDENTIFIER_ALIEN_ID",
  OTHER: "IDENTIFIER_OTHER",
  UNKNOWN: "IDENTIFIER_OTHER",
};

/** Section 10: identifier-type match strength — UNKNOWN/OTHER never carries the same weight as a verified THAI_ID/PASSPORT/ALIEN_ID exact match. */
function identifierSignalStrength(type: string): DrugMatchSignalStrength {
  return type === "OTHER" || type === "UNKNOWN" ? "WEAK" : "STRONG";
}

/** One side's comparable identity signals — the shape both "an existing DrugPerson" and "a not-yet-created draft person" can be normalized into before comparison. */
export interface DrugMatchableIdentity {
  identifiers: Array<{ type: string; value: string }>;
  primaryFullName: string;
  aliases: string[];
  dateOfBirth: Date | null;
  normalizedPhones: string[];
  deviceImeis: string[];
  vehicleVins: string[];
  caseIds: string[];
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

/**
 * Compares two identities and returns every signal explaining a possible
 * match. Order is not significant (a ↔ b is symmetric); the caller decides
 * which side is "new" vs. "existing" for display purposes.
 */
export function computeDrugMatchSignals(a: DrugMatchableIdentity, b: DrugMatchableIdentity): DrugMatchSignal[] {
  const signals: DrugMatchSignal[] = [];

  // ── Identifiers (Section 10: Strong, except OTHER/UNKNOWN) ────────────
  for (const idA of a.identifiers) {
    const valueA = idA.value.trim();
    if (!valueA) continue;
    for (const idB of b.identifiers) {
      const valueB = idB.value.trim();
      if (!valueB) continue;
      if (idA.type === idB.type && valueA === valueB) {
        signals.push({
          kind: IDENTIFIER_SIGNAL_KIND[idA.type] ?? "IDENTIFIER_OTHER",
          strength: identifierSignalStrength(idA.type),
          matchedValue: valueA,
        });
      }
    }
  }

  // ── Phone (Section 10: Medium — normalized key equality) ───────────────
  for (const phoneA of a.normalizedPhones) {
    if (b.normalizedPhones.includes(phoneA)) {
      signals.push({ kind: "PHONE_NUMBER", strength: "MEDIUM", matchedValue: phoneA });
    }
  }

  // ── Device / IMEI (Section 10: Medium) ──────────────────────────────────
  for (const imeiA of a.deviceImeis) {
    if (imeiA && b.deviceImeis.includes(imeiA)) {
      signals.push({ kind: "DEVICE_IMEI", strength: "MEDIUM", matchedValue: imeiA });
    }
  }

  // ── Vehicle VIN (Section 10: Medium) ────────────────────────────────────
  for (const vinA of a.vehicleVins) {
    if (vinA && b.vehicleVins.includes(vinA)) {
      signals.push({ kind: "VEHICLE_VIN", strength: "MEDIUM", matchedValue: vinA });
    }
  }

  // ── Name (Section 10: Weak/supporting — exact normalized match only, no fuzzy) ──
  const nameA = normalizedName(a.primaryFullName);
  const nameB = normalizedName(b.primaryFullName);
  if (nameA && nameA === nameB) {
    signals.push({ kind: "NAME_EXACT", strength: "WEAK", matchedValue: a.primaryFullName.trim() });
  }

  // ── Alias (Section 10: Weak) — a's primary name or aliases against b's aliases, and vice versa ──
  const aNames = [a.primaryFullName, ...a.aliases].map(normalizedName).filter(Boolean);
  const bNames = [b.primaryFullName, ...b.aliases].map(normalizedName).filter(Boolean);
  const aliasMatchedNames = new Set<string>();
  for (const nA of aNames) {
    if (bNames.includes(nA) && nA !== nameA) aliasMatchedNames.add(nA);
  }
  for (const value of aliasMatchedNames) {
    signals.push({ kind: "ALIAS_MATCH", strength: "WEAK", matchedValue: value });
  }

  // ── Date of birth (Section 10: Weak/supporting on its own) ─────────────
  if (a.dateOfBirth && b.dateOfBirth && sameDay(a.dateOfBirth, b.dateOfBirth)) {
    signals.push({ kind: "DATE_OF_BIRTH", strength: "WEAK", matchedValue: a.dateOfBirth.toISOString().slice(0, 10) });
  }

  // ── Same case (Section 10: Weak — appearing together in a case is NOT identity evidence on its own) ──
  for (const caseIdA of a.caseIds) {
    if (b.caseIds.includes(caseIdA)) {
      signals.push({ kind: "SAME_CASE", strength: "WEAK", matchedValue: caseIdA });
    }
  }

  return signals;
}

/** Normalizes a raw phone input into the same matching-key space `computeDrugMatchSignals` compares on. */
export function toNormalizedPhoneKey(rawInput: string): string {
  return normalizePhoneMatchingKey(rawInput);
}
