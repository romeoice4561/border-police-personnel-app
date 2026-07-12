/**
 * Database contracts (Phase 12).
 *
 * Narrow, hand-written interfaces over the subset of Prisma's generated API
 * that the repositories and importer use. Depending on these (rather than the
 * concrete PrismaClient) keeps the repository layer decoupled from Prisma's
 * huge generated types and — crucially — lets tests inject a lightweight
 * in-memory fake client with NO live database, matching this codebase's
 * fake-based testing convention throughout.
 *
 * Only the operations actually used are declared. `Prisma.*` model types are
 * imported from the generated client for the row shapes, but no Prisma runtime
 * behavior is assumed beyond these method signatures.
 */

// Phase 16B: model types come from the Prisma 7 generated client (source
// tree), re-exported under their plain names (Officer, Timeline, …) — types
// are identical to the former @prisma/client imports.
import type { Officer, Timeline, Unit, Phone, ImportJob, ImportLog, Education, Training, SalaryHistory, OfficerDocument } from "@/lib/generated/prisma/client";

export type { Officer, Timeline, Unit, Phone, ImportJob, ImportLog, Education, Training, SalaryHistory, OfficerDocument };

/** Generic Prisma-style delegate for a model, limited to the calls we make. */
export interface ModelDelegate<TRow, TCreate, TUpdate, TWhereUnique> {
  findUnique(args: { where: TWhereUnique }): Promise<TRow | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  }): Promise<TRow[]>;
  create(args: { data: TCreate }): Promise<TRow>;
  update(args: { where: TWhereUnique; data: TUpdate }): Promise<TRow>;
  upsert(args: { where: TWhereUnique; create: TCreate; update: TUpdate }): Promise<TRow>;
  deleteMany(args?: { where?: Record<string, unknown> }): Promise<{ count: number }>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
}

/** The delegates the repositories operate through. Structurally satisfied by PrismaClient and by test fakes. */
export interface DatabaseClient {
  officer: ModelDelegate<Officer, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  timeline: ModelDelegate<Timeline, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  unit: ModelDelegate<Unit, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  phone: ModelDelegate<Phone, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  importJob: ModelDelegate<ImportJob, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  importLog: ModelDelegate<ImportLog, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase 23A: Officer Profile Workspace — Education/Training CRUD rows. */
  education: ModelDelegate<Education, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  training: ModelDelegate<Training, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase 28A: Career Intelligence Foundation — one salary-step result per officer per Buddhist-Era year. */
  salaryHistory: ModelDelegate<SalaryHistory, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /** Phase 29A: Officer Document Vault — generic document rows (one per upload, versioned). */
  officerDocument: ModelDelegate<OfficerDocument, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  /**
   * Runs `fn` inside a single database transaction, passing a transaction-scoped
   * client with the same delegate surface. Mirrors PrismaClient.$transaction's
   * interactive form. A thrown error rolls the whole transaction back.
   */
  $transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
}

/** The action recorded for each officer during an import (for ImportLog + statistics). */
export type ImportAction = "created" | "updated" | "skipped" | "error";
