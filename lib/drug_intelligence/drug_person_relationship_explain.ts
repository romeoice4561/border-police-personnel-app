/**
 * Deterministic Person-profile relationship explainability.
 *
 * Wording is derived ONLY from structured profile/junction facts already on
 * the Person page. Never invents ownership, usage, presence, calls, or guilt.
 * Prefer neutral verbs when the schema does not record a specific role.
 */
import {
  DRUG_CASE_PERSON_ROLE_LABELS,
  isValidDrugCasePersonRole,
  DRUG_NETWORK_ROLE_LABELS,
  isValidDrugNetworkRole,
  DRUG_NETWORK_ROLE_SOURCE_LABELS,
  isValidDrugNetworkRoleSource,
  DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS,
  isValidDrugNetworkRoleVerificationStatus,
} from "@/lib/drug_intelligence/drug_person_options";
import {
  DRUG_LOCATION_ROLE_LABELS,
  isValidDrugLocationRole,
} from "@/lib/drug_intelligence/drug_location_options";
import { sourceRelativeConnectionDetail } from "@/lib/drug_intelligence/drug_person_investigation_origin";

export type RelationshipEntityKind =
  | "PERSON"
  | "CASE"
  | "PHONE"
  | "SIM"
  | "DEVICE"
  | "VEHICLE"
  | "LOCATION"
  | "NETWORK_ROLE"
  | "NETWORK_GROUP"
  | "ROLE";

/** Safe operational verbs — never stronger than the backing fact. */
export type RelationshipVerbKey =
  | "RELATED_TO"
  | "RECORDED_IN_CASE"
  | "LINKED_VIA_CASE"
  | "APPEARS_WITH_IN_CASE"
  | "CASE_ROLE"
  | "LOCATION_VIA_CASE"
  | "NETWORK_ROLE_ASSERTED"
  | "FOUND_IN"
  | "FOUND_VIA"
  | "AS_ROLE"
  | "IN";

export const RELATIONSHIP_VERB_LABELS: Record<
  RelationshipVerbKey,
  { th: string; en: string }
> = {
  RELATED_TO: { th: "เกี่ยวข้องกับ", en: "related to" },
  RECORDED_IN_CASE: { th: "อยู่ในคดี", en: "recorded in case" },
  LINKED_VIA_CASE: { th: "พบความเชื่อมโยงผ่านคดี", en: "linked via case" },
  APPEARS_WITH_IN_CASE: { th: "ปรากฏร่วมในข้อมูลคดี", en: "appears together in case records" },
  CASE_ROLE: { th: "มีบทบาทในคดี", en: "has a role in case" },
  LOCATION_VIA_CASE: { th: "เชื่อมโยงผ่านคดี", en: "linked through case" },
  NETWORK_ROLE_ASSERTED: { th: "ถูกบันทึกบทบาท", en: "role recorded" },
  FOUND_IN: { th: "พบใน", en: "found in" },
  FOUND_VIA: { th: "พบผ่าน", en: "found via" },
  AS_ROLE: { th: "บทบาท", en: "role" },
  IN: { th: "ใน", en: "in" },
};

export type RelationshipPathNode = {
  kind: RelationshipEntityKind;
  label: string;
};

export type RelationshipPathStep = {
  from: RelationshipPathNode;
  verb: string;
  to: RelationshipPathNode;
};

export type RelationshipExplanationModel = {
  titleKey: "howRelated" | "whyRole";
  /** Shown only when there is no visual path (e.g. network-role why panel). */
  headline: string | null;
  path: RelationshipPathStep[];
  /** @deprecated prefer sourceCaseLabels + discoveredCaseLabels when origin exists */
  caseChips: string[];
  /** Cases that are the investigation origin for this entity. */
  sourceCaseLabels: string[];
  /** Other cases reached via the same entity (deterministic co-membership). */
  discoveredCaseLabels: string[];
  /** Co-appearing phones — never drawn as SIM→phone "uses" edges. */
  coAppearancePhones: string[];
  facts: string[];
  insight: string | null;
  caution: string | null;
};

/** Flatten path into ordered entity labels for presentation tests. */
export function flattenChainLabels(path: RelationshipPathStep[]): string[] {
  if (path.length === 0) return [];
  const labels = [path[0]!.from.label];
  for (const step of path) labels.push(step.to.label);
  return labels;
}

