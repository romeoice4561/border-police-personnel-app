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

  /** Removes all phone rows for an officer (used before a clean re-insert). */
  deleteForOfficer(officerId: number): Promise<{ count: number }> {
    return this.db.phone.deleteMany({ where: { officerId } });
  }

  /**
   * Replaces an officer's phone rows with `numbers` (delete-all then insert
   * the distinct, non-empty numbers), making phone persistence idempotent:
   * re-importing the same record leaves exactly the current set with no
   * duplicates. Returns the number of rows written. Distinct is enforced so
   * a repeated number in the input never violates the (officerId, number)
   * unique constraint.
   */
  async replaceForOfficer(officerId: number, numbers: string[]): Promise<number> {
    await this.deleteForOfficer(officerId);
    const distinct = Array.from(new Set(numbers.map((n) => n.trim()).filter((n) => n.length > 0)));
    for (const number of distinct) {
      await this.db.phone.create({ data: { officerId, number } });
    }
    return distinct.length;
  }

  countForOfficer(officerId: number): Promise<number> {
    return this.db.phone.count({ where: { officerId } });
  }
}
