/**
 * CicActionCenter (Phase 49B — Commander Intelligence Center).
 *
 * Renders the Action Center list — each row's count/href was already
 * computed by build_view_model.ts from existing engine outputs; a null
 * href (no items) renders the row without a link, never a dead click
 * target implying it does something.
 */
"use client";

import Link from "next/link";
import { Award, FileWarning, IdCard, GraduationCap, UserX } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import type { CommanderActionCenterItemViewModel, CommanderActionCenterActionId } from "@/lib/commander_intelligence_center/types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const ACTION_ICON: Record<CommanderActionCenterActionId, typeof Award> = {
  approvePromotionCandidates: Award,
  reviewMissingDocuments: FileWarning,
  reviewExpiringIds: IdCard,
  reviewMissingTraining: GraduationCap,
  reviewIncompleteProfiles: UserX,
};

const ACTION_TITLE_KEY: Record<CommanderActionCenterActionId, TranslationKey> = {
  approvePromotionCandidates: "cic.action.approvePromotionCandidates.title",
  reviewMissingDocuments: "cic.action.reviewMissingDocuments.title",
  reviewExpiringIds: "cic.action.reviewExpiringIds.title",
  reviewMissingTraining: "cic.action.reviewMissingTraining.title",
  reviewIncompleteProfiles: "cic.action.reviewIncompleteProfiles.title",
};

const ACTION_DESCRIPTION_KEY: Record<CommanderActionCenterActionId, TranslationKey> = {
  approvePromotionCandidates: "cic.action.approvePromotionCandidates.description",
  reviewMissingDocuments: "cic.action.reviewMissingDocuments.description",
  reviewExpiringIds: "cic.action.reviewExpiringIds.description",
  reviewMissingTraining: "cic.action.reviewMissingTraining.description",
  reviewIncompleteProfiles: "cic.action.reviewIncompleteProfiles.description",
};

function ActionRow({ item }: { item: CommanderActionCenterItemViewModel }) {
  const { t } = useT();
  const Icon = ACTION_ICON[item.id];
  const body = (
    <div className="flex items-start gap-3.5 px-5 py-4">
      <span className="mt-0.5 shrink-0 rounded-full bg-accent/10 p-1.5 text-accent" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="wrap-break-word text-sm font-medium text-foreground">{t(ACTION_TITLE_KEY[item.id])}</p>
          <Badge tone={item.count > 0 ? "warning" : "default"} className="shrink-0">
            {item.count.toLocaleString()}
          </Badge>
        </div>
        <p className="wrap-break-word text-xs leading-relaxed text-muted">{t(ACTION_DESCRIPTION_KEY[item.id])}</p>
      </div>
    </div>
  );

  if (!item.href) return <div className="border-b border-border opacity-60 last:border-b-0">{body}</div>;
  return (
    <Link
      href={item.href}
      className={cn(
        "block border-b border-border transition-colors last:border-b-0 hover:bg-neutral-bg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      )}
    >
      {body}
    </Link>
  );
}

export function CicActionCenter({ items }: { items: CommanderActionCenterItemViewModel[] }) {
  const { t } = useT();
  const actionable = items.filter((item) => item.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("cic.actionCenter.title")}</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {actionable.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">{t("cic.actionCenter.empty")}</p>
        ) : (
          <div>
            {actionable.map((item) => (
              <ActionRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