export type ImportantConnectionItem = {
  id: string;
  kind: RelationshipEntityKind;
  primaryLabel: string;
  detail: string;
};

function langPick(language: "th" | "en", th: string, en: string): string {
  return language === "th" ? th : en;
}

export function relationshipVerbLabel(key: RelationshipVerbKey, language: "th" | "en"): string {
  const meta = RELATIONSHIP_VERB_LABELS[key];
  return language === "th" ? meta.th : meta.en;
}

/** Map known case-person roles to officer-facing Thai/EN; unknown → safe related. */
export function casePersonRolePhrase(role: string | null | undefined, language: "th" | "en"): string {
  if (!role || !isValidDrugCasePersonRole(role)) {
    return langPick(language, "ผู้เกี่ยวข้อง", "associated person");
  }
  const meta = DRUG_CASE_PERSON_ROLE_LABELS[role];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

/**
 * Person↔entity link verbs available on the Person profile.
 * Schema stores association sightings, not ownership — never return "ใช้"/"ครอบครอง".
 */
export function personEntityLinkVerb(
  entityKind: "PHONE" | "SIM" | "DEVICE" | "VEHICLE",
  language: "th" | "en",
): string {
  void entityKind;
  return relationshipVerbLabel("RELATED_TO", language);
}

export function assertNeverClaimsOwnership(text: string): boolean {
  const forbidden = ["เจ้าของ", "ครอบครอง", "เป็นเจ้าของ", "owns", "owned", "possesses", "possession"];
  const lower = text.toLowerCase();
  return !forbidden.some((w) => lower.includes(w.toLowerCase()));
}

export function assertNeverClaimsUsage(text: string): boolean {
  const forbidden = ["ใช้เบอร์", "ใช้ซิม", "ใช้หมายเลข", "uses number", "uses sim", "uses the phone"];
  const lower = text.toLowerCase();
  return !forbidden.some((w) => lower.includes(w.toLowerCase()));
}

export function explainPersonCase(args: {
  personName: string;
  caseLabel: string;
  role: string;
  language: "th" | "en";
}): RelationshipExplanationModel {
  const roleLabel = casePersonRolePhrase(args.role, args.language);
  return {
    titleKey: "howRelated",
    headline: null,
    path: [
      {
        from: { kind: "PERSON", label: args.personName },
        verb: relationshipVerbLabel("AS_ROLE", args.language),
        to: { kind: "ROLE", label: roleLabel },
      },
      {
        from: { kind: "ROLE", label: roleLabel },
        verb: relationshipVerbLabel("IN", args.language),
        to: { kind: "CASE", label: args.caseLabel },
      },
    ],
    caseChips: [],
    sourceCaseLabels: [],
    discoveredCaseLabels: [],
    coAppearancePhones: [],
    facts: [],
    insight: null,
    caution: null,
  };
}

export function explainPersonPhone(args: {
  personName: string;
  phoneLabel: string;
  caseLabels: string[];
  language: "th" | "en";
  sourceCaseLabels?: string[];
  discoveredCaseLabels?: string[];
}): RelationshipExplanationModel {
  const verb = personEntityLinkVerb("PHONE", args.language);
  const caseCount = args.caseLabels.length;
  const hasOrigin = (args.sourceCaseLabels?.length ?? 0) > 0 || (args.discoveredCaseLabels?.length ?? 0) > 0;
  const caseNodeLabel =
    caseCount > 1
      ? args.language === "th"
        ? `${caseCount} คดี`
        : `${caseCount} cases`
      : args.caseLabels[0] ?? langPick(args.language, "คดี", "case");
  const insight =
    hasOrigin && (args.discoveredCaseLabels?.length ?? 0) > 0
      ? args.language === "th"
        ? `พบในคดีต้นทาง → พบซ้ำอีก ${args.discoveredCaseLabels!.length} คดี`
        : `In source case → also in ${args.discoveredCaseLabels!.length} other case(s)`
      : caseCount > 1
        ? args.language === "th"
          ? `หมายเลขเดียวกันปรากฏในข้อมูล ${caseCount} คดี`
          : `The same number appears across ${caseCount} cases`
        : null;
  return {
    titleKey: "howRelated",
    headline: null,
    path: [
      {
        from: { kind: "PERSON", label: args.personName },
        verb,
        to: { kind: "PHONE", label: args.phoneLabel },
      },
      ...(caseCount > 0
        ? [
            {
              from: { kind: "PHONE" as const, label: args.phoneLabel },
              verb: relationshipVerbLabel("FOUND_IN", args.language),
              to: { kind: "CASE" as const, label: caseNodeLabel },
            },
          ]
        : []),
    ],
    caseChips: hasOrigin ? [] : args.caseLabels.slice(0, 8),
    sourceCaseLabels: args.sourceCaseLabels ?? [],
    discoveredCaseLabels: args.discoveredCaseLabels ?? [],
    coAppearancePhones: [],
    facts: [],
    insight,
    caution: null,
  };
}

export function explainPersonSim(args: {
  personName: string;
  simLabel: string;
  caseLabels: string[];
  coAppearingPhoneLabels?: string[];
  language: "th" | "en";
  sourceCaseLabels?: string[];
  discoveredCaseLabels?: string[];
}): RelationshipExplanationModel {
  const verb = personEntityLinkVerb("SIM", args.language);
  const hasOrigin = (args.sourceCaseLabels?.length ?? 0) > 0 || (args.discoveredCaseLabels?.length ?? 0) > 0;
  const path: RelationshipPathStep[] = [
    {
      from: { kind: "PERSON", label: args.personName },
      verb,
      to: { kind: "SIM", label: args.simLabel },
    },
  ];
  if (args.caseLabels[0]) {
    path.push({
      from: { kind: "SIM", label: args.simLabel },
      verb: relationshipVerbLabel("FOUND_IN", args.language),
      to: { kind: "CASE", label: args.caseLabels[0] },
    });
  }
  return {
    titleKey: "howRelated",
    headline: null,
    path,
    caseChips: hasOrigin ? [] : args.caseLabels.slice(0, 8),
    sourceCaseLabels: args.sourceCaseLabels ?? [],
    discoveredCaseLabels: args.discoveredCaseLabels ?? [],
    coAppearancePhones: (args.coAppearingPhoneLabels ?? []).slice(0, 5),
    facts: [],
    insight: null,
    caution: null,
  };
}

export function explainPersonDevice(args: {
  personName: string;
  deviceLabel: string;
  caseLabels: string[];
  language: "th" | "en";
  sourceCaseLabels?: string[];
  discoveredCaseLabels?: string[];
}): RelationshipExplanationModel {
  const verb = personEntityLinkVerb("DEVICE", args.language);
  const hasOrigin = (args.sourceCaseLabels?.length ?? 0) > 0 || (args.discoveredCaseLabels?.length ?? 0) > 0;
  return {
    titleKey: "howRelated",
    headline: null,
    path: [
      {
        from: { kind: "PERSON", label: args.personName },
        verb,
        to: { kind: "DEVICE", label: args.deviceLabel },
      },
      ...(args.caseLabels[0]
        ? [
            {
              from: { kind: "DEVICE" as const, label: args.deviceLabel },
              verb: relationshipVerbLabel("FOUND_VIA", args.language),
              to: { kind: "CASE" as const, label: args.caseLabels[0] },
            },
          ]
        : []),
    ],
    caseChips: hasOrigin ? [] : args.caseLabels.slice(0, 8),
    sourceCaseLabels: args.sourceCaseLabels ?? [],
    discoveredCaseLabels: args.discoveredCaseLabels ?? [],
    coAppearancePhones: [],
    facts: [],
    insight: null,
    caution: null,
  };
}

export function explainPersonVehicle(args: {
  personName: string;
  vehicleLabel: string;
  caseLabels: string[];
  language: "th" | "en";
  sourceCaseLabels?: string[];
  discoveredCaseLabels?: string[];
}): RelationshipExplanationModel {
  const verb = personEntityLinkVerb("VEHICLE", args.language);
  const hasOrigin = (args.sourceCaseLabels?.length ?? 0) > 0 || (args.discoveredCaseLabels?.length ?? 0) > 0;
  return {
    titleKey: "howRelated",
    headline: null,
    path: [
      {
        from: { kind: "PERSON", label: args.personName },
        verb,
        to: { kind: "VEHICLE", label: args.vehicleLabel },
      },
      ...(args.caseLabels[0]
        ? [
            {
              from: { kind: "VEHICLE" as const, label: args.vehicleLabel },
              verb: relationshipVerbLabel("FOUND_VIA", args.language),
              to: { kind: "CASE" as const, label: args.caseLabels[0] },
            },
          ]
        : []),
    ],
    caseChips: hasOrigin ? [] : args.caseLabels.slice(0, 8),
    sourceCaseLabels: args.sourceCaseLabels ?? [],
    discoveredCaseLabels: args.discoveredCaseLabels ?? [],
    coAppearancePhones: [],
    facts: [],
    insight: null,
    caution: null,
  };
}

export function explainPersonLocation(args: {
  personName: string;
  locationLabel: string;
  caseLabels: string[];
  locationRole: string | null;
  language: "th" | "en";
  sourceCaseLabels?: string[];
  discoveredCaseLabels?: string[];
}): RelationshipExplanationModel {
  const roleLabel =
    args.locationRole && isValidDrugLocationRole(args.locationRole)
      ? args.language === "th"
        ? DRUG_LOCATION_ROLE_LABELS[args.locationRole].labelTh
        : DRUG_LOCATION_ROLE_LABELS[args.locationRole].labelEn
      : null;
  const caseLabel = args.caseLabels[0] ?? langPick(args.language, "คดีที่เกี่ยวข้อง", "related case");
  const hasOrigin = (args.sourceCaseLabels?.length ?? 0) > 0 || (args.discoveredCaseLabels?.length ?? 0) > 0;
  return {
    titleKey: "howRelated",
    headline: null,
    path: [
      {
        from: { kind: "PERSON", label: args.personName },
        verb: relationshipVerbLabel("LOCATION_VIA_CASE", args.language),
        to: { kind: "CASE", label: caseLabel },
      },
      {
        from: { kind: "CASE", label: caseLabel },
        verb: roleLabel ?? langPick(args.language, "สถานที่ในคดี", "case location"),
        to: { kind: "LOCATION", label: args.locationLabel },
      },
    ],
    caseChips: hasOrigin ? [] : args.caseLabels.slice(0, 8),
    sourceCaseLabels: args.sourceCaseLabels ?? [],
    discoveredCaseLabels: args.discoveredCaseLabels ?? [],
    coAppearancePhones: [],
    facts: [],
    insight: null,
    caution:
      args.language === "th"
        ? "ไม่ใช่หลักฐานว่าบุคคลนี้ไปยังสถานที่นี้ด้วยตนเอง — เป็นการเชื่อมโยงผ่านข้อมูลคดี"
        : "Does not prove the person physically visited this place — linked via case records only",
  };
}

export function explainNetworkRole(args: {
  role: string;
  source: string | null;
  verificationStatus: string;
  sourceCaseLabel: string | null;
  recordedByName: string;
  recordedAtLabel: string;
  note: string | null;
  language: "th" | "en";
}): RelationshipExplanationModel {
  const roleLabel = isValidDrugNetworkRole(args.role)
    ? args.language === "th"
      ? DRUG_NETWORK_ROLE_LABELS[args.role].labelTh
      : DRUG_NETWORK_ROLE_LABELS[args.role].labelEn
    : args.role;
  const sourceLabel =
    args.source && isValidDrugNetworkRoleSource(args.source)
      ? args.language === "th"
        ? DRUG_NETWORK_ROLE_SOURCE_LABELS[args.source].labelTh
        : DRUG_NETWORK_ROLE_SOURCE_LABELS[args.source].labelEn
      : null;
  const verificationLabel = isValidDrugNetworkRoleVerificationStatus(args.verificationStatus)
    ? args.language === "th"
      ? DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[args.verificationStatus].labelTh
      : DRUG_NETWORK_ROLE_VERIFICATION_STATUS_LABELS[args.verificationStatus].labelEn
    : args.verificationStatus;

  const facts = [
    ...(args.sourceCaseLabel
      ? [args.language === "th" ? `📁 อ้างอิง ${args.sourceCaseLabel}` : `📁 Ref ${args.sourceCaseLabel}`]
      : []),
    ...(sourceLabel
      ? [args.language === "th" ? `📝 ที่มา: ${sourceLabel}` : `📝 Source: ${sourceLabel}`]
      : []),
    args.language === "th"
      ? `👤 บันทึกโดย ${args.recordedByName}`
      : `👤 Recorded by ${args.recordedByName}`,
    args.language === "th" ? `📅 ${args.recordedAtLabel}` : `📅 ${args.recordedAtLabel}`,
  ];

  return {
    titleKey: "whyRole",
    headline:
      args.language === "th"
        ? `บทบาท「${roleLabel}」· ${verificationLabel}`
        : `Role "${roleLabel}" · ${verificationLabel}`,
    path: [],
    caseChips: [],
    sourceCaseLabels: [],
    discoveredCaseLabels: [],
    coAppearancePhones: [],
    facts,
    insight: null,
    caution:
      args.verificationStatus === "UNVERIFIED"
        ? args.language === "th"
          ? "ยังไม่มีหลักฐานอื่นยืนยัน"
          : "Not yet corroborated by other evidence"
        : null,
  };
}

export function buildImportantConnections(args: {
  language: "th" | "en";
  sourceCaseId: string | null;
  phones: Array<{ id: string; label: string; caseCount: number; caseIds: string[] }>;
  devices: Array<{ id: string; label: string; caseCount: number; caseIds: string[] }>;
  vehicles: Array<{ id: string; label: string; caseCount: number; caseIds: string[] }>;
  networkRoles: Array<{ id: string; role: string; verificationStatus: string }>;
}): ImportantConnectionItem[] {
  const items: ImportantConnectionItem[] = [];
  const multiPhones = [...args.phones].sort((a, b) => b.caseCount - a.caseCount).slice(0, 3);
  for (const p of multiPhones) {
    if (p.caseCount <= 0) continue;
    const inSource = Boolean(args.sourceCaseId && p.caseIds.includes(args.sourceCaseId));
    const discoveredCount = args.sourceCaseId ? p.caseIds.filter((id) => id !== args.sourceCaseId).length : p.caseCount;
    items.push({
      id: `phone:${p.id}`,
      kind: "PHONE",
      primaryLabel: p.label,
      detail: sourceRelativeConnectionDetail({
        language: args.language,
        inSource,
        totalCaseCount: p.caseCount,
        discoveredCount: inSource ? discoveredCount : p.caseCount,
      }),
    });
  }
  for (const d of args.devices.slice(0, 2)) {
    if (d.caseCount <= 0) continue;
    const inSource = Boolean(args.sourceCaseId && d.caseIds.includes(args.sourceCaseId));
    const discoveredCount = args.sourceCaseId ? d.caseIds.filter((id) => id !== args.sourceCaseId).length : d.caseCount;
    items.push({
      id: `device:${d.id}`,
      kind: "DEVICE",
      primaryLabel: d.label,
      detail: sourceRelativeConnectionDetail({
        language: args.language,
        inSource,
        totalCaseCount: d.caseCount,
        discoveredCount: inSource ? discoveredCount : d.caseCount,
      }),
    });
  }
  for (const v of args.vehicles.slice(0, 2)) {
    if (v.caseCount <= 0) continue;
    const inSource = Boolean(args.sourceCaseId && v.caseIds.includes(args.sourceCaseId));
    const discoveredCount = args.sourceCaseId ? v.caseIds.filter((id) => id !== args.sourceCaseId).length : v.caseCount;
    items.push({
      id: `vehicle:${v.id}`,
      kind: "VEHICLE",
      primaryLabel: v.label,
      detail: sourceRelativeConnectionDetail({
        language: args.language,
        inSource,
        totalCaseCount: v.caseCount,
        discoveredCount: inSource ? discoveredCount : v.caseCount,
      }),
    });
  }
  for (const nr of args.networkRoles) {
    if (nr.verificationStatus !== "CONFIRMED" && nr.verificationStatus !== "SUPPORTED") continue;
    const roleLabel = isValidDrugNetworkRole(nr.role)
      ? args.language === "th"
        ? DRUG_NETWORK_ROLE_LABELS[nr.role].labelTh
        : DRUG_NETWORK_ROLE_LABELS[nr.role].labelEn
      : nr.role;
    items.push({
      id: `role:${nr.id}`,
      kind: "NETWORK_ROLE",
      primaryLabel: roleLabel,
      detail:
        nr.verificationStatus === "CONFIRMED"
          ? args.language === "th"
            ? "✓ ยืนยันแล้ว"
            : "✓ Verified"
          : args.language === "th"
            ? "มีข้อมูลสนับสนุน"
            : "Supported",
    });
  }
  return items.slice(0, 8);
}

/** Prefer human-readable case numbers over UUIDs in explanations. */
export function preferHumanCaseLabel(caseNumber: string | null | undefined, caseId: string): string {
  const trimmed = caseNumber?.trim();
  if (trimmed) return trimmed;
  if (caseId.length <= 12) return caseId;
  return `${caseId.slice(0, 8)}…${caseId.slice(-4)}`;
}
