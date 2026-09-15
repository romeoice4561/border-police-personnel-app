/**
 * DI-9.5.2 / DI-9.5.4 — presentation helpers for Phone/SIM/Device/Vehicle
 * intelligence detail pages. Pure: no I/O, no React. Derives visual facts
 * only from the already-loaded entity-detail DTO. Never invents ownership,
 * communication, guilt, or risk.
 */

import { sanitizePersonCaseContextId } from "@/lib/drug_intelligence/person_case_context";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";

/** Theme-token class sets. Color is a secondary cue — always paired with icon + label. */
export const DRUG_ENTITY_DETAIL_TONE: Record<
  DrugGraphNodeType,
  { shell: string; bar: string; badge: string }
> = {
  PHONE: {
    shell: "border-good bg-good-bg text-good",
    bar: "border-l-good",
    badge: "border-good bg-good-bg text-good",
  },
  SIM: {
    shell: "border-accent bg-accent/10 text-accent",
    bar: "border-l-accent",
    badge: "border-accent bg-accent/10 text-accent",
  },
  DEVICE: {
    shell: "border-warning bg-warning-bg text-warning",
    bar: "border-l-warning",
    badge: "border-warning bg-warning-bg text-warning",
  },
  VEHICLE: {
    shell: "border-serious bg-serious-bg text-serious",
    bar: "border-l-serious",
    badge: "border-serious bg-serious-bg text-serious",
  },
  CASE: {
    shell: "border-critical bg-critical-bg text-critical",
    bar: "border-l-critical",
    badge: "border-critical bg-critical-bg text-critical",
  },
  PERSON: {
    shell: "border-accent bg-accent/10 text-accent",
    bar: "border-l-accent",
    badge: "border-accent bg-accent/10 text-accent",
  },
  LOCATION: {
    shell: "border-warning bg-warning-bg text-warning",
    bar: "border-l-warning",
    badge: "border-warning bg-warning-bg text-warning",
  },
};

export const DRUG_ENTITY_SCAN_EMOJI: Record<DrugGraphNodeType, string> = {
  PERSON: "👤",
  PHONE: "📞",
  SIM: "💳",
  DEVICE: "📱",
  VEHICLE: "🚗",
  CASE: "📁",
  LOCATION: "📍",
};

export function shouldShowRecurrenceBadge(caseCount: number): boolean {
  return caseCount > 1;
}

export function caseCountByPersonId(
  links: ReadonlyArray<{ personId: string | null; caseId: string }>
): Map<string, number> {
  const cases = new Map<string, Set<string>>();
  for (const link of links) {
    if (!link.personId) continue;
    const set = cases.get(link.personId) ?? new Set<string>();
    set.add(link.caseId);
    cases.set(link.personId, set);
  }
  const counts = new Map<string, number>();
  for (const [personId, set] of cases) counts.set(personId, set.size);
  return counts;
}

/** Current-case badge only when the URL case id is one of the loaded source cases. */
export function resolveEntityDetailCaseContext(
  rawCaseId: string | null | undefined,
  sourceCaseIds: readonly string[]
): string | null {
  const caseId = sanitizePersonCaseContextId(rawCaseId);
  if (!caseId) return null;
  return sourceCaseIds.includes(caseId) ? caseId : null;
}

export function relatedIntelligenceFromKnownDto(): [] {
  return [];
}

function joinedIdentity(...parts: Array<string | null | undefined>): string | null {
  const value = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part)).join(" ");
  return value || null;
}

/** Strongest factual Device label from the loaded DTO — never invents IMEI/serial. */
export function presentDevicePrimaryIdentity(input: {
  brand: string | null;
  model: string | null;
  imei1Display: string | null;
  serialDisplay: string | null;
  fallback: string;
}): string {
  return joinedIdentity(input.brand, input.model) ?? input.imei1Display ?? input.serialDisplay ?? input.fallback;
}

/** Strongest factual Vehicle label from the loaded DTO — never invents a plate. */
export function presentVehiclePrimaryIdentity(input: {
  registrationDisplay: string | null;
  registrationProvince: string | null;
  brand: string | null;
  model: string | null;
  fallback: string;
}): string {
  if (input.registrationDisplay) {
    return joinedIdentity(input.registrationDisplay, input.registrationProvince) ?? input.registrationDisplay;
  }
  return joinedIdentity(input.brand, input.model) ?? input.fallback;
}

export function explanationContainsForbiddenEntityClaim(text: string): boolean {
  return /เจ้าของเบอร์|เจ้าของ SIM|เจ้าของรถ|เจ้าของอุปกรณ์|ผู้ใช้ SIM|เบอร์ของบุคคล|SIM ของบุคคล|รถของบุคคล|อุปกรณ์ของนาย|รถของนาย|โทรหา|สนทนา|CDR|call history|ใช้โทรศัพท์นี้แน่นอน|เป็นเจ้าของโทรศัพท์|ผู้ต้องสงสัยระดับสูง|ความเสี่ยงสูง|น่าสงสัย|risk score/i.test(
    text
  );
}
