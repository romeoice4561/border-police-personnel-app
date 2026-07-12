/**
 * Read-side database contracts (Phase 13).
 *
 * Additive, read-only delegate surface for the API's query repositories —
 * findMany/findUnique(with relations)/count/groupBy/aggregate. Declared in a
 * NEW file so the Phase 12 `database_types.ts` and write repositories are left
 * byte-for-byte unchanged. The real PrismaClient structurally satisfies this,
 * and tests inject an in-memory fake that does too.
 *
 * Only the operations the API actually uses are declared. No SQL strings — all
 * access goes through Prisma's typed delegate methods.
 */

import type { Officer, Timeline, Unit, Phone, Education, Training, SalaryHistory } from "@/lib/database/database_types";

export type { Officer, Timeline, Unit, Phone, Education, Training, SalaryHistory };

/** An officer with its related timeline, phones, education, training, and salary history (for the full-profile endpoint). */
export interface OfficerWithRelations extends Officer {
  timeline: Timeline[];
  phones: Phone[];
  education: Education[];
  training: Training[];
  salaryHistory: SalaryHistory[];
}

/** Generic read args mirroring the subset of Prisma's findMany options we use. */
export interface FindManyArgs {
  where?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  skip?: number;
  take?: number;
  include?: Record<string, unknown>;
}

export interface FindUniqueArgs {
  where: Record<string, unknown>;
  include?: Record<string, unknown>;
}

export interface GroupByArgs {
  by: string[];
  where?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Array<Record<string, unknown>>;
  _count?: boolean | Record<string, boolean>;
}

export interface AggregateArgs {
  where?: Record<string, unknown>;
  _avg?: Record<string, boolean>;
  _count?: boolean | Record<string, boolean>;
}

/** Read delegate for a model. Structurally satisfied by a Prisma model delegate. */
export interface ReadDelegate<TRow> {
  findMany(args?: FindManyArgs): Promise<TRow[]>;
  findUnique(args: FindUniqueArgs): Promise<TRow | null>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
  groupBy(args: GroupByArgs): Promise<Array<Record<string, unknown>>>;
  aggregate(args: AggregateArgs): Promise<Record<string, unknown>>;
}

/** The read-only client surface the query repositories depend on. */
export interface ReadDatabaseClient {
  officer: ReadDelegate<Officer>;
  timeline: ReadDelegate<Timeline>;
  unit: ReadDelegate<Unit>;
  phone: ReadDelegate<Phone>;
  education: ReadDelegate<Education>;
  training: ReadDelegate<Training>;
  salaryHistory: ReadDelegate<SalaryHistory>;
}

/** Text match modes supported by search. */
export type MatchMode = "contains" | "startsWith" | "exact";
