/**
 * Commander Search presets (Phase 41 Part 5).
 *
 * A preset is a named, one-click producer of a complete CommanderQueryFilters
 * object — "ผู้ครบขึ้น สารวัตร", "ผู้ใกล้เกษียณ", "ผู้มีสิทธิ์ 2 ขั้น", … Each
 * reuses the SAME filter fields the manual query builder sets (no duplicated
 * matching logic — applying a preset is identical to the user setting those
 * fields by hand), so the results table, summary and charts all react to a
 * preset exactly as they would to a manual filter change.
 *
 * Pure data — no React, no I/O. Labels are bilingual so the i18n layer can
 * render either language later.
 */

import type { CommanderQueryFilters } from "@/components/commander/query/types";
import { PROMOTION_TARGET_LEVELS } from "@/lib/promotion/eligibility_policy";

export interface CommanderPreset {
  id: string;
  labelTh: string;
  labelEn: string;
  /** Produces the full filter set this preset applies (replacing any current filters). */
  filters: CommanderQueryFilters;
}

/** "ผู้ครบขึ้น <level>" — officers eligible NOW (or overdue) to advance INTO <level>. One per configured target level. */
const readyToAdvancePresets: CommanderPreset[] = PROMOTION_TARGET_LEVELS.map((level) => ({
  id: `ready-${level}`,
  labelTh: `ผู้ครบขึ้น ${level}`,
  labelEn: `Ready for ${level}`,
  filters: { toPositionLevel: level, eligibilityStatus: "eligible_now" },
}));

/** The fixed (non-level) presets from Part 5. Each maps to existing filter fields / flag codes / salary signals. */
const fixedPresets: CommanderPreset[] = [
  {
    id: "near-retirement",
    labelTh: "ผู้ใกล้เกษียณ",
    labelEn: "Near retirement",
    filters: { flagCode: "RETIRING_SOON" },
  },
  {
    id: "eligible-two-step",
    labelTh: "ผู้มีสิทธิ์ 2 ขั้น",
    labelEn: "Eligible for two-step",
    filters: { eligibleTwoStepOnly: true },
  },
  {
    id: "must-skip-step",
    labelTh: "ผู้ต้องเว้นขั้น",
    labelEn: "Must skip a step",
    filters: { mustSkipStepOnly: true },
  },
  {
    id: "missing-gp7",
    labelTh: "ผู้ขาด ก.พ.7",
    labelEn: "Missing GP7",
    filters: { missingGp7Only: true },
  },
  {
    id: "missing-documents",
    labelTh: "ผู้ขาดเอกสาร",
    labelEn: "Missing documents",
    filters: { flagCode: "DOCUMENTS_MISSING" },
  },
  {
    id: "missing-training",
    labelTh: "ผู้ขาดหลักสูตร",
    labelEn: "Missing training",
    filters: { flagCode: "NEEDS_TRAINING" },
  },
  {
    id: "missing-portrait",
    labelTh: "ผู้ไม่มีรูปโปรไฟล์",
    labelEn: "Missing profile photo",
    filters: { flagCode: "MISSING_OFFICIAL_PORTRAIT" },
  },
];

export const COMMANDER_PRESETS: readonly CommanderPreset[] = [...readyToAdvancePresets, ...fixedPresets];
