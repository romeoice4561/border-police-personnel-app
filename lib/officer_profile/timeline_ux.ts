/**
 * Timeline editor UX helpers (Phase 45 — Timeline Workspace UX).
 *
 * PURE functions — no React, no I/O, no business logic. They power the
 * presentation-only Timeline editor refactor: reordering rows, deriving a
 * per-card save status, non-blocking validation warnings, and keeping the two
 * legacy verification columns in sync from the single UI control.
 *
 * IMPORTANT: nothing here changes persistence or any engine. The save mapping
 * in useOfficerWorkspace still assigns `sequence: i` from array order, so these
 * helpers only reorder the in-memory draft array the editor already owns.
 */

import type { TimelineDraftRow } from "@/components/officer/use_officer_workspace";
import {
  VERIFICATION_STATUS_META,
  isValidTimelineVerificationStatus,
  type TimelineVerificationStatus,
} from "@/lib/officer_profile/verification_options";

// ── Reordering (Part 7 / 8) ────────────────────────────────────────────────

/** Immutably moves the item at `from` to `to`, clamping indices. Returns a new array (drag-and-drop can call this later with any from/to). */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(to, next.length - 1));
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/** Moves the row at `index` up one position (no-op at the top). */
export function moveUp<T>(items: readonly T[], index: number): T[] {
  return index <= 0 ? [...items] : reorder(items, index, index - 1);
}

/** Moves the row at `index` down one position (no-op at the bottom). */
export function moveDown<T>(items: readonly T[], index: number): T[] {
  return index >= items.length - 1 ? [...items] : reorder(items, index, index + 1);
}

// ── Per-card save status (Part 5 / 7) ──────────────────────────────────────

export type TimelineCardStatus = "draft" | "saving" | "error" | "saved";

/**
 * Derives a single card's status from the REAL save signals the workspace
 * already exposes — no fabricated state:
 *   • saving  — a save request is in flight
 *   • error   — the last save failed
 *   • draft   — a row that has never been persisted (client-only `draft-*` key)
 *   • saved   — otherwise (loaded from / written to the server)
 */
export function deriveCardStatus(row: { key: string }, opts: { isSaving?: boolean; hasError?: boolean }): TimelineCardStatus {
  if (opts.isSaving) return "saving";
  if (opts.hasError) return "error";
  if (row.key.startsWith("draft-")) return "draft";
  return "saved";
}

// ── Verification sync (Part 6) ─────────────────────────────────────────────

/** The three legacy free-text `verified` values. */
export const LEGACY_VERIFIED_UNCHECKED = "ยังไม่ตรวจ";
export const LEGACY_VERIFIED_CHECKED = "ตรวจแล้ว";
export const LEGACY_VERIFIED_CONFIRMED = "ยืนยันแล้ว";

/**
 * Maps the structured 4-value verificationStatus onto the legacy free-text
 * `verified` column so BOTH stay consistent when the single UI control changes
 * (Part 6 — one control, two synced columns, no schema/API change):
 *   VERIFIED      → ยืนยันแล้ว
 *   PENDING       → ตรวจแล้ว
 *   NEEDS_REVIEW  → ตรวจแล้ว
 *   REJECTED      → ยังไม่ตรวจ
 *   (unset)       → ยังไม่ตรวจ
 */
export function legacyVerifiedFromStatus(verificationStatus: string): string {
  if (!isValidTimelineVerificationStatus(verificationStatus)) return LEGACY_VERIFIED_UNCHECKED;
  switch (verificationStatus as TimelineVerificationStatus) {
    case "VERIFIED":
      return LEGACY_VERIFIED_CONFIRMED;
    case "PENDING":
    case "NEEDS_REVIEW":
      return LEGACY_VERIFIED_CHECKED;
    case "REJECTED":
      return LEGACY_VERIFIED_UNCHECKED;
  }
}

/** The bilingual label + tone for a verificationStatus, or null when unset — for the single read-mode badge. */
export function verificationBadgeMeta(verificationStatus: string): { labelTh: string; labelEn: string; tone: "good" | "serious" | "critical" | "accent" } | null {
  if (!isValidTimelineVerificationStatus(verificationStatus)) return null;
  const meta = VERIFICATION_STATUS_META[verificationStatus as TimelineVerificationStatus];
  return { labelTh: meta.labelTh, labelEn: meta.labelEn, tone: meta.color };
}

