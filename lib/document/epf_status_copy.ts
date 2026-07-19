/**
 * e-PF status copy (Phase 46 — Electronic Personnel File Foundation).
 *
 * The spec calls for five statuses (Official / Verified / Pending
 * Verification / Archived / Draft). Only three are actually derivable from
 * OfficerDocument today (see lib/document/document_status.ts) — there is no
 * backing field for "Official" vs "Verified" as distinct states, and no
 * "Archived" concept (isActive=false documents are superseded history, not a
 * user-facing archive). Rather than inventing fake states, this maps the
 * REAL derived status onto the closest spec-language label:
 *   verified → "Verified"   (spec doesn't distinguish Official from Verified yet)
 *   pending  → "Pending Verification"
 *   missing  → "Draft"      (no document uploaded for this type yet)
 * "Official" and "Archived" are intentionally unreachable until a future
 * schema phase adds the backing fields — documented, not silently dropped.
 */

import type { DocumentStatus } from "@/lib/document/document_status";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export const EPF_STATUS_LABEL_KEY: Record<DocumentStatus, TranslationKey> = {
  verified: "epf.statusVerified",
  pending: "epf.statusPendingVerification",
  missing: "epf.statusDraft",
  expired: "document.statusExpired",
  rejected: "document.statusRejected",
};
