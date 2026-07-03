/**
 * Knowledge statistics + duplicate detection (Phase 11A).
 *
 * Pure functions over a built KnowledgeBase producing:
 *   - the logs/knowledge_summary.json shape, and
 *   - a DuplicateReport (DETECTION ONLY — never modifies officer data).
 *
 * No globals, no I/O, no OpenAI/OCR/Drive.
 */

import type {
  DuplicateGroup,
  DuplicateReport,
  KnowledgeBase,
  KnowledgeOfficer,
  KnowledgeSummary,
} from "@/lib/knowledge/knowledge_types";

/**
 * Thai Border Patrol Police rank seniority, senior → junior. Used only to
 * pick the highest/lowest rank present; ranks not listed are ignored for the
 * high/low computation (never guessed into the ordering). Match is by the
 * rank's core abbreviation appearing in the (possibly "ว่าที่ ..."-prefixed)
 * rank string.
 */
const RANK_SENIORITY: string[] = [
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
];

/** Returns the seniority rank index (0 = most senior) for a rank string, or -1 if unrecognized. */
function rankSeniorityIndex(rank: string): number {
  const normalized = rank.replace(/\s/g, "");
  for (let i = 0; i < RANK_SENIORITY.length; i += 1) {
    if (normalized.includes(RANK_SENIORITY[i].replace(/\s/g, ""))) return i;
  }
  return -1;
}

function round(value: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/** Groups officer ids by a key function, returning only the groups with >1 member (i.e. duplicates). */
function duplicateGroupsBy(
  officers: KnowledgeOfficer[],
  keyFor: (o: KnowledgeOfficer) => string | undefined
): DuplicateGroup[] {
  const byKey = new Map<string, string[]>();
  for (const officer of officers) {
    const key = keyFor(officer);
    if (!key) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(officer.identity.id);
    else byKey.set(key, [officer.identity.id]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, ids] of byKey) {
    if (ids.length > 1) groups.push({ key, officerIds: ids });
  }
  return groups;
}

/**
 * Detects duplicates (never modifies data):
 *   - duplicate_phones: same non-empty phone across >1 officer,
 *   - duplicate_officers: same rank+full name across >1 officer,
 *   - duplicate_timeline: officers with an identical (year|position|unit) entry,
 *   - duplicate_units: units served in by >1 officer.
 */
export function detectDuplicates(base: KnowledgeBase): DuplicateReport {
  const { officers } = base;

  const duplicate_phones = duplicateGroupsBy(officers, (o) => {
    const phone = o.career.phone.trim();
    return phone.length > 0 ? phone : undefined;
  });

  const duplicate_officers = duplicateGroupsBy(officers, (o) => {
    const name = o.identity.full_name.trim();
    return name.length > 0 ? `${o.identity.rank.trim()}|${name}` : undefined;
  });

  // Duplicate timeline: any (year|position|unit) tuple appearing for >1 officer.
  const timelineOwners = new Map<string, Set<string>>();
  for (const officer of officers) {
    for (const entry of officer.timeline) {
      const key = JSON.stringify([entry.year ?? "", entry.position ?? "", entry.unit ?? ""]);
      if (key === '["","",""]') continue; // ignore empty entries
      const owners = timelineOwners.get(key) ?? new Set<string>();
      owners.add(officer.identity.id);
      timelineOwners.set(key, owners);
    }
  }
  const duplicate_timeline: DuplicateGroup[] = [];
  for (const [key, owners] of timelineOwners) {
    if (owners.size > 1) duplicate_timeline.push({ key, officerIds: Array.from(owners) });
  }

  // Duplicate units: units associated with >1 officer.
  const duplicate_units: DuplicateGroup[] = [];
  for (const [unit, officersInUnit] of base.indexes.byUnit) {
    if (officersInUnit.length > 1) {
      duplicate_units.push({ key: unit, officerIds: officersInUnit.map((o) => o.identity.id) });
    }
  }

  return { duplicate_phones, duplicate_officers, duplicate_timeline, duplicate_units };
}

/** Builds the knowledge_summary.json aggregate over a KnowledgeBase. */
export function buildKnowledgeSummary(base: KnowledgeBase): KnowledgeSummary {
  const { officers, indexes } = base;
  const total = officers.length;

  const totalTimelineEntries = officers.reduce((sum, o) => sum + o.timeline.length, 0);
  const careerYearsSum = officers.reduce((sum, o) => sum + o.career.career_length, 0);
  const unitChangesSum = officers.reduce((sum, o) => sum + Math.max(0, o.career.unit_count - 1), 0);

  // Highest/lowest rank present, by seniority (recognized ranks only).
  let highest: { rank: string; idx: number } | null = null;
  let lowest: { rank: string; idx: number } | null = null;
  for (const rank of indexes.byRank.keys()) {
    const idx = rankSeniorityIndex(rank);
    if (idx === -1) continue;
    if (!highest || idx < highest.idx) highest = { rank, idx };
    if (!lowest || idx > lowest.idx) lowest = { rank, idx };
  }

  const duplicates = detectDuplicates(base);

  return {
    total_officers: total,
    total_units: indexes.byUnit.size,
    total_phone_numbers: indexes.byPhone.size,
    total_timeline_entries: totalTimelineEntries,
    average_career_years: total > 0 ? round(careerYearsSum / total) : 0,
    average_unit_changes: total > 0 ? round(unitChangesSum / total) : 0,
    highest_rank: highest?.rank ?? null,
    lowest_rank: lowest?.rank ?? null,
    duplicate_phone_count: duplicates.duplicate_phones.length,
    duplicate_name_count: duplicates.duplicate_officers.length,
  };
}
