/**
 * English projection of the Commander Search dictionary (Phase 41 Part 7 —
 * i18n foundation).
 *
 * A convenience view mapping each label key to its English string. This is what
 * a future language provider would return when the active language is "en".
 * Generated from the single source of truth in labels.ts so the two can never
 * drift. (Not wired to the UI this phase — Thai remains the default and the
 * TH|EN toggle is a placeholder.)
 */

import { COMMANDER_LABELS, type CommanderLabelKey } from "@/lib/i18n/labels";

export const EN_LABELS: Record<CommanderLabelKey, string> = Object.fromEntries(
  (Object.keys(COMMANDER_LABELS) as CommanderLabelKey[]).map((key) => [key, COMMANDER_LABELS[key].en])
) as Record<CommanderLabelKey, string>;
