/**
 * Tri-state (Yes / No / Not specified) control helpers (Phase 45.1 — Task 4).
 *
 * Membership fields (GPF/Police Funeral Welfare/Cooperative) must support an
 * honest "unknown" distinct from "no" — legacy records were never asked this
 * question, and defaulting an unchecked checkbox to false would silently
 * fabricate a "No" the source data never asserted. `TriState` is the wire/
 * draft representation used by every tri-state <Select>: "" means the
 * dropdown has no selection yet (only possible while editing before the
 * draft is initialized from a real value), "yes"/"no"/"unspecified" are the
 * three real states, mapping 1:1 to Boolean | null (true/false/null).
 *
 * Pure data — no I/O, no React.
 */

export type TriState = "yes" | "no" | "unspecified";

export function booleanToTriState(value: boolean | null | undefined): TriState {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unspecified";
}

export function triStateToBoolean(value: TriState | string): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export function isTriState(value: string): value is TriState {
  return value === "yes" || value === "no" || value === "unspecified";
}

/**
 * เป็น/ไม่เป็น/ไม่ระบุ — Yes/No/Not specified. Used by every membership
 * tri-state <Select> option list (Phase 45.1 refinement pass — "เป็น
 * สมาชิก กบข." reads naturally in Thai personnel-form usage, unlike the
 * original "ใช่/ไม่ใช่", which this pass replaces at the LABEL level only).
 * The underlying wire/stored values ("yes"/"no"/"unspecified" ->
 * true/false/null) are UNCHANGED — this is a display-string change, not a
 * schema or data migration.
 */
export const TRI_STATE_LABELS: Record<TriState, { th: string; en: string }> = {
  yes: { th: "เป็น", en: "Yes" },
  no: { th: "ไม่เป็น", en: "No" },
  unspecified: { th: "ไม่ระบุ", en: "Not specified" },
};

export const TRI_STATE_OPTIONS: readonly TriState[] = ["yes", "no", "unspecified"];
