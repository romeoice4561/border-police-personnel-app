/**
 * EpfNextActionsCard (Phase 46B — "Recommended Next Actions"; Phase 46C —
 * each row now shows icon, title, a one-line explanation, and a primary
 * action button per spec §5; placed beside AI Insights on desktop, below on
 * mobile — handled by the parent's grid layout).
 *
 * Renders lib/document/epf_insights.ts's computeRecommendedActions output.
 * The card itself is omitted by the caller (EpfSection) when the array is
 * empty (spec §4: "Hide the card when no actionable items exist") — this
 * component assumes it only ever receives a non-empty list.
 */
"use client";

import { Upload, ShieldCheck, Eye, Gauge } from "lucide-react";
import type { ActionKind, RecommendedAction } from "@/lib/document/epf_insights";
import { getDocumentTypeLabel } from "@/lib/document/document_type_labels";
import { Button } from "@/components/ui/button";
import { useLanguage, useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ACTION_ICON: Record<ActionKind, typeof Upload> = {
  upload_missing: Upload,
  verify_pending: ShieldCheck,
  review_recent: Eye,
  complete_profile: Gauge,
};

const ACTION_EXPLANATION_KEY: Record<ActionKind, TranslationKey> = {
  upload_missing: "epf.action.uploadMissingExplain",
  verify_pending: "epf.action.verifyPendingExplain",
  review_recent: "epf.action.reviewRecentExplain",
  complete_profile: "epf.action.completeProfileExplain",
};

export function EpfNextActionsCard({
  actions,
  onUploadMissing,
}: {
  actions: RecommendedAction[];
  onUploadMissing: (typeCode: string) => void;
}) {
  const { t } = useT();
  const { language } = useLanguage();

  return (
    <section aria-labelledby="epf-next-actions-heading" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h3 id="epf-next-actions-heading" className="text-sm font-semibold text-foreground">
        {t("epf.nextActions.title")}
      </h3>
      <ul className="mt-3 space-y-2.5">
        {actions.map((action) => {
          const Icon = ACTION_ICON[action.kind];
          // Phase 49A.2: an upload_missing action names the ACTUAL missing
          // document (e.g. "อัปโหลดทะเบียนบ้าน") instead of the generic
          // "อัปโหลดเอกสารที่ขาด" — critical when 2 such actions render at
          // once (computeRecommendedActions caps at 2), since the generic
          // title made them visually indistinguishable. Falls back to the
          // generic phrasing only if typeCode is somehow absent.
          const specificDocumentLabel =
            action.kind === "upload_missing" && action.typeCode
              ? getDocumentTypeLabel(action.typeCode, language)
              : null;
          const title = specificDocumentLabel
            ? `${t("epf.action.uploadMissingNamed")}${specificDocumentLabel}`
            : t(action.labelKey as TranslationKey);
          const titleWithValue =
            action.kind === "verify_pending" && action.value
              ? `${action.value} ${title}`
              : action.kind === "complete_profile" && action.value
                ? `${title} (${action.value}%)`
                : title;
          return (
            <li key={action.id} className="flex items-start justify-between gap-2 rounded-lg bg-neutral-bg px-3 py-2.5">
              <span className="flex min-w-0 items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{titleWithValue}</span>
                  <span className="block text-xs text-muted">{t(ACTION_EXPLANATION_KEY[action.kind])}</span>
                </span>
              </span>
              {action.kind === "upload_missing" && action.typeCode ? (
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onUploadMissing(action.typeCode!)}>
                  {t("epf.missingPanel.upload")}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
