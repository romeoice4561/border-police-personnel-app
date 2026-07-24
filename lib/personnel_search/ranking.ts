/**
 * Deterministic match ranking (Phase 51). Never AI / ML.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PersonnelSearchEnrichment } from "@/lib/personnel_search/contracts";
import {
  fuzzyContains,
  normalizePersonQuery,
  normalizeSearchText,
  stripAllWhitespace,
} from "@/lib/personnel_search/normalizer";
import type { MatchKind } from "@/lib/personnel_search/types";

export interface RankedPersonMatch {
  officer: CommanderQueryOfficer;
  enrichment: PersonnelSearchEnrichment;
  matchKind: MatchKind;
  matchScore: number;
}

const MATCH_WEIGHT: Record<MatchKind, number> = {
  exact_officer_id: 1000,
  exact_full_name: 900,
  exact_nickname: 800,
  exact_unit: 700,
  prefix: 500,
  fuzzy: 300,
  field: 200,
};

/** Thai police rank seniority — higher = more senior (disambiguation order). */
const RANK_SENIORITY: Record<string, number> = {
  "พ.ต.อ.": 90,
  "พ.ต.ท.": 80,
  "พ.ต.ต.": 70,
  "ร.ต.อ.": 60,
  "ร.ต.ท.": 50,
  "ร.ต.ต.": 40,
  "ด.ต.": 30,
  "จ.ส.ต.": 25,
  "ส.ต.อ.": 20,
  "ส.ต.ท.": 15,
  "ส.ต.ต.": 10,
};

export function rankSeniority(rank: string): number {
  const key = rank.replace(/\s+/g, "");
  if (RANK_SENIORITY[key] != null) return RANK_SENIORITY[key];
  for (const [k, v] of Object.entries(RANK_SENIORITY)) {
    if (key.includes(k.replace(/\./g, "")) || key.includes(k)) return v;
  }
  return 0;
}

export function scorePersonMatch(
  officer: CommanderQueryOfficer,
  enrichment: PersonnelSearchEnrichment,
  query: string
): RankedPersonMatch | null {
  const person = normalizePersonQuery(query);
  const qNorm = person.normalized;
  const qStrip = person.stripped;
  if (!qNorm && !person.officerIdHint) return null;

  const fullName = normalizeSearchText(`${officer.firstName} ${officer.lastName}`);
  const fullStrip = stripAllWhitespace(fullName);
  const display = normalizeSearchText(officer.displayName);
  const nick = enrichment.nickname ? normalizeSearchText(enrichment.nickname) : "";
  const officerIdNorm = normalizeSearchText(officer.officerId);
  const unitNorm = normalizeSearchText(
    [officer.companyLabel, officer.currentUnit, String(officer.companyId ?? "")].filter(Boolean).join(" ")
  );

  let matchKind: MatchKind | null = null;
  let matchScore = 0;

  if (person.officerIdHint && normalizeSearchText(person.officerIdHint) === officerIdNorm) {
    matchKind = "exact_officer_id";
    matchScore = MATCH_WEIGHT.exact_officer_id;
  } else if (qNorm === officerIdNorm || qStrip === stripAllWhitespace(officerIdNorm)) {
    matchKind = "exact_officer_id";
    matchScore = MATCH_WEIGHT.exact_officer_id;
  } else if (qNorm === fullName || qNorm === display || qStrip === fullStrip) {
    matchKind = "exact_full_name";
    matchScore = MATCH_WEIGHT.exact_full_name;
  } else if (nick && (qNorm === nick || person.nickname === enrichment.nickname)) {
    matchKind = "exact_nickname";
    matchScore = MATCH_WEIGHT.exact_nickname;
  } else if (
    person.firstName &&
    !person.lastName &&
    normalizeSearchText(officer.firstName) === normalizeSearchText(person.firstName)
  ) {
    // First-name-only hit — treated as prefix-tier for ranking, disambiguation later.
    matchKind = "prefix";
    matchScore = MATCH_WEIGHT.prefix + 50;
  } else if (
    person.firstName &&
    person.lastName &&
    normalizeSearchText(officer.firstName) === normalizeSearchText(person.firstName) &&
    normalizeSearchText(officer.lastName) === normalizeSearchText(person.lastName)
  ) {
    matchKind = "exact_full_name";
    matchScore = MATCH_WEIGHT.exact_full_name;
  } else if (unitNorm && (qNorm === unitNorm || stripAllWhitespace(unitNorm).includes(qStrip))) {
    // Exact unit label / company number as person search is weaker than name.
    if (String(officer.companyId ?? "") === qStrip || stripAllWhitespace(officer.companyLabel).includes(qStrip)) {
      matchKind = "exact_unit";
      matchScore = MATCH_WEIGHT.exact_unit;
    }
  }

  if (!matchKind) {
    if (
      fullName.startsWith(qNorm) ||
      display.startsWith(qNorm) ||
      normalizeSearchText(officer.firstName).startsWith(qNorm) ||
      normalizeSearchText(officer.lastName).startsWith(qNorm) ||
      (nick && nick.startsWith(qNorm))
    ) {
      matchKind = "prefix";
      matchScore = MATCH_WEIGHT.prefix;
    } else if (
      fuzzyContains(fullName, qNorm) ||
      fuzzyContains(display, qNorm) ||
      fuzzyContains(officer.officerId, qNorm) ||
      (nick && fuzzyContains(nick, qNorm)) ||
      (officer.currentPosition && fuzzyContains(officer.currentPosition, qNorm)) ||
      fuzzyContains(unitNorm, qNorm)
    ) {
      matchKind = "fuzzy";
      matchScore = MATCH_WEIGHT.fuzzy;
    } else if (
      person.academyClass != null &&
      officer.academyClass === person.academyClass
    ) {
      matchKind = "field";
      matchScore = MATCH_WEIGHT.field;
    } else if (
      person.rankHint &&
      stripAllWhitespace(officer.rank).includes(stripAllWhitespace(person.rankHint))
    ) {
      matchKind = "field";
      matchScore = MATCH_WEIGHT.field;
    }
  }

  if (!matchKind) return null;

  // Small boosts for aligning secondary hints.
  if (person.rankHint && stripAllWhitespace(officer.rank).includes(stripAllWhitespace(person.rankHint))) {
    matchScore += 10;
  }
  if (person.academyClass != null && officer.academyClass === person.academyClass) {
    matchScore += 10;
  }

  return { officer, enrichment, matchKind, matchScore };
}

/** Disambiguation sort: Rank → Position → Unit → Nickname → Academy → Masked ID. */
export function compareForDisambiguation(a: RankedPersonMatch, b: RankedPersonMatch): number {
  const rankDiff = rankSeniority(b.officer.rank) - rankSeniority(a.officer.rank);
  if (rankDiff !== 0) return rankDiff;
  const pos = (a.officer.currentPosition ?? "").localeCompare(b.officer.currentPosition ?? "", "th");
  if (pos !== 0) return pos;
  const unit = a.officer.companyLabel.localeCompare(b.officer.companyLabel, "th");
  if (unit !== 0) return unit;
  const nick = (a.enrichment.nickname ?? "").localeCompare(b.enrichment.nickname ?? "", "th");
  if (nick !== 0) return nick;
  const academy = (b.officer.academyClass ?? -1) - (a.officer.academyClass ?? -1);
  if (academy !== 0) return academy;
  return a.officer.officerId.localeCompare(b.officer.officerId, "th");
}

export function compareByScoreThenDisambiguation(a: RankedPersonMatch, b: RankedPersonMatch): number {
  if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
  return compareForDisambiguation(a, b);
}
