/**
 * Drug Intelligence entity id generation (Phase DI-1).
 *
 * The service layer generates every Drug* row's id itself (rather than
 * relying on the database's `@default(cuid())`) so a single transaction can
 * reference a just-created case/person's id in the SAME transaction before
 * the row would otherwise be read back (mirrors Manual Personnel Entry's
 * generateManualOfficerId — an application-generated id, never trusted from
 * the client). Uses Node's built-in `crypto.randomUUID()` rather than
 * adding a "cuid" package dependency — the Prisma schema's `@default(cuid())`
 * is only the database-side fallback for a create call that omits `id`;
 * every Drug* create in this module always supplies its own id explicitly,
 * so the two id formats never need to match.
 */

import { randomUUID } from "crypto";

export function generateDrugId(): string {
  return randomUUID();
}
