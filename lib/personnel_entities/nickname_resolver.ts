/**
 * Nickname hint resolution (Phase 51.1A).
 * Actual nickname matching against enrichment remains in Gateway person search.
 */
import type { ResolvedEntity } from "@/lib/personnel_entities/contracts";

export function resolveNicknameHint(query: string): ResolvedEntity | null {
  const match = query.match(/(?:ชื่อเล่น|เล่น|nick(?:name)?)\s*([ก-๙a-z0-9]+)/i);
  if (!match) return null;
  const nickname = match[1];
  return {
    type: "nickname",
    canonicalId: `nickname:${nickname}`,
    publicCode: null,
    displayName: nickname,
    aliases: [nickname],
    confidence: "exact",
    matchedText: match[0],
    remainingQuery: query.replace(match[0], " ").replace(/\s+/g, " ").trim(),
  };
}
