/**
 * DocumentStatusBadge — Media Design System (Phase 45A, Part 4).
 *
 * One shared, easy-to-read status badge for an officer document, driven by the
 * pure `documentStatus()` derivation and the existing Badge tones (design
 * tokens — no new colors). Replaces the inline status logic that lived in
 * documents_section, so the badge looks identical everywhere and gains new
 * states (expired/rejected) automatically when a future schema phase teaches
 * `documentStatus()` to return them.
 *
 * Bilingual via the central i18n dictionary.
 */
"use client";

import { CheckCircle2, Clock, FileX2, CalendarX, XCircle } from "lucide-react";
import type { OfficerDocument } from "@/lib/database/query_types";
import { documentStatus, DOCUMENT_STATUS_TONE, type DocumentStatus } from "@/lib/document/document_status";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { Badge } from "@/components/ui/badge";

const STATUS_META: Record<DocumentStatus, { icon: typeof CheckCircle2; labelKey: TranslationKey }> = {
  verified: { icon: CheckCircle2, labelKey: "document.statusVerified" },
  pending: { icon: Clock, labelKey: "document.statusPending" },
  missing: { icon: FileX2, labelKey: "document.statusMissing" },
  expired: { icon: CalendarX, labelKey: "document.statusExpired" },
  rejected: { icon: XCircle, labelKey: "document.statusRejected" },
};

export function DocumentStatusBadge({ doc }: { doc: OfficerDocument | null }) {
  const { t } = useT();
  const status = documentStatus(doc);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge tone={DOCUMENT_STATUS_TONE[status]}>
      <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
      {t(meta.labelKey)}
    </Badge>
  );
}
