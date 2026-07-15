/**
 * TimelineVerificationBadge (Phase 45 — Timeline Workspace UX, Part 6).
 *
 * The SINGLE read-mode verification indicator for a Timeline card. Renders one
 * badge from the structured verificationStatus (bilingual label + token tone),
 * or a muted "not verified" chip when unset. Replaces the previous dual
 * status/verification display — one meaning, one badge.
 */
"use client";

import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { verificationBadgeMeta } from "@/lib/officer_profile/timeline_ux";
import { useT, useLanguage } from "@/components/i18n/language_provider";
import { Badge } from "@/components/ui/badge";

export function TimelineVerificationBadge({ verificationStatus }: { verificationStatus: string }) {
  const { t } = useT();
  const { language } = useLanguage();
  const meta = verificationBadgeMeta(verificationStatus);

  if (!meta) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <ShieldQuestion className="h-3.5 w-3.5" aria-hidden="true" />
        {t("timeline.notVerified")}
      </span>
    );
  }

  return (
    <Badge tone={meta.tone}>
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      {language === "th" ? meta.labelTh : meta.labelEn}
    </Badge>
  );
}
