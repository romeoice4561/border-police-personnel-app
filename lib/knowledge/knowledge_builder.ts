/**
 * KnowledgeBuilder (Phase 11A).
 *
 * Reads every exported personnel JSON under exports/ and builds an in-memory
 * KnowledgeBase (officers + indexes). Read-only consumer: it never calls
 * OpenAI/OCR/Google Drive/a database and never modifies the pipeline or its
 * exports — it only maps what the pipeline wrote into the knowledge model and
 * derives per-officer facts.
 *
 * File access is injected via an ExportSource so the builder is pure w.r.t.
 * the filesystem and fully testable with in-memory fixtures (no globals, no
 * singleton). A default FilesystemExportSource is provided for the runner.
 */

import fs from "node:fs";
import path from "node:path";

import type { PersonnelExtraction, TimelineEntry } from "@/lib/types/vision";
import type {
  ExportedOfficerFile,
  KnowledgeBase,
  KnowledgeOfficer,
  OfficerCareer,
} from "@/lib/knowledge/knowledge_types";
import { buildIndexes } from "@/lib/knowledge/knowledge_index";
import { extractTimelineYear } from "@/lib/knowledge/timeline_index";

/** One raw export file: where it came from plus its parsed contents. */
export interface RawExport {
  /** Path/key of the file, used to derive a stable officer id. */
  key: string;
  data: ExportedOfficerFile;
}

/** Injectable source of exported officer JSON. Keeps the builder filesystem-pure. */
export interface ExportSource {
  read(): RawExport[];
}

/**
 * Reads exports/<region>/<file>.json from disk, skipping classifier
 * `.skipped.json` markers (those are not officer records). Only *.json files
 * are read; parse failures are skipped rather than aborting the whole build.
 */
export class FilesystemExportSource implements ExportSource {
  constructor(private readonly exportsDir: string) {}

  read(): RawExport[] {
    if (!fs.existsSync(this.exportsDir)) return [];

    const results: RawExport[] = [];
    this.walk(this.exportsDir, results);
    return results;
  }

  private walk(dir: string, out: RawExport[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walk(full, out);
        continue;
      }
      if (!entry.name.endsWith(".json")) continue;
      if (entry.name.endsWith(".skipped.json")) continue; // classifier skip markers are not officers

      try {
        const data = JSON.parse(fs.readFileSync(full, "utf-8")) as ExportedOfficerFile;
        out.push({ key: path.relative(this.exportsDir, full), data });
      } catch {
        // A malformed export must not break knowledge-building for the rest.
      }
    }
  }
}

export interface KnowledgeBuilderDependencies {
  source: ExportSource;
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Distinct, trimmed, non-empty units from the top-level unit + every timeline unit, preserving first-seen order. */
function collectUnits(extraction: PersonnelExtraction): string[] {
  const seen = new Set<string>();
  const units: string[] = [];

  const add = (value: string | null | undefined) => {
    if (!nonEmpty(value)) return;
    const trimmed = value.trim();
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    units.push(trimmed);
  };

  add(extraction.unit);
  for (const entry of extraction.timeline) add(entry.unit);

  return units;
}

/** Derives the numeric first/last career year from the timeline (null when none parseable). */
function deriveYearBounds(timeline: TimelineEntry[]): { first: number | null; last: number | null } {
  const years: number[] = [];
  for (const entry of timeline) {
    const year = extractTimelineYear(entry.year);
    if (year !== null) years.push(year);
  }
  if (years.length === 0) return { first: null, last: null };
  return { first: Math.min(...years), last: Math.max(...years) };
}

/**
 * The most-recent timeline entry, preferring an explicit "present" marker,
 * else the entry with the highest parseable year, else the first listed
 * entry (these records are conventionally written newest-first).
 */
function mostRecentEntry(timeline: TimelineEntry[]): TimelineEntry | null {
  if (timeline.length === 0) return null;

  const presentMarkers = ["ปัจจุบัน", "present", "current"];
  const present = timeline.find((e) => presentMarkers.some((m) => (e.year ?? "").toLowerCase().includes(m)));
  if (present) return present;

  let best: TimelineEntry | null = null;
  let bestYear = Number.NEGATIVE_INFINITY;
  for (const entry of timeline) {
    const year = extractTimelineYear(entry.year);
    if (year !== null && year > bestYear) {
      bestYear = year;
      best = entry;
    }
  }
  return best ?? timeline[0];
}

/**
 * Builds the Personnel Knowledge Base from exported JSON. Pure over its
 * injected ExportSource.
 */
export class KnowledgeBuilder {
  private readonly source: ExportSource;

