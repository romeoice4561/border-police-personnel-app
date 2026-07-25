/**
 * Academy class (นรต.) hint resolution (Phase 51.1A).
 */
import type { ResolvedEntity } from "@/lib/personnel_entities/contracts";

export function resolveAcademyClassHint(query: string): ResolvedEntity | null {
  const match = query.match(/(?:นรต\.?|รุ่น)\s*(\d{2,4})/i);
  if (!match) return null;
  const year = match[1];
  return {
    type: "academy_class",
    canonicalId: `academy_class:${year}`,
    publicCode: year,
    displayName: `นรต.${year}`,
    aliases: [`นรต.${year}`, `นรต${year}`, `รุ่น ${year}`, `รุ่น${year}`],
    confidence: "exact",
    matchedText: match[0],
    remainingQuery: query.replace(match[0], " ").replace(/\s+/g, " ").trim(),
  };
}
