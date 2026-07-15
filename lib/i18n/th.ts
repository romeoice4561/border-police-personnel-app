/**
 * Thai (default) projection of the full application dictionary (Phase 43).
 *
 * A convenience view mapping each translation key to its Thai string — what a
 * language provider returns when the active language is "th". Generated from
 * the single source of truth in dictionary.ts so the two can never drift. Also
 * re-exports the legacy Commander-only TH_LABELS for any existing importer.
 */

import { DICTIONARY, type TranslationKey } from "@/lib/i18n/dictionary";
import { COMMANDER_LABELS, type CommanderLabelKey } from "@/lib/i18n/labels";

export const TH_STRINGS: Record<TranslationKey, string> = Object.fromEntries(
  (Object.keys(DICTIONARY) as TranslationKey[]).map((key) => [key, DICTIONARY[key].th])
) as Record<TranslationKey, string>;

/** Legacy Commander-only projection (kept for backward compatibility). */
export const TH_LABELS: Record<CommanderLabelKey, string> = Object.fromEntries(
  (Object.keys(COMMANDER_LABELS) as CommanderLabelKey[]).map((key) => [key, COMMANDER_LABELS[key].th])
) as Record<CommanderLabelKey, string>;
