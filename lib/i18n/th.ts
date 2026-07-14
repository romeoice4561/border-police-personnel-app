/**
 * Thai (default) projection of the Commander Search dictionary (Phase 41 Part
 * 7 — i18n foundation).
 *
 * A convenience view mapping each label key to its Thai string. This is what a
 * future language provider would return when the active language is "th" (the
 * default). Generated from the single source of truth in labels.ts so the two
 * can never drift.
 */

import { COMMANDER_LABELS, type CommanderLabelKey } from "@/lib/i18n/labels";

export const TH_LABELS: Record<CommanderLabelKey, string> = Object.fromEntries(
  (Object.keys(COMMANDER_LABELS) as CommanderLabelKey[]).map((key) => [key, COMMANDER_LABELS[key].th])
) as Record<CommanderLabelKey, string>;
