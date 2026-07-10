/**
 * Timeline Structured Date Backfill (Phase 26B Part 3).
 *
 * One-time, re-runnable migration of existing Timeline rows' legacy
 * free-text `year` into the new structured day/month/yearBE/isPresent/
 * effectiveDate columns (added by prisma/migrations/
 * 20260712000000_timeline_structured_date, additive/nullable). Uses
 * lib/officer_profile/thai_date.ts's parseLegacyTimelineYear — the exact
 * same parser covered by lib/officer_profile/__tests__/thai_date.test.ts.
 *
 * SAFE BY DEFAULT: dry-run unless --apply is passed. Never touches the
 * legacy `year`/`yearValue` columns (untouched, unread even) — only ever
 * WRITES the new columns, and only for rows that don't already have a
 * yearBE (so re-running after a human has edited a row through the new
 * editor never clobbers their edit). A row whose free text can't be parsed
 * is left with day/month/yearBE/effectiveDate = null, isPresent = false —
 * exactly its current state — for a human to fill in via the editor; the
 * script never guesses.
 *
 * Usage:
 *   npx tsx scripts/backfill_timeline_structured_dates.ts             # dry run, prints a report
 *   npx tsx scripts/backfill_timeline_structured_dates.ts --apply     # writes the parsed rows
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const ENV_FILES = [".env.local", ".env"];
for (const envFile of ENV_FILES) {
  const envPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
}

import { createDatabaseClient } from "@/lib/database/database";
import { parseLegacyTimelineYear, toEffectiveDate } from "@/lib/officer_profile/thai_date";

const APPLY = process.argv.includes("--apply");

interface TimelineRow {
  id: number;
  year: string;
  yearBE: number | null;
}

async function main() {
  const db = createDatabaseClient() as unknown as {
    timeline: {
      findMany(args: { select: Record<string, boolean> }): Promise<TimelineRow[]>;
      update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<unknown>;
    };
  };

  // Only rows never migrated (yearBE still null) — re-running never clobbers
  // a row a human has since edited through the new structured-date editor.
  const rows = await db.timeline.findMany({ select: { id: true, year: true, yearBE: true } });
  const candidates = rows.filter((r) => r.yearBE === null);

  let parsed = 0;
  let unparsed = 0;
  const unparsedSamples: string[] = [];

  for (const row of candidates) {
    const result = parseLegacyTimelineYear(row.year);
    if (result.yearBE === null && !result.isPresent) {
      unparsed += 1;
      if (unparsedSamples.length < 20) unparsedSamples.push(row.year);
      continue;
    }
    parsed += 1;

    if (APPLY) {
      const effectiveDate = toEffectiveDate(result);
      await db.timeline.update({
        where: { id: row.id },
        data: {
          day: result.day,
          month: result.month,
          yearBE: result.yearBE,
          isPresent: result.isPresent,
          effectiveDate,
        },
      });
    }
  }

  console.log(`Timeline rows total: ${rows.length}`);
  console.log(`Already migrated (yearBE set): ${rows.length - candidates.length}`);
  console.log(`Candidates for backfill: ${candidates.length}`);
  console.log(`  Parsed successfully: ${parsed}`);
  console.log(`  Left unparsed (human must fill in via editor): ${unparsed}`);
  if (unparsedSamples.length > 0) {
    console.log(`  Unparsed samples: ${unparsedSamples.join(" | ")}`);
  }
  console.log(APPLY ? "\nMode: APPLY — rows above were written." : "\nMode: DRY RUN — no rows were written. Re-run with --apply to write.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