  constructor(dependencies: KnowledgeBuilderDependencies) {
    this.source = dependencies.source;
  }

  build(): KnowledgeBase {
    const officers: KnowledgeOfficer[] = [];

    for (const raw of this.source.read()) {
      const officer = this.toOfficer(raw.key, raw.data);
      if (officer) officers.push(officer);
    }

    return { officers, indexes: buildIndexes(officers) };
  }

  /** Maps one export file to a KnowledgeOfficer, or null if it has no usable extraction. */
  private toOfficer(key: string, file: ExportedOfficerFile): KnowledgeOfficer | null {
    // Prefer the normalized (canonical) extraction; fall back to the original.
    const extraction = file.normalized_extraction ?? file.original_extraction;
    if (!extraction) return null;

    const region = file.region ?? this.regionFromKey(key);
    const sourceFile = file.source_file ?? path.basename(key);
    const id = this.officerId(region, sourceFile);

    const timeline = Array.isArray(extraction.timeline) ? extraction.timeline : [];
    const units = collectUnits(extraction);
    const { first, last } = deriveYearBounds(timeline);
    const recent = mostRecentEntry(timeline);

    // Career length: prefer the pipeline's own careerYears; else derive from
    // the year bounds. Never invents a value when neither is available.
    const careerLength =
      file.career_intelligence?.careerYears ??
      (first !== null && last !== null ? last - first : 0);

    const career: OfficerCareer = {
      position: extraction.position ?? "",
      unit: extraction.unit ?? "",
      phone: extraction.phone ?? "",
      career_length: careerLength,
      unit_count: file.career_intelligence?.unitCount ?? units.length,
      first_year: first,
      last_year: last,
      current_unit: recent && nonEmpty(recent.unit) ? recent.unit!.trim() : nonEmpty(extraction.unit) ? extraction.unit.trim() : null,
      current_position: recent && nonEmpty(recent.position) ? recent.position.trim() : nonEmpty(extraction.position) ? extraction.position.trim() : null,
      timeline_count: timeline.length,
    };

    const firstName = (extraction.first_name ?? "").trim();
    const lastName = (extraction.last_name ?? "").trim();

    return {
      identity: {
        id,
        rank: (extraction.rank ?? "").trim(),
        first_name: firstName,
        last_name: lastName,
        full_name: [firstName, lastName].filter((p) => p.length > 0).join(" "),
        region,
        source_file: sourceFile,
      },
      career,
      timeline,
      units,
      statistics: {
        career_length: career.career_length,
        unit_count: career.unit_count,
        timeline_count: career.timeline_count,
        first_year: first,
        last_year: last,
      },
      confidence: extraction.confidence ?? file.confidence ?? 0,
    };
  }

  /** Region derived from the export path (exports/<region>/<file>) when the file omits it. */
  private regionFromKey(key: string): string {
    const parts = key.split(/[\\/]/);
    return parts.length > 1 ? parts[0] : "";
  }

  /** Deterministic officer id from region + source file, so re-runs are stable. */
  private officerId(region: string, sourceFile: string): string {
    const base = sourceFile.replace(/\.[^.]+$/, "");
    return region ? `${region}/${base}` : base;
  }
}
