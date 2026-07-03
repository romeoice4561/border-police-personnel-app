/**
 * Shared types for the Personnel Knowledge Layer (Phase 11A).
 *
 * The Knowledge Layer is a pure, read-only consumer of the exported
 * personnel JSON (exports/*.json). It NEVER calls OpenAI/OCR/Google Drive/a
 * database, and never modifies the pipeline or its outputs — it only reads
 * what the pipeline already wrote and builds in-memory indexes + a knowledge
 * model over it.
 *
 * Pure domain typing only.
 */

import type { PersonnelExtraction, TimelineEntry } from "@/lib/types/vision";
import type { CareerIntelligence } from "@/lib/career/career_engine";

/**
 * The subset of an exported officer JSON the Knowledge Layer reads. Declared
 * as the fields we consume (not the full export) and tolerant of shape drift
 * across pipeline versions: older exports lack `source_id`/`repair_report`,
 * so everything beyond the core extraction is optional. `normalized_extraction`
 * is preferred as the canonical record; `original_extraction` is a fallback.
 */
export interface ExportedOfficerFile {
  source_file?: string;
  region?: string;
  processing_timestamp?: string;
  original_extraction?: PersonnelExtraction;
  normalized_extraction?: PersonnelExtraction;
  career_intelligence?: CareerIntelligence;
  confidence?: number;
}

/** Stable identity block for one officer. */
export interface OfficerIdentity {
  /** Deterministic id derived from region + source file (see knowledge_builder). */
  id: string;
  rank: string;
  first_name: string;
  last_name: string;
  full_name: string;
  region: string;
  source_file: string;
}

/** Career facts, sourced from the pipeline's Career Engine output plus derived fields. */
export interface OfficerCareer {
  position: string;
  unit: string;
  phone: string;
  /** Derived: latestYear - earliestYear when both known, else the pipeline's careerYears. */
  career_length: number;
  /** Derived: number of distinct units across the timeline. */
  unit_count: number;
  /** Derived: earliest timeline year (numeric) if any. */
  first_year: number | null;
  /** Derived: latest timeline year (numeric) if any. */
  last_year: number | null;
  /** Derived: unit of the most-recent timeline entry, falling back to the top-level unit. */
  current_unit: string | null;
  /** Derived: position of the most-recent timeline entry, falling back to the top-level position. */
  current_position: string | null;
  /** Derived: number of timeline entries. */
  timeline_count: number;
}

/** One officer as represented in the knowledge model. */
export interface KnowledgeOfficer {
  identity: OfficerIdentity;
  career: OfficerCareer;
  timeline: TimelineEntry[];
  /** Distinct, non-empty units this officer has served in (identity/top-level + timeline). */
  units: string[];
  /** Per-officer stats (mirrors the derived career facts for convenient reporting). */
  statistics: {
    career_length: number;
    unit_count: number;
    timeline_count: number;
    first_year: number | null;
    last_year: number | null;
  };
  confidence: number;
}

/** All in-memory indexes over the officer set. */
export interface KnowledgeIndexes {
  /** Officer id -> officer. */
  byId: Map<string, KnowledgeOfficer>;
  /** Rank -> officers with that rank. */
  byRank: Map<string, KnowledgeOfficer[]>;
  /** Unit -> officers who served in that unit. */
  byUnit: Map<string, KnowledgeOfficer[]>;
  /** Phone -> officer(s) with that phone (usually one; >1 signals a duplicate). */
  byPhone: Map<string, KnowledgeOfficer[]>;
  /** Career (timeline) year -> officers active in that year. */
  byCareerYear: Map<number, KnowledgeOfficer[]>;
  /** Timeline year -> the timeline entries dated to that year (across all officers). */
  byTimelineYear: Map<number, IndexedTimelineEntry[]>;
}

/** A timeline entry tagged with the officer it belongs to, for the timeline-year index. */
export interface IndexedTimelineEntry {
  officerId: string;
  entry: TimelineEntry;
}

/** The full knowledge base: officers plus every index. */
export interface KnowledgeBase {
  officers: KnowledgeOfficer[];
  indexes: KnowledgeIndexes;
}

/** A detected duplicate group (detection only — never modifies data). */
export interface DuplicateGroup {
  key: string;
  officerIds: string[];
}

/** Duplicate-detection report across the knowledge base. */
export interface DuplicateReport {
  duplicate_phones: DuplicateGroup[];
  duplicate_officers: DuplicateGroup[];
  duplicate_timeline: DuplicateGroup[];
  duplicate_units: DuplicateGroup[];
}

/** The logs/knowledge_summary.json shape. */
export interface KnowledgeSummary {
  total_officers: number;
  total_units: number;
  total_phone_numbers: number;
  total_timeline_entries: number;
  average_career_years: number;
  average_unit_changes: number;
  highest_rank: string | null;
  lowest_rank: string | null;
  duplicate_phone_count: number;
  duplicate_name_count: number;
}
