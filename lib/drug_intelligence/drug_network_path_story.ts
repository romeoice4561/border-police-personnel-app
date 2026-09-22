/**
 * DI-8.6 — Network Inspector "Investigation Story" narrative generation
 * (final refinement: PREVIOUS→CURRENT natural Thai sentences).
 *
 * PRESENTATION ONLY. Generates a numbered, top-to-bottom investigation
 * narrative entirely from an already-computed NetworkExplainedPath (see
 * drug_network_path_explanation.ts) — the same path enumeration, edge
 * classification (DIRECT/INFERRED), and canonical relationship types DI-8.4
 * already produces. This module does not touch graph data, the relationship
 * engine, path enumeration, shortest-path selection, node coordinates,
 * layout, or viewport calculation — it only turns an existing
 * NetworkExplainedPath into readable step-by-step Thai/English sentences
 * that explicitly connect the PREVIOUS entity to the CURRENT entity.
 *
 * Every transition's sentence is selected ONLY from the step's own
 * `viaRelationshipType` (the actual recorded DrugGraphRelationshipType) and
 * the (previous type → current type) direction that produced it — never a
 * guessed relationship. When a transition's relationship type + direction
 * has no specific mapped sentence (the exhaustive per-pair table below
 * covers every DrugGraphRelationshipType this app currently has), a neutral
 * "{previous} มีความเชื่อมโยงที่บันทึกในระบบกับ {current}" fallback is used —
 * never an invented ownership/possession/criminal-association/communication/
 * physical-presence claim. Geographic proximity is never treated as
 * relationship evidence here (this module never reads coordinates; it only
 * ever reads the already-classified graph edges DI-8.4 loaded).
 *
 * Never upgrades an INFERRED or multi-hop PATH connection into DIRECT
 * wording; that classification comes straight from
 * `path.hopCount`/`step.viaEdgeKind`, already computed upstream, and is
 * only read here, never re-derived or overridden.
 */

import type {
  NetworkExplainedPath,
  NetworkPathExplanation,
  NetworkPathStepExplanation,
} from "@/lib/drug_intelligence/drug_network_path_explanation";
import type { DrugGraphNodeType, DrugGraphRelationshipType } from "@/lib/drug_intelligence/drug_intelligence_client";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export type Translate = (key: TranslationKey) => string;

/** One numbered narrative step: "จุดเริ่มต้น" (origin, no incoming relation) or a transition into a new entity, expressed as a PREVIOUS→CURRENT sentence. */
export interface NetworkPathStoryStep {
  /** 1-based step number as shown to the user (①②③…). */
  order: number;
  kind: "origin" | "transition";
  entityType: DrugGraphNodeType;
  entityLabel: string;
  entitySecondaryLabel: string | null;
  /** Short, context-aware, navigation-only transition heading (Section 8) — e.g. "เชื่อมไปยังคดี". Never implies semantics the sentence itself doesn't state. */
  headingKey: TranslationKey;
  /**
   * The composed natural-language sentence connecting the previous entity to
   * this one, e.g. "นายกิตติศักดิ์ ทดสอบระบบ ปรากฏเป็นผู้เกี่ยวข้องในคดี
   * DI-TEST-001" — null only on the origin step (no previous entity exists).
   */
  sentence: string | null;
  /** Case ids this transition's edge actually carries (NetworkPathStepExplanation.supportingCaseIds) — per-step, never the whole path's deduped union. Same evidence source as DI-8.4, never synthetic. Empty when this specific edge has no recorded supporting case. */
  evidenceCaseIds: string[];
  /** Whether this single transition's own edge is a directly-recorded relationship (DIRECT) vs INFERRED — distinct from the path-level isDirect (whole-path hopCount===1). */
  edgeKind: "DIRECT" | "INFERRED" | null;
  /** Previous entity's label, for the "หลักฐานของขั้นที่ N: {previous} → {current}" evidence-view caption — null only on the origin step. */
  previousLabel: string | null;
}

export interface NetworkPathStoryConclusion {
  isDirect: boolean;
  hopCount: number;
  focusLabel: string;
  selectedLabel: string;
  /** Lead sentence: DIRECT confirmation, or the "not directly linked" negation for indirect paths. */
  leadText: string;
  /** Only set for indirect paths — "ระบบพบเส้นทางผ่านข้อมูลที่บันทึกไว้ {hops} ขั้น". Null for a direct (1-hop) conclusion, which has no hop-count sentence. */
  hopsText: string | null;
  /** The full origin→selected label sequence, shown once as the "เส้นทางที่ระบบพบคือ" path — replaces a separate duplicate breadcrumb section for short/medium paths (Section 10). */
  pathLabels: string[];
}

export interface NetworkPathStory {
  primaryQuestionText: string;
  steps: NetworkPathStoryStep[];
  conclusion: NetworkPathStoryConclusion;
  /** Origin→selected labels — same values as conclusion.pathLabels, exposed for callers that want a standalone compact view for long (>=3 hop) paths (Section 10). */
  breadcrumb: string[];
}

