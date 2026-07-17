/**
 * Server-side adapter for Commander Intelligence UI.
 *
 * Maps persisted officer data into the pure Phase 36 intelligence engine.
 * No React and no business logic in UI components.
 */

import "server-only";
import { createDatabaseClient } from "@/lib/database/database";
import type { OfficerWithRelations, ReadDatabaseClient } from "@/lib/database/query_types";
import { OfficerQueryRepository } from "@/lib/database/repositories/officer_query_repository";
import { buildCommanderDashboard, type CommanderDashboard, type OfficerIntelligenceCard } from "@/lib/intelligence";
import { toIntelligenceInput, buildOfficerProfileIntelligence } from "@/lib/intelligence/officer_intelligence_input";

// Phase 44: re-exported for existing call sites — the pure composition
// itself now lives in lib/intelligence/officer_intelligence_input.ts (no
// server-only import) so it can be unit-tested and reused by
// lib/commander_query/query_officer.ts without pulling in Prisma.
export { buildOfficerProfileIntelligence };

let cachedRepository: OfficerQueryRepository | undefined;

function officerRepository(): OfficerQueryRepository {
  if (!cachedRepository) {
    const client = createDatabaseClient() as unknown as ReadDatabaseClient;
    cachedRepository = new OfficerQueryRepository(client);
  }
  return cachedRepository;
}

export async function loadCommanderOfficerProfiles(): Promise<OfficerWithRelations[]> {
  const client = createDatabaseClient() as unknown as {
    officer: {
      findMany(args: Record<string, unknown>): Promise<OfficerWithRelations[]>;
    };
  };
  return client.officer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      timeline: { orderBy: { sequence: "asc" } },
      phones: true,
      education: { orderBy: { id: "asc" } },
      training: { orderBy: { id: "asc" } },
      salaryHistory: { orderBy: { yearBE: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      // Phase 44: skills with skill (+ category) and level resolved, so the
      // commander read model and dashboard can derive skill signals. Additive
      // include only — the intelligence computation itself is unchanged.
      skills: { include: { skill: { include: { category: true } }, level: true }, orderBy: { id: "asc" } },
    },
  });
}

export async function getCommanderDashboardIntelligence(): Promise<CommanderDashboard> {
  const officers = await loadCommanderOfficerProfiles();
  return buildCommanderDashboard(officers.map((officer) => toIntelligenceInput(officer)));
}

export async function getOfficerIntelligence(officerId: string): Promise<OfficerIntelligenceCard | null> {
  const officer = await officerRepository().findByOfficerId(officerId);
  return officer ? buildOfficerProfileIntelligence(officer) : null;
}