// ── Validation warnings (Part 8 / 9) — advisory, NEVER blocks save ─────────

export type TimelineWarningCode =
  | "MULTIPLE_CURRENT"
  | "YEAR_ORDER"
  | "OVERLAPPING_PERIOD"
  | "MISSING_FIELDS";

export interface TimelineWarning {
  code: TimelineWarningCode;
  /** Draft row keys the warning refers to (for highlighting), when applicable. */
  rowKeys: string[];
}

/** A row "has a year" when its structured yearBE is set. */
function hasYear(row: TimelineDraftRow): boolean {
  return row.yearBE != null;
}

/**
 * Derives non-blocking advisory warnings over the draft rows, in DISPLAY order
 * (the array order the editor shows, which becomes `sequence` on save):
 *   • MULTIPLE_CURRENT   — more than one row marked isPresent.
 *   • YEAR_ORDER         — a row's year is EARLIER than a row shown above it
 *                          (timeline should read oldest→newest or newest→oldest
 *                          consistently; a local inversion is flagged).
 *   • OVERLAPPING_PERIOD — two rows share the exact same yearBE (possible
 *                          duplicate/overlap the user may want to review).
 *   • MISSING_FIELDS     — a row is missing a year OR a position (the two
 *                          fields every timeline entry needs to be meaningful).
 * Never throws; returns [] for empty input.
 */
export function deriveTimelineWarnings(rows: readonly TimelineDraftRow[]): TimelineWarning[] {
  const warnings: TimelineWarning[] = [];
  if (rows.length === 0) return warnings;

  // MULTIPLE_CURRENT
  const currentRows = rows.filter((r) => r.isPresent);
  if (currentRows.length > 1) {
    warnings.push({ code: "MULTIPLE_CURRENT", rowKeys: currentRows.map((r) => r.key) });
  }

  // MISSING_FIELDS — a row with neither a structured year nor a legacy year,
  // or with no position text, is incomplete.
  const missing = rows.filter((r) => (!hasYear(r) && !r.year.trim()) || !r.position.trim());
  if (missing.length > 0) {
    warnings.push({ code: "MISSING_FIELDS", rowKeys: missing.map((r) => r.key) });
  }

  // OVERLAPPING_PERIOD — duplicate yearBE among dated rows.
  const byYear = new Map<number, string[]>();
  for (const r of rows) {
    if (r.yearBE == null) continue;
    const keys = byYear.get(r.yearBE) ?? [];
    keys.push(r.key);
    byYear.set(r.yearBE, keys);
  }
  const overlapping = [...byYear.values()].filter((keys) => keys.length > 1).flat();
  if (overlapping.length > 0) {
    warnings.push({ code: "OVERLAPPING_PERIOD", rowKeys: overlapping });
  }

  // YEAR_ORDER — detect a local inversion relative to the dominant direction.
  // Compare consecutive DATED rows; if some go up and some go down, the order
  // is inconsistent. We flag the rows that break the dominant monotonic run.
  const dated = rows.filter((r) => r.yearBE != null) as Array<TimelineDraftRow & { yearBE: number }>;
  if (dated.length >= 2) {
    let ascPairs = 0;
    let descPairs = 0;
    for (let i = 1; i < dated.length; i += 1) {
      if (dated[i].yearBE > dated[i - 1].yearBE) ascPairs += 1;
      else if (dated[i].yearBE < dated[i - 1].yearBE) descPairs += 1;
    }
    if (ascPairs > 0 && descPairs > 0) {
      // Mixed direction — flag rows that violate the dominant direction.
      const ascending = ascPairs >= descPairs;
      const offenders: string[] = [];
      for (let i = 1; i < dated.length; i += 1) {
        const goesUp = dated[i].yearBE > dated[i - 1].yearBE;
        const goesDown = dated[i].yearBE < dated[i - 1].yearBE;
        if ((ascending && goesDown) || (!ascending && goesUp)) {
          offenders.push(dated[i - 1].key, dated[i].key);
        }
      }
      if (offenders.length > 0) {
        warnings.push({ code: "YEAR_ORDER", rowKeys: [...new Set(offenders)] });
      }
    }
  }

  return warnings;
}
