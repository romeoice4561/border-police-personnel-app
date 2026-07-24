/**
 * Person lookup — names, nickname, rank+name, officerId, academy, position, unit.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PersonnelSearchEnrichment } from "@/lib/personnel_search/contracts";
import {
  compareByScoreThenDisambiguation,
  compareForDisambiguation,
  scorePersonMatch,
  type RankedPersonMatch,
} from "@/lib/personnel_search/ranking";

export function searchPersons(
  officers: CommanderQueryOfficer[],
  enrichmentById: ReadonlyMap<string, PersonnelSearchEnrichment>,
  query: string
): RankedPersonMatch[] {
  const matches: RankedPersonMatch[] = [];
  for (const officer of officers) {
    const enrichment = enrichmentById.get(officer.officerId) ?? {};
    const scored = scorePersonMatch(officer, enrichment, query);
    if (scored) matches.push(scored);
  }
  matches.sort(compareByScoreThenDisambiguation);
  return matches;
}

/** When multiple people share a first name (or query), never auto-pick. */
export function needsDisambiguation(matches: RankedPersonMatch[], query: string): boolean {
  if (matches.length <= 1) return false;
  // Exact unique officer id / unique full name → no disambiguation.
  const top = matches[0];
  if (top.matchKind === "exact_officer_id") {
    return matches.filter((m) => m.matchKind === "exact_officer_id" && m.matchScore === top.matchScore).length > 1;
  }
  if (top.matchKind === "exact_full_name") {
    const same = matches.filter(
      (m) =>
        m.officer.firstName === top.officer.firstName &&
        m.officer.lastName === top.officer.lastName
    );
    return same.length > 1;
  }
  // First-name / fuzzy clusters always disambiguate when >1.
  void query;
  return true;
}

export function sortDisambiguation(matches: RankedPersonMatch[]): RankedPersonMatch[] {
  return [...matches].sort(compareForDisambiguation);
}