/** Generic origin heading — "จุดเริ่มต้น" regardless of entity type; the entity's own type/name already appears in the card body. */
const ORIGIN_HEADING_KEY: TranslationKey = "di.network.storyOriginHeading";

/**
 * Context-aware transition heading — navigation aid only, never implying
 * semantics beyond what the sentence itself states (Section 8). Selected
 * from the (previous type -> current type) pair, falling back to the
 * neutral "ข้อมูลลำดับถัดไป" when no specific pair is mapped.
 */
function transitionHeadingKeyFor(fromType: DrugGraphNodeType, toType: DrugGraphNodeType): TranslationKey {
  if (toType === "CASE") {
    switch (fromType) {
      case "PHONE":
        return "di.network.storyStepPhoneToCase";
      case "SIM":
        return "di.network.storyStepSimToCase";
      case "DEVICE":
        return "di.network.storyStepDeviceToCase";
      case "VEHICLE":
        return "di.network.storyStepVehicleToCase";
      case "LOCATION":
        return "di.network.storyStepLocationToCase";
      default:
        return "di.network.storyStepToCase";
    }
  }
  if (fromType === "CASE") {
    switch (toType) {
      case "PERSON":
        return "di.network.storyStepFromCaseToPerson";
      case "PHONE":
        return "di.network.storyStepFromCaseToPhone";
      case "SIM":
        return "di.network.storyStepFromCaseToSim";
      case "DEVICE":
        return "di.network.storyStepFromCaseToDevice";
      case "VEHICLE":
        return "di.network.storyStepFromCaseToVehicle";
      case "LOCATION":
        return "di.network.storyStepFromCaseToLocation";
      default:
        return "di.network.storyStepGeneric";
    }
  }
  if (fromType === "PERSON" && toType === "PHONE") return "di.network.storyStepPersonToPhone";
  if (fromType === "PHONE" && toType === "PERSON") return "di.network.storyStepPhoneToPerson";
  if (fromType === "PERSON" && toType === "DEVICE") return "di.network.storyStepPersonToDevice";
  if (fromType === "DEVICE" && toType === "PERSON") return "di.network.storyStepDeviceToPerson";
  if (fromType === "PERSON" && toType === "VEHICLE") return "di.network.storyStepPersonToVehicle";
  if (fromType === "VEHICLE" && toType === "PERSON") return "di.network.storyStepVehicleToPerson";
  return "di.network.storyStepGeneric";
}

/**
 * Exhaustive (from-type, to-type) -> sentence-template-key table, covering
 * every direction this app's DrugGraphRelationshipType set can actually
 * produce (see pathStepRelationLabelKey in drug_network_path_explanation.ts
 * for the same from/to switch used to derive viaLabelKey — this table
 * mirrors its coverage, not its wording). A pair genuinely not covered here
 * (or a relationship the enumerator did not classify to a specific label)
 * uses the neutral fallback sentence — never guessed.
 */
function sentenceTemplateKeyFor(
  fromType: DrugGraphNodeType,
  toType: DrugGraphNodeType,
): TranslationKey | null {
  if (fromType === "PERSON" && toType === "CASE") return "di.network.storySentencePersonToCase";
  if (fromType === "CASE" && toType === "PERSON") return "di.network.storySentenceCaseToPerson";
  if (fromType === "CASE" && toType === "PHONE") return "di.network.storySentenceCaseToPhone";
  if (fromType === "PHONE" && toType === "CASE") return "di.network.storySentencePhoneToCase";
  if (fromType === "PERSON" && toType === "PHONE") return "di.network.storySentencePersonToPhone";
  if (fromType === "PHONE" && toType === "PERSON") return "di.network.storySentencePhoneToPerson";
  if (fromType === "CASE" && toType === "DEVICE") return "di.network.storySentenceCaseToDevice";
  if (fromType === "DEVICE" && toType === "CASE") return "di.network.storySentenceDeviceToCase";
  if (fromType === "PERSON" && toType === "DEVICE") return "di.network.storySentencePersonToDevice";
  if (fromType === "DEVICE" && toType === "PERSON") return "di.network.storySentenceDeviceToPerson";
  if (fromType === "CASE" && toType === "SIM") return "di.network.storySentenceCaseToSim";
  if (fromType === "SIM" && toType === "CASE") return "di.network.storySentenceSimToCase";
  if (fromType === "CASE" && toType === "VEHICLE") return "di.network.storySentenceCaseToVehicle";
  if (fromType === "VEHICLE" && toType === "CASE") return "di.network.storySentenceVehicleToCase";
  if (fromType === "PERSON" && toType === "VEHICLE") return "di.network.storySentencePersonToVehicle";
  if (fromType === "VEHICLE" && toType === "PERSON") return "di.network.storySentenceVehicleToPerson";
  if (fromType === "CASE" && toType === "LOCATION") return "di.network.storySentenceCaseToLocation";
  if (fromType === "LOCATION" && toType === "CASE") return "di.network.storySentenceLocationToCase";
  return null;
}

