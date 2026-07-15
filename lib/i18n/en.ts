/**
 * English projection of the full application dictionary (Phase 43).
 *
 * A convenience view mapping each translation key to its English string — what
 * a language provider returns when the active language is "en". Generated from
 * the single source of truth in dictionary.ts so the two can never drift. Also
 * re-exports the legacy Commander-only EN_LABELS for any existing importer.
 */

import { DICTIONARY, type TranslationKey } from "@/lib/i18n/dictionary";
import { COMMANDER_LABELS, type CommanderLabelKey } from "@/lib/i18n/labels";

export const EN_STRINGS: Record<TranslationKey, string> = Object.fromEntries(
  (Object.keys(DICTIONARY) as TranslationKey[]).map((key) => [key, DICTIONARY[key].en])
) as Record<TranslationKey, string>;

/** Legacy Commander-only projection (kept for backward compatibility). */
export const EN_LABELS: Record<CommanderLabelKey, string> = Object.fromEntries(
  (Object.keys(COMMANDER_LABELS) as CommanderLabelKey[]).map((key) => [key, COMMANDER_LABELS[key].en])
) as Record<CommanderLabelKey, string>;
