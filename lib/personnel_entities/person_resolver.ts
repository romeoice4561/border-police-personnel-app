/**
 * Lightweight officer-id hint resolution (Phase 51.1A).
 * Full person ranking stays in the Gateway person search.
 */
import type { ResolvedEntity } from "@/lib/personnel_entities/contracts";

/** Detect an officer-id token (e.g. ภาค4/20) — does not load profiles. */
export function resolveOfficerIdHint(query: string): ResolvedEntity | null {
  const match = query.match(/([ก-๙a-z0-9]+)\/(\d+)/i);
  if (!match) return null;
  const officerId = match[0];
  return {
    type: "officer",
    canonicalId: `officer:${officerId}`,
    publicCode: officerId,
    displayName: officerId,
    aliases: [officerId],
    confidence: "exact",
    matchedText: officerId,
    remainingQuery: query.replace(officerId, " ").replace(/\s+/g, " ").trim(),
  };
}
