/**
 * Thai police rank options (Phase 23A — Officer Profile Workspace, Section 2).
 *
 * The standard Royal Thai Police rank list, each also available in a
 * "...หญิง" (female) form. Shared between the Zod validation schema (server)
 * and the rank Select control (client) so there is exactly one source of
 * truth for "what is a valid rank" — never a free-text field.
 *
 * Pure data — no I/O, no React.
 */

/** Base ranks, highest to lowest, before the "หญิง" variant is generated. */
const BASE_RANKS = [
  "พล.ต.อ.",
  "พล.ต.ท.",
  "พล.ต.ต.",
  "พ.ต.อ.",
  "พ.ต.ท.",
  "พ.ต.ต.",
  "ร.ต.อ.",
  "ร.ต.ท.",
  "ร.ต.ต.",
  "ด.ต.",
  "จ.ส.ต.",
  "ส.ต.อ.",
  "ส.ต.ท.",
  "ส.ต.ต.",
] as const;

/** Every valid rank, including each base rank's "หญิง" (female) form, in display order. */
export const RANK_OPTIONS: readonly string[] = BASE_RANKS.flatMap((rank) => [rank, `${rank}หญิง`]);

const RANK_OPTION_SET = new Set(RANK_OPTIONS);

/** True when `value` is one of the standard ranks (including a "หญิง" form). */
export function isValidRank(value: string): boolean {
  return RANK_OPTION_SET.has(value);
}
