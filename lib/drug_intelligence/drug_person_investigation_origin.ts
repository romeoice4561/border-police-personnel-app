/**
 * Investigation origin helpers for Person Intelligence (origin-first UX).
 *
 * Pure partitioning over already-loaded case refs. Never invents a source
 * case — callers pass URL-validated sourceCaseId or null (aggregate mode).
 *
 * Canonical URL origin param is `sourceCaseId` (see person_case_context.ts).
 */

export type OriginCaseRef = {
  caseId: string;
  caseNumber?: string | null;
};

export type StoryEntityKind = "PHONE" | "SIM" | "DEVICE" | "VEHICLE" | "LOCATION";

export type StoryEntityForConclusion = {
  id: string;
  kind: StoryEntityKind;
  label: string;
  href?: string | null;
  cases: OriginCaseRef[];
};

export type InvestigationDiscoveryHit = {
  id: string;
  kind: StoryEntityKind;
  label: string;
  href?: string | null;
  discoveredCount: number;
  discoveredCases: Array<{ caseId: string; label: string }>;
};

export type InvestigationConclusionModel =
  | { status: "no_discoveries" }
  | {
      status: "has_discoveries";
      primary: InvestigationDiscoveryHit;
      discoveryEntityCount: number;
    };

const KIND_PRIORITY: Record<StoryEntityKind, number> = {
  PHONE: 5,
  SIM: 4,
  DEVICE: 3,
  VEHICLE: 2,
  LOCATION: 1,
};

function humanCaseLabel(caseNumber: string | null | undefined, caseId: string): string {
  const trimmed = caseNumber?.trim();
  if (trimmed) return trimmed;
  if (caseId.length <= 12) return caseId;
  return `${caseId.slice(0, 8)}…${caseId.slice(-4)}`;
}

export function partitionEntityCasesByOrigin(
  cases: OriginCaseRef[],
  sourceCaseId: string | null,
): { sourceLabels: string[]; discoveredLabels: string[]; inSource: boolean; discoveredCount: number } {
  const labels = cases.map((c) => humanCaseLabel(c.caseNumber, c.caseId));
  if (!sourceCaseId) {
    return {
      sourceLabels: [],
      discoveredLabels: labels,
      inSource: false,
      discoveredCount: labels.length,
    };
  }
  const sourceLabels: string[] = [];
  const discoveredLabels: string[] = [];
  let inSource = false;
  for (let i = 0; i < cases.length; i++) {
    const row = cases[i]!;
    const label = labels[i]!;
    if (row.caseId === sourceCaseId) {
      inSource = true;
      sourceLabels.push(label);
    } else {
      discoveredLabels.push(label);
    }
  }
  return {
    sourceLabels,
    discoveredLabels,
    inSource,
    discoveredCount: discoveredLabels.length,
  };
}

/**
 * Rank discoveries for the human conclusion line.
 * Strongest = highest discovered-case count, then phone/SIM/device priority.
 * Does not invent links — only partitions already-loaded provenance.
 */
export function collectInvestigationDiscoveries(
  entities: StoryEntityForConclusion[],
  sourceCaseId: string,
): InvestigationDiscoveryHit[] {
  const hits: InvestigationDiscoveryHit[] = [];
  for (const entity of entities) {
    const part = partitionEntityCasesByOrigin(entity.cases, sourceCaseId);
    if (part.discoveredCount <= 0) continue;
    hits.push({
      id: entity.id,
      kind: entity.kind,
      label: entity.label,
      href: entity.href,
      discoveredCount: part.discoveredCount,
      discoveredCases: entity.cases
        .filter((c) => c.caseId !== sourceCaseId)
        .map((c) => ({ caseId: c.caseId, label: humanCaseLabel(c.caseNumber, c.caseId) })),
    });
  }
  hits.sort((a, b) => {
    if (b.discoveredCount !== a.discoveredCount) return b.discoveredCount - a.discoveredCount;
    return KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind];
  });
  return hits;
}

/** Compact post-scan conclusion model from real discovery data (never hardcoded). */
export function buildInvestigationConclusionModel(
  entities: StoryEntityForConclusion[],
  sourceCaseId: string | null,
): InvestigationConclusionModel | null {
  if (!sourceCaseId) return null;
  const discoveries = collectInvestigationDiscoveries(entities, sourceCaseId);
  if (discoveries.length === 0) return { status: "no_discoveries" };
  return {
    status: "has_discoveries",
    primary: discoveries[0]!,
    discoveryEntityCount: discoveries.length,
  };
}

/** Compact overview insight relative to source case when present. */
export function sourceRelativeConnectionDetail(args: {
  language: "th" | "en";
  inSource: boolean;
  totalCaseCount: number;
  discoveredCount: number;
}): string {
  if (!args.inSource) {
    return args.language === "th"
      ? `เชื่อม ${args.totalCaseCount} คดี`
      : `Linked · ${args.totalCaseCount} cases`;
  }
  if (args.discoveredCount > 0) {
    return args.language === "th"
      ? `พบในคดีต้นทาง → พบซ้ำอีก ${args.discoveredCount} คดี`
      : `In source case → also in ${args.discoveredCount} other case(s)`;
  }
  return args.language === "th" ? "พบในคดีต้นทาง" : "Found in source case";
}

export type CaseOriginBadge = "SOURCE" | "LINKED" | null;

/**
 * Case-tab badge. SOURCE only for the URL origin case.
 * LINKED when the person is on that case and it is not the origin
 * (deterministic DrugCasePerson membership — not causation).
 */
export function caseOriginBadge(args: {
  caseId: string;
  sourceCaseId: string | null;
  personIsOnCase: boolean;
}): CaseOriginBadge {
  if (!args.sourceCaseId) return null;
  if (args.caseId === args.sourceCaseId) return "SOURCE";
  if (args.personIsOnCase) return "LINKED";
  return null;
}
