/**
 * DrugPersonNetworkRoleRepository (Phase DI-7.3).
 *
 * Append-only store for network-role assertions. Never updates or deletes a
 * prior assertion — historical records must remain visible (spec G).
 * Verification status changes are recorded as NEW rows, not overwrites.
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { generateDrugId } from "@/lib/drug_intelligence/drug_id";

export interface DrugPersonNetworkRoleRow {
  id: string;
  personId: string;
  sourceCaseId: string | null;
  role: string;
  source: string | null;
  verificationStatus: string;
  note: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DrugPersonNetworkRoleCreateInput {
  personId: string;
  sourceCaseId: string | null;
  role: string;
  source: string | null;
  /** Defaults to "UNVERIFIED" if not supplied. */
  verificationStatus?: string;
  note: string | null;
  createdBy: string;
  createdByName: string;
}

export class DrugPersonNetworkRoleRepository {
  constructor(private readonly db: DatabaseClient) {}

  forPerson(personId: string): Promise<DrugPersonNetworkRoleRow[]> {
    return this.db.drugPersonNetworkRole.findMany({
      where: { personId },
      orderBy: { createdAt: "asc" },
    }) as Promise<DrugPersonNetworkRoleRow[]>;
  }

  forCase(sourceCaseId: string): Promise<DrugPersonNetworkRoleRow[]> {
    return this.db.drugPersonNetworkRole.findMany({
      where: { sourceCaseId },
      orderBy: { createdAt: "asc" },
    }) as Promise<DrugPersonNetworkRoleRow[]>;
  }

  /** Append-only create — never called with an id for update. */
  create(input: DrugPersonNetworkRoleCreateInput): Promise<DrugPersonNetworkRoleRow> {
    return this.db.drugPersonNetworkRole.create({
      data: {
        id: generateDrugId(),
        ...input,
        verificationStatus: input.verificationStatus ?? "UNVERIFIED",
      },
    }) as Promise<DrugPersonNetworkRoleRow>;
  }

  /**
   * Update the verificationStatus of an existing assertion (drug.edit gate
   * enforced by the caller). Does NOT create a new row — this is the one
   * permitted non-append mutation, limited strictly to the status field and
   * the note, matching the spec's "verification status is mutable but the
   * assertion itself is historical" requirement.
   */
  updateVerificationStatus(
    id: string,
    verificationStatus: string
  ): Promise<DrugPersonNetworkRoleRow> {
    return this.db.drugPersonNetworkRole.update({
      where: { id },
      data: { verificationStatus, updatedAt: new Date() },
    }) as Promise<DrugPersonNetworkRoleRow>;
  }
}
