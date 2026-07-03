/**
 * UnitRepository (Phase 12).
 *
 * Repository-pattern access for Unit rows over an injected DatabaseClient.
 * Units are deduplicated by their unique `name`: upsert never creates a
 * second row for a name already present, so re-import produces no duplicate
 * units. Pure data access — no business logic, no OpenAI/OCR/Drive.
 */

import type { DatabaseClient, Unit } from "@/lib/database/database_types";

export class UnitRepository {
  constructor(private readonly db: DatabaseClient) {}

  findByName(name: string): Promise<Unit | null> {
    return this.db.unit.findUnique({ where: { name } });
  }

  /** Idempotent: creates the unit if new, otherwise leaves it in place. Returns whether it was created. */
  async upsert(name: string, officerCount: number): Promise<{ unit: Unit; created: boolean }> {
    const existing = await this.db.unit.findUnique({ where: { name } });
    const unit = await this.db.unit.upsert({
      where: { name },
      create: { name, officerCount },
      update: { officerCount },
    });
    return { unit, created: existing === null };
  }

  count(): Promise<number> {
    return this.db.unit.count();
  }
}