/**
 * Composes the PREVIOUS→CURRENT sentence for one transition. Only ever uses
 * a specific directional template when the transition's actual recorded
 * relationship exists (viaRelationshipType is non-null) — an edge with no
 * recorded relationship type (should not happen for a real DI-8.4 path, but
 * defensively handled) falls back to the neutral wording rather than
 * picking a template based on entity types alone.
 */
function sentenceFor(
  previousLabel: string,
  currentLabel: string,
  fromType: DrugGraphNodeType,
  toType: DrugGraphNodeType,
  relationshipType: DrugGraphRelationshipType | null,
  translate: Translate,
): string {
  const key =
    relationshipType != null ? sentenceTemplateKeyFor(fromType, toType) : null;
  const template = key ? translate(key) : translate("di.network.storySentenceFallback");
  return template.replace("{previous}", previousLabel).replace("{current}", currentLabel);
}

/**
 * Builds the numbered Investigation Story for one already-hydrated path.
 * Pure — no I/O, no randomness. Same path in, same story out.
 */
export function buildNetworkPathStory(
  explanation: NetworkPathExplanation,
  path: NetworkExplainedPath,
  translate: Translate,
): NetworkPathStory {
  const steps: NetworkPathStoryStep[] = path.steps.map((step: NetworkPathStepExplanation, index) => {
    if (index === 0) {
      return {
        order: 1,
        kind: "origin",
        entityType: step.entityType,
        entityLabel: step.label,
        entitySecondaryLabel: step.secondaryLabel,
        headingKey: ORIGIN_HEADING_KEY,
        sentence: null,
        evidenceCaseIds: [],
        edgeKind: null,
        previousLabel: null,
      };
    }
    const prev = path.steps[index - 1]!;
    return {
      order: index + 1,
      kind: "transition",
      entityType: step.entityType,
      entityLabel: step.label,
      entitySecondaryLabel: step.secondaryLabel,
      headingKey: transitionHeadingKeyFor(prev.entityType, step.entityType),
      sentence: sentenceFor(prev.label, step.label, prev.entityType, step.entityType, step.viaRelationshipType, translate),
      evidenceCaseIds: step.supportingCaseIds,
      edgeKind: step.viaEdgeKind,
      previousLabel: prev.label,
    };
  });

  const conclusion = buildConclusion(explanation, path, translate);

  const primaryQuestionText = translate("di.network.storyPrimaryQuestion").replace(
    "{selected}",
    explanation.selectedLabel,
  );

  const breadcrumb = path.steps.map((step) => step.label);

  return { primaryQuestionText, steps, conclusion, breadcrumb };
}

function buildConclusion(
  explanation: NetworkPathExplanation,
  path: NetworkExplainedPath,
  translate: Translate,
): NetworkPathStoryConclusion {
  const isDirect = path.hopCount === 1;
  const hopCount = path.hopCount;
  const focusLabel = explanation.focusLabel;
  const selectedLabel = explanation.selectedLabel;
  const pathLabels = path.steps.map((step) => step.label);

  const leadText = isDirect
    ? translate("di.network.storyConclusionDirect").replace("{selected}", selectedLabel).replace("{focus}", focusLabel)
    : translate("di.network.storyConclusionIndirectLead").replace("{selected}", selectedLabel).replace("{focus}", focusLabel);

  const hopsText = isDirect
    ? null
    : translate("di.network.storyConclusionIndirectHops").replace("{hops}", String(hopCount));

  return { isDirect, hopCount, focusLabel, selectedLabel, leadText, hopsText, pathLabels };
}

/**
 * Short, derived-only path descriptor for the path switcher, e.g.
 * "เส้นทาง 1 · ผ่านคดี" / "เส้นทาง 2 · ผ่านคดีและบุคคล". Built purely from
 * the actual intermediate entity types on that specific path — never a
 * hardcoded/invented description. Returns null when there are no
 * intermediates (direct, 1-hop path) since there is nothing to describe.
 */
export function pathDescriptorFromIntermediates(
  path: NetworkExplainedPath,
  translate: Translate,
): string | null {
  const intermediates = path.steps.slice(1, -1);
  if (intermediates.length === 0) return null;
  const seen = new Set<DrugGraphNodeType>();
  const typeLabels: string[] = [];
  for (const step of intermediates) {
    if (seen.has(step.entityType)) continue;
    seen.add(step.entityType);
    typeLabels.push(translate(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[step.entityType]));
  }
  if (typeLabels.length === 0) return null;
  const joined = typeLabels.join(translate("di.network.storyDescriptorJoiner"));
  return translate("di.network.storyDescriptorVia").replace("{types}", joined);
}
