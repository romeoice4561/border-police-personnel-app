/**
 * Unit tests for the DatabaseImporter (Phase 12) over the in-memory fake
 * client: end-to-end persistence, IDEMPOTENCY (second run creates 0
 * duplicates), and TRANSACTION ROLLBACK (a failing officer leaves no partial
 * rows and doesn't abort the run). No live database.
 *
 * Run with:
 *   npx tsx --test lib/database/__tests__/database_importer.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { DatabaseImporter, type ImportableOfficer } from "@/lib/database/database_importer";
import type { KnowledgeOfficer } from "@/lib/knowledge/knowledge_types";

function officer(id: string, ov: Partial<KnowledgeOfficer["career"]> = {}): KnowledgeOfficer {
  return {
    identity: {
      id,
      rank: "ร.ต.ท.",
      first_name: "A",
      last_name: id,
      full_name: `A ${id}`,
      region: id.split("/")[0] ?? "",
      source_file: `${id}.jpg`,
    },
    career: {
      position: "ผบ.ร้อย",
      unit: "ตชด.447",
      phone: "081-540-7336",
      career_length: 19,
      unit_count: 2,
      first_year: 2545,
      last_year: 2564,
      current_unit: "ตชด.447",
      current_position: "ผบ.ร้อย",
      timeline_count: 2,
      ...ov,
    },
    timeline: [
      { year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" },
      { year: "2560", position: "ผบ.มว.", unit: "ตชด.100" },
    ],
    units: ["ตชด.447", "ตชด.100"],
    statistics: { career_length: 19, unit_count: 2, timeline_count: 2, first_year: 2545, last_year: 2564 },
    confidence: 80,
  };
}

function importable(o: KnowledgeOfficer, qualityScore = 90): ImportableOfficer {
  return { officer: o, qualityScore };
}

test("imports officers, timelines, phones, and units", async () => {
  const db = new InMemoryDatabaseClient();
  const summary = await new DatabaseImporter({ client: db }).import([
    importable(officer("ภาค1/5")),
    importable(officer("ภาค2/7")),
  ]);

  assert.equal(summary.officers_created, 2);
  assert.equal(summary.officers_updated, 0);
  assert.equal(summary.timelines_created, 4); // 2 each
  assert.equal(summary.errors, 0);

  const counts = db.counts();
  assert.equal(counts.officers, 2);
  assert.equal(counts.timelines, 4);
  assert.equal(counts.phones, 2);
  assert.equal(counts.units, 2); // ตชด.447 + ตชด.100 deduped across both officers
});

test("IDEMPOTENT: a second identical import creates 0 duplicate officers/timelines", async () => {
  const db = new InMemoryDatabaseClient();
  const importer = new DatabaseImporter({ client: db });
  const officers = [importable(officer("ภาค1/5")), importable(officer("ภาค2/7"))];

  const first = await importer.import(officers);
  assert.equal(first.officers_created, 2);

  const second = await importer.import(officers);
  assert.equal(second.officers_created, 0);
  assert.equal(second.officers_updated, 2);
  assert.equal(second.duplicates_skipped, 2);

  // Row counts are unchanged — no duplicate rows anywhere.
  const counts = db.counts();
  assert.equal(counts.officers, 2);
  assert.equal(counts.timelines, 4);
  assert.equal(counts.phones, 2);
  assert.equal(counts.units, 2);
});

test("re-import with a shorter timeline replaces (no orphan/duplicate rows)", async () => {
  const db = new InMemoryDatabaseClient();
  const importer = new DatabaseImporter({ client: db });

  await importer.import([importable(officer("ภาค1/5"))]);
  assert.equal(db.counts().timelines, 2);

  const shortened = officer("ภาค1/5");
  shortened.timeline = [{ year: "2565", position: "x", unit: "U" }];
  await importer.import([importable(shortened)]);

  assert.equal(db.counts().timelines, 1); // replaced, not appended
  assert.equal(db.counts().officers, 1);
});

test("TRANSACTION ROLLBACK: a failing officer leaves no partial rows and does not abort the run", async () => {
  // timeline.create throws for the flagged officer, forcing a failure AFTER
  // that officer's row was upserted within the transaction.
  const db = new InMemoryDatabaseClient();
  db.failOnOfficerId = "ภาค1/FAILS";

  const summary = await new DatabaseImporter({ client: db }).import([
    importable(officer("ภาค1/FAILS")), // upsert succeeds, then timeline.create throws -> rollback
    importable(officer("ภาค2/OK")),
  ]);

  assert.equal(summary.errors, 1);
  assert.equal(summary.officers_created, 1); // only the OK officer persisted

  const counts = db.counts();
  assert.equal(counts.officers, 1); // the failed officer's upsert was rolled back
  assert.equal(counts.timelines, 2); // only the OK officer's 2 rows
  // An error log line was recorded for the failed officer.
  const errorLogs = db.logRows().filter((l) => l.action === "error");
  assert.equal(errorLogs.length, 1);
  assert.equal(errorLogs[0].officerId, "ภาค1/FAILS");
});

test("records per-officer import log lines with created/updated actions", async () => {
  const db = new InMemoryDatabaseClient();
  const importer = new DatabaseImporter({ client: db });
  await importer.import([importable(officer("ภาค1/5"))]);
  await importer.import([importable(officer("ภาค1/5"))]);

  const actions = db.logRows().map((l) => l.action);
  assert.deepEqual(actions, ["created", "updated"]);
});

test("empty import produces a zeroed summary and one job", async () => {
  const db = new InMemoryDatabaseClient();
  const summary = await new DatabaseImporter({ client: db }).import([]);
  assert.equal(summary.officers_created, 0);
  assert.equal(summary.duplicates_skipped, 0);
  assert.equal(db.counts().jobs, 1);
});
