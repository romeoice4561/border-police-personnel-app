/**
 * PhoneRepository (Phase 12).
 *
 * Repository-pattern access for Phone rows over an injected DatabaseClient.
 * A phone is unique per (officer, number); upsert on that pair means
 * re-import never duplicates an officer's phone. Pure data access — no
 * business logic, no OpenAI/OCR/Drive.
 */

import type { DatabaseClient, Phone } from "@/lib/database/database_types";

export class PhoneRepository {
  constructor(private readonly db: DatabaseClient) {}

  /** Idempotent upsert on (officerId, number). Returns whether the row was created. */
  async upsert(officerId: number, number: string): Promise<{ phone: Phone; created: boolean }> {
    const existing = await this.db.phone.findUnique({
      where: { officerId_number: { officerId, number } },
    });
    const phone = await this.db.phone.upsert({
      where: { officerId_number: { officerId, number } },
      create: { officerId, number },
      update: { number },
    });
    return { phone, created: existing === null };
  }

  countForOfficer(officerId: number): Promise<number> {
    return this.db.phone.count({ where: { officerId } });
  }
}
