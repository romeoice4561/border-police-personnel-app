/**
 * Link Compare slot card — empty choose-action or selected DATABASE entity.
 */
"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DrugEntityIconMark } from "@/components/drug_intelligence/drug_entity_visual";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { LinkCompareSlotSelection } from "@/lib/drug_intelligence/drug_link_compare_client_state";
import type { DrugLinkCompareSlotKey } from "@/lib/drug_intelligence/drug_link_compare_types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function slotTitleKey(slotKey: DrugLinkCompareSlotKey): TranslationKey {
  if (slotKey === "A") return "di.linkCompare.slotA";
  if (slotKey === "B") return "di.linkCompare.slotB";
  return "di.linkCompare.slotC";
}

export function DrugLinkCompareSlot({
  slotKey,
  selection,
  duplicateError,
  className,
  showRemoveWhenEmpty = false,
  onChoose,
  onChange,
  onRemove,
}: {
  slotKey: DrugLinkCompareSlotKey;
  selection: LinkCompareSlotSelection | null;
  duplicateError: boolean;
  className?: string;
  showRemoveWhenEmpty?: boolean;
  onChoose: () => void;
  onChange: () => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const title = t(slotTitleKey(slotKey));

  return (
    <Card
      className={cn("min-w-0", className)}
      data-testid={`link-compare-slot-${slotKey}`}
      data-slot-filled={selection ? "true" : "false"}
    >
      <CardBody className="space-y-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {selection ? (
          <div className="space-y-3" data-testid={`link-compare-selected-${slotKey}`}>
            <div className="flex items-start gap-3">
              <DrugEntityIconMark type={selection.entityType} size="lg" className="border-accent/40 bg-surface text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[selection.entityType] as TranslationKey)}
                </p>
                <p className="text-base font-semibold leading-snug text-foreground break-words">
                  {selection.label.trim() || t("di.linkCompare.selectedWithoutLabel")}
                </p>
                {selection.caseCount != null && selection.entityType !== "CASE" ? (
                  <p className="mt-0.5 text-xs text-muted">
                    {t("di.linkCompare.foundInCases").replace("{count}", String(selection.caseCount))}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onChange} data-testid={`link-compare-change-${slotKey}`}>
                {t("di.linkCompare.change")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove} data-testid={`link-compare-remove-${slotKey}`}>
                {t("di.linkCompare.remove")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onChoose}
              data-testid={`link-compare-choose-${slotKey}`}
              className="flex min-h-24 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-neutral-bg/40 px-3 py-4 text-sm font-medium text-foreground hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("di.linkCompare.chooseEntity")}
            </button>
            {showRemoveWhenEmpty ? (
              <Button type="button" variant="ghost" size="sm" onClick={onRemove} data-testid={`link-compare-remove-${slotKey}`}>
                {t("di.linkCompare.remove")}
              </Button>
            ) : null}
          </div>
        )}
        {duplicateError ? (
          <p className="text-sm text-critical" role="alert" data-testid="link-compare-duplicate">
            {t("di.linkCompare.duplicate")}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
