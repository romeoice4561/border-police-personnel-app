/**
 * DrugNetworkGroupRepository (Phase DI-7.2).
 *
 * Canonical shared network/group entity lookups. Never silently creates a
 * group from free text — creation is always an explicit authorized action
 * (drug.edit gate enforced at the API handler layer).
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";

export interface DrugNetworkGroupRow {
  id: string;
  name: string;
  aliases: string | null;
  description: string | null;
  note: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DrugNetworkGroupCreateInput {
  name: string;
  aliases: string | null;
  description: string | null;
  note: string | null;
  createdBy: string;
}

export class DrugNetworkGroupRepository {
  constructor(private readonly db: DatabaseClient) {}

  findById(id: string): Promise<DrugNetworkGroupRow | null> {
    return this.db.drugNetworkGroup.findUnique({ where: { id } }) as Promise<DrugNetworkGroupRow | null>;
  }

  /** Returns all groups ordered by name — used for the searchable combobox. */
  findAll(): Promise<DrugNetworkGroupRow[]> {
    return this.db.drugNetworkGroup.findMany({ orderBy: { name: "asc" } }) as Promise<DrugNetworkGroupRow[]>;
  }

  /**
   * In-memory name/alias substring search (no DB text index needed at this
   * scale — groups are few and the combobox queries on keystroke).
   */
  async search(query: string): Promise<DrugNetworkGroupRow[]> {
    const all = await this.findAll();
    if (!query.trim()) return all;
    const needle = query.trim().toLowerCase();
    return all.filter(
      (g) =>
        g.name.toLowerCase().includes(needle) ||
        (g.aliases ?? "").toLowerCase().includes(needle)
    );
  }

  create(input: DrugNetworkGroupCreateInput): Promise<DrugNetworkGroupRow> {
    return this.db.drugNetworkGroup.create({ data: { id: generateDrugId(), ...input } as unknown as Record<string, unknown> }) as Promise<DrugNetworkGroupRow>;
  }

  /** Add a membership assertion between a person and a group. */
  addMembership(data: {
    personId: string;
    networkGroupId: string;
    source: string | null;
    status: string | null;
    note: string | null;
    firstObservedAt: Date | null;
    lastObservedAt: Date | null;
    createdBy: string;
  }) {
    return this.db.drugPersonNetworkMembership.create({ data: { id: generateDrugId(), ...data } });
  }
}
