/**
 * QualityEngine (Phase 11B).
 *
 * Scores each officer's data quality and explains it. Read-only: it consumes
 * the exported extraction (for field/notes/confidence signals) and the
 * Phase 11A KnowledgeBase (for derived career facts and cross-record
 * duplicate participation), and produces an OfficerQuality report. It never
 * modifies any extracted data and never touches OCR/OpenAI/Repair/Validation/
 * Normalization/Career/Knowledge code.
 *
 * The overall score is a weighted blend of the five completeness dimensions;
 * the category is banded per the phase spec. Everything is pure; the engine is
 * injectable with custom weights but has no globals or singletons.
 */

import type { PersonnelExtraction } from "@/lib/types/vision";
import type { KnowledgeBase, KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";
import type {
  CompletenessBreakdown,
  OfficerQuality,
  QualityCategory,
  QualityReport,
} from "@/lib/quality/quality_types";
import {
  fieldCompletenessScore,
  identityCompletenessScore,
  missingFields,
  phoneQualityScore,
} from "@/lib/quality/field_completeness";
import { analyzeTimeline } from "@/lib/quality/timeline_quality";
import {
  buildDuplicateParticipation,
  careerQualityScore,
  type DuplicateParticipation,
} from "@/lib/quality/knowledge_quality";
import { buildRecommendations, buildWarnings } from "@/lib/quality/quality_rules";

/** Weights for the overall score (sum to 1). Injectable for tuning. */
export interface QualityWeights {
  field: number;
  timeline: number;
  identity: number;
  phone: number;
  career: number;
}

const DEFAULT_WEIGHTS: QualityWeights = {
  field: 0.25,
  identity: 0.3,
  timeline: 0.2,
  career: 0.15,
  phone: 0.1,
};

/** One officer paired with its raw extraction, as fed to the engine. */
export interface OfficerRecord {
  officer: KnowledgeOfficer;
  extraction: PersonnelExtraction;
}

export function categorize(score: number): QualityCategory {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Poor";
}

export interface QualityEngineDependencies {
  weights?: QualityWeights;
}

export class QualityEngine {
  private readonly weights: QualityWeights;

  constructor(dependencies: QualityEngineDependencies = {}) {
    this.weights = dependencies.weights ?? DEFAULT_WEIGHTS;
  }

  /** Scores one officer record against the shared duplicate-participation sets. */
  scoreOfficer(record: OfficerRecord, duplicates: DuplicateParticipation): OfficerQuality {
    const { officer, extraction } = record;
    const timeline = analyzeTimeline(extraction.timeline);

    const completeness: CompletenessBreakdown = {
      field_completeness: fieldCompletenessScore(extraction),
      timeline_completeness: timeline.score,
      identity_completeness: identityCompletenessScore(extraction),
      phone_quality: phoneQualityScore(extraction),
      career_quality: careerQualityScore(officer),
    };

    const quality_score = Math.round(
      completeness.field_completeness * this.weights.field +
        completeness.identity_completeness * this.weights.identity +
        completeness.timeline_completeness * this.weights.timeline +
        completeness.career_quality * this.weights.career +
        completeness.phone_quality * this.weights.phone
    );

    const context = {
      extraction,
      timeline,
      inDuplicatePhoneGroup: duplicates.duplicatePhoneIds.has(officer.identity.id),
      inDuplicateOfficerGroup: duplicates.duplicateOfficerIds.has(officer.identity.id),
      inDuplicateTimelineGroup: duplicates.duplicateTimelineIds.has(officer.identity.id),
    };

    return {
      officer_id: officer.identity.id,
      quality_score,
      category: categorize(quality_score),
      completeness,
      missing_fields: missingFields(extraction),
      warnings: buildWarnings(context),
      recommendations: buildRecommendations(context),
    };
  }

  /** Scores every officer record, building the duplicate-participation sets once from the base. */
  analyze(records: OfficerRecord[], base: KnowledgeBase): QualityReport {
    const duplicates = buildDuplicateParticipation(base);
    return { officers: records.map((record) => this.scoreOfficer(record, duplicates)) };
  }
}
