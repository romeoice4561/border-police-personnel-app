/**
 * Saved Investigation Board domain types and errors (DI-9.5B).
 */

import type { DrugInvestigationBoardStateV1 } from "@/lib/drug_intelligence/drug_investigation_board_state";

export type DrugInvestigationBoardStatus = "ACTIVE" | "ARCHIVED";

export interface DrugInvestigationBoardRecord {
  id: string;
  title: string;
  description: string | null;
  status: DrugInvestigationBoardStatus;
  ownerActorId: string;
  ownerActorName: string;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date | null;
  version: number;
  schemaVersion: number;
  focusType: string | null;
  focusId: string | null;
  state: DrugInvestigationBoardStateV1;
}

export interface DrugInvestigationBoardSummary {
  id: string;
  title: string;
  description: string | null;
  status: DrugInvestigationBoardStatus;
  ownerActorId: string;
  ownerActorName: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date | null;
  version: number;
  schemaVersion: number;
  focusType: string | null;
  focusId: string | null;
}

export class BoardNotFoundError extends Error {
  constructor(public readonly boardId: string) {
    super("Investigation board not found");
    this.name = "BoardNotFoundError";
  }
}

export class BoardForbiddenError extends Error {
  constructor(message = "Not allowed to access this investigation board") {
    super(message);
    this.name = "BoardForbiddenError";
  }
}

export class BoardConflictError extends Error {
  constructor(
    public readonly currentVersion: number,
    public readonly expectedVersion: number,
    public readonly title: string,
    public readonly updatedAt: Date
  ) {
    super("This board changed elsewhere");
    this.name = "BoardConflictError";
  }
}

export class BoardPayloadTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super("Board state exceeds 1 MB limit");
    this.name = "BoardPayloadTooLargeError";
  }
}
