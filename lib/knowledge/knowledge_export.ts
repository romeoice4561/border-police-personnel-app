/**
 * Knowledge export (Phase 11A).
 *
 * Serializes a built KnowledgeBase to the knowledge/ JSON artifacts:
 * officers.json, units.json, ranks.json, phones.json, timeline.json, and
 * knowledge_summary.json. Maps (which don't serialize to useful JSON) are
 * converted to plain records/arrays here.
 *
 * The file writer is injected so this stays pure w.r.t. the filesystem and
 * testable; a default FilesystemKnowledgeWriter is provided for the runner.
 * No globals, no singleton, no OpenAI/OCR/Drive.
 */

import fs from "node:fs";
import path from "node:path";

import type {
  IndexedTimelineEntry,
  KnowledgeBase,
  KnowledgeOfficer,
} from "@/lib/knowledge/knowledge_types";
import { buildKnowledgeSummary } from "@/lib/knowledge/knowledge_statistics";

/** The serializable payloads written to knowledge/*.json. */
export interface KnowledgeExportPayloads {
  officers: KnowledgeOfficer[];
  /** Unit -> officer ids. */
  units: Record<string, string[]>;
  /** Rank -> officer ids. */
  ranks: Record<string, string[]>;
  /** Phone -> officer ids. */
  phones: Record<string, string[]>;
  /** Timeline year -> entries (with owning officer id). */
  timeline: Record<string, IndexedTimelineEntry[]>;
  knowledge_summary: ReturnType<typeof buildKnowledgeSummary>;
}

/** Injectable writer: given a relative filename and data, persist it. */
export interface KnowledgeWriter {
  write(filename: string, data: unknown): void;
}

/** Writes knowledge/<filename> as pretty JSON, creating the directory as needed. */
export class FilesystemKnowledgeWriter implements KnowledgeWriter {
  constructor(private readonly knowledgeDir: string) {}

  write(filename: string, data: unknown): void {
    fs.mkdirSync(this.knowledgeDir, { recursive: true });
    fs.writeFileSync(path.join(this.knowledgeDir, filename), JSON.stringify(data, null, 2));
  }
}

function mapOfOfficersToIds(map: Map<string, KnowledgeOfficer[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, officers] of map) {
    out[key] = officers.map((o) => o.identity.id);
  }
  return out;
}

function timelineMapToRecord(map: Map<number, IndexedTimelineEntry[]>): Record<string, IndexedTimelineEntry[]> {
  const out: Record<string, IndexedTimelineEntry[]> = {};
  for (const [year, entries] of map) {
    out[String(year)] = entries;
  }
  return out;
}

/** Builds the serializable payloads (pure — no I/O). */
export function buildExportPayloads(base: KnowledgeBase): KnowledgeExportPayloads {
  return {
    officers: base.officers,
    units: mapOfOfficersToIds(base.indexes.byUnit),
    ranks: mapOfOfficersToIds(base.indexes.byRank),
    phones: mapOfOfficersToIds(base.indexes.byPhone),
    timeline: timelineMapToRecord(base.indexes.byTimelineYear),
    knowledge_summary: buildKnowledgeSummary(base),
  };
}

/** Writes all knowledge/*.json artifacts via the injected writer. */
export function exportKnowledge(base: KnowledgeBase, writer: KnowledgeWriter): KnowledgeExportPayloads {
  const payloads = buildExportPayloads(base);

  writer.write("officers.json", payloads.officers);
  writer.write("units.json", payloads.units);
  writer.write("ranks.json", payloads.ranks);
  writer.write("phones.json", payloads.phones);
  writer.write("timeline.json", payloads.timeline);
  writer.write("knowledge_summary.json", payloads.knowledge_summary);

  return payloads;
}
