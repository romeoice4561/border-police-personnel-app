/**
 * Unit lookup — summary only; never dumps every officer.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PersonnelSearchUnitItem } from "@/lib/personnel_search/contracts";
import type { NormalizedUnitRef } from "@/lib/personnel_search/types";
import { rankSeniority } from "@/lib/personnel_search/ranking";

function isPromotionReady(o: CommanderQueryOfficer): boolean {
  const s = o.promotionIntelligence.promotionStatus;
  return s === "EligibleThisYear" || s === "AlreadyEligible";
}

function isNearRetirement(o: CommanderQueryOfficer): boolean {
  return (
    o.retirementStatus === "retiring_within_1_year" ||
    o.retirementStatus === "retiring_within_2_years" ||
    o.flagCodes.includes("RETIRING_SOON")
  );
}

function isIncomplete(o: CommanderQueryOfficer): boolean {
  const c = o.promotionIntelligence.confidence;
  return c === "incomplete" || c === "unknown" || o.flagCodes.includes("PROFILE_INCOMPLETE");
}

function matchesUnit(officer: CommanderQueryOfficer, unit: NormalizedUnitRef): boolean {
  if (unit.level === "company" && unit.number != null) {
    return officer.companyId === unit.number || String(officer.companyId) === String(unit.number);
  }
  if (unit.level === "division" && unit.number != null) {
    return officer.battalionId === unit.number;
  }
  if (unit.level === "region" && unit.number != null) {
    return officer.regionId === unit.number;
  }
  return false;
}

function pickCommander(members: CommanderQueryOfficer[]): CommanderQueryOfficer | null {
  if (members.length === 0) return null;
  const ranked = [...members].sort((a, b) => rankSeniority(b.rank) - rankSeniority(a.rank));
  // Prefer positions that look like unit command.
  const cmd = ranked.find((o) => /ผบ\.|ผู้บังคับ|ผู้กำกับการ|สารวัตรใหญ่/i.test(o.currentPosition ?? ""));
  return cmd ?? ranked[0] ?? null;
}

function pickDeputies(members: CommanderQueryOfficer[], commanderId: string | null): string[] {
  return members
    .filter((o) => o.officerId !== commanderId)
    .filter((o) => /รอง|ผบ\.?มว|สว\./i.test(o.currentPosition ?? ""))
    .sort((a, b) => rankSeniority(b.rank) - rankSeniority(a.rank))
    .slice(0, 3)
    .map((o) => `${o.rank} ${o.firstName} ${o.lastName}`.trim());
}

export function searchUnit(
  officers: CommanderQueryOfficer[],
  unit: NormalizedUnitRef
): PersonnelSearchUnitItem | null {
  const members = officers.filter((o) => matchesUnit(o, unit));
  if (members.length === 0) return null;

  const commander = pickCommander(members);
  const promotionReadyCount = members.filter(isPromotionReady).length;
  const retirementNearCount = members.filter(isNearRetirement).length;
  const incompleteDataCount = members.filter(isIncomplete).length;

  // "Police count" ≈ officers with a police-style rank abbreviation.
  const policeCount = members.filter((o) => /พ\.?ต\.?|ร\.?ต\.?|ด\.?ต\.?|ส\.?ต\.?/.test(o.rank)).length;

  return {
    kind: "unit",
    level: unit.level,
    key: unit.key,
    labelTh: unit.labelTh,
    commanderName: commander ? `${commander.rank} ${commander.firstName} ${commander.lastName}`.trim() : null,
    deputyNames: pickDeputies(members, commander?.officerId ?? null),
    officerCount: members.length,
    policeCount,
    promotionReadyCount,
    retirementNearCount,
    incompleteDataCount,
    topContacts: commander
      ? [{ labelTh: "ผู้บังคับหน่วย", value: `${commander.rank} ${commander.firstName} ${commander.lastName}`.trim() }]
      : [],
  };
}
