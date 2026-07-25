/**
 * Unit lookup — summary only; never dumps every officer.
 * Matches officers by resolved internal FK (from Entity Resolver), never by public code alone.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { PersonnelSearchUnitItem } from "@/lib/personnel_search/contracts";
import type { ResolvedEntity } from "@/lib/personnel_entities/contracts";
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

/** Filter officers to a resolved organization entity (internal ids only). */
export function filterOfficersByResolvedOrg(
  officers: CommanderQueryOfficer[],
  entity: ResolvedEntity
): CommanderQueryOfficer[] {
  const id = entity.internalNumericId;
  if (id == null) return [];
  if (entity.type === "company") {
    return officers.filter((o) => o.companyId === id);
  }
  if (entity.type === "division") {
    return officers.filter((o) => o.battalionId === id);
  }
  if (entity.type === "region") {
    return officers.filter((o) => o.regionId === id);
  }
  return [];
}

function pickCommander(members: CommanderQueryOfficer[]): CommanderQueryOfficer | null {
  if (members.length === 0) return null;
  const ranked = [...members].sort((a, b) => rankSeniority(b.rank) - rankSeniority(a.rank));
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

/**
 * Build a unit summary from a ResolvedEntity (publicCode + internalNumericId).
 */
export function searchUnit(
  officers: CommanderQueryOfficer[],
  entity: ResolvedEntity
): PersonnelSearchUnitItem | null {
  if (entity.type !== "company" && entity.type !== "division" && entity.type !== "region") {
    return null;
  }

  const members = filterOfficersByResolvedOrg(officers, entity);
  if (members.length === 0) return null;

  const commander = pickCommander(members);
  const promotionReadyCount = members.filter(isPromotionReady).length;
  const retirementNearCount = members.filter(isNearRetirement).length;
  const incompleteDataCount = members.filter(isIncomplete).length;
  const policeCount = members.filter((o) => /พ\.?ต\.?|ร\.?ต\.?|ด\.?ต\.?|ส\.?ต\.?/.test(o.rank)).length;
  const publicCode = entity.publicCode ?? "";

  return {
    kind: "unit",
    level: entity.type === "division" ? "division" : entity.type === "region" ? "region" : "company",
    key: `${entity.type}:${publicCode}`,
    labelTh: entity.displayName,
    publicCode,
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
