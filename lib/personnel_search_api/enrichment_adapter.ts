/**
 * Batch nickname / phone enrichment for Personnel Search (Phase 51.1).
 * Does not mutate CommanderQueryOfficer. Failures yield an empty map.
 */
import "server-only";

import { createDatabaseClient } from "@/lib/database/database";
import type { PersonnelSearchEnrichment } from "@/lib/personnel_search/contracts";

export type EnrichmentLoader = () => Promise<ReadonlyMap<string, PersonnelSearchEnrichment>>;

/**
 * One batch read of nickname + officer.phone + Phone[] rows.
 * Officer.phone is treated as duty/official contact; Phone[] as additional numbers.
 */
export async function loadPersonnelSearchEnrichment(): Promise<ReadonlyMap<string, PersonnelSearchEnrichment>> {
  try {
    const db = createDatabaseClient();
    const rows = await db.officer.findMany({
      select: {
        officerId: true,
        nickname: true,
        phone: true,
        phones: { select: { number: true } },
      },
    });

    const map = new Map<string, PersonnelSearchEnrichment>();
    for (const row of rows) {
      const phones = row.phones.map((p) => p.number).filter(Boolean);
      const dutyPhone = row.phone?.trim() || null;
      if (!row.nickname && phones.length === 0 && !dutyPhone) continue;
      map.set(row.officerId, {
        nickname: row.nickname?.trim() || null,
        phones: phones.length > 0 ? phones : undefined,
        dutyPhone,
      });
    }
    return map;
  } catch {
    // Absent enrichment must not fail the search.
    return new Map();
  }
}
