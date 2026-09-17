/**
 * Link Compare result — one investigation story: A → relationship → B.
 * Labels come from the server DTO / relationship catalog. No ownership claims.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/common/states";
import { DrugEntityIconMark } from "@/components/drug_intelligence/drug_entity_visual";
import { useT } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";
import {
  classifyLinkCompareHttpError,
  connectionHeadlineKey,
  groupSharedEntities,
  linkCompareCaseHref,
  linkCompareErrorMessageKey,
  linkCompareNetworkFocusHref,
  relationshipWordingKey,
  sharedEntityTypeLabelKey,
  sharedJunctionHeading,
  supportingSharedCases,
  visibleSharedCases,
  type LinkCompareTwoBoxState,
} from "@/lib/drug_intelligence/drug_link_compare_client_state";
import type { DrugLinkCompareResponse } from "@/lib/drug_intelligence/drug_intelligence_client";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export function DrugLinkCompareResult({
  slots,
  result,
  error,
  loading,
  compareHref,
  onRetry,
  onChangeSelection,
}: {
  slots: LinkCompareTwoBoxState;
  result: DrugLinkCompareResponse | undefined;
  error: unknown;
  loading: boolean;
  compareHref: string;
  onRetry: () => void;
  onChangeSelection: () => void;
}) {
  const { t } = useT();
  const [casesExpanded, setCasesExpanded] = useState(false);
  const pair = result?.pairs[0];

  if (loading) {
    return (
      <Card data-testid="link-compare-loading">
        <CardBody className="py-3">
          <p className="text-sm text-muted" role="status" aria-live="polite">
            {t("di.linkCompare.analyzing")}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    const kind = classifyLinkCompareHttpError(error);
    return (
      <div data-testid={`link-compare-error-${kind}`}>
        <ErrorState message={t(linkCompareErrorMessageKey(kind))} onRetry={kind === "retryable" ? onRetry : undefined} />
      </div>
    );
  }

  if (!pair) return null;

  const extraCases = supportingSharedCases(pair.sharedCases, pair.shortestPath);
  const shared = visibleSharedCases(extraCases, casesExpanded);
  const groupedEntities = groupSharedEntities(pair.sharedEntities);
  const isNone = pair.connectionKind === "NONE_KNOWN";
  const isDirect = pair.connectionKind === "DIRECT";
  const isIndirect = pair.connectionKind === "INDIRECT";
  const steps = pair.shortestPath?.steps ?? [];
  const primaryFocus = slots.A ?? slots.B;
  const primaryNetworkHref = primaryFocus
    ? linkCompareNetworkFocusHref(primaryFocus.entityType, primaryFocus.entityId, compareHref)
    : null;

  return (
    <Card data-testid="link-compare-result" data-connection-kind={pair.connectionKind}>
      <CardHeader className="px-4 py-3">
        <CardTitle>{t("di.linkCompare.resultTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 px-4 py-4">
        <p
          className={cn(
            "text-base font-semibold",
            isNone ? "text-foreground" : "text-accent"
          )}
          data-testid="link-compare-headline"
        >
          {t(connectionHeadlineKey(pair.connectionKind))}
        </p>

        {isNone ? (
          <p className="text-sm leading-relaxed text-muted" data-testid="link-compare-none-hint">
            {t("di.linkCompare.noneKnownHintLong")}
          </p>
        ) : null}

        {!isNone && steps.length > 0 ? (
          <ol className="flex min-w-0 flex-col items-stretch gap-2" data-testid="link-compare-path">
            {steps.map((step, index) => {
              const wordingKey = relationshipWordingKey(step.viaEdge?.relationshipType);
              const isPathCase = step.node.type === "CASE";
              const edgeLabel = isDirect
                ? t(connectionHeadlineKey("DIRECT"))
                : wordingKey
                  ? t(wordingKey)
                  : t(connectionHeadlineKey("INDIRECT"));
              return (
                <li key={`${step.node.type}-${step.node.id}-${index}`} className="flex min-w-0 flex-col gap-2">
                  {index > 0 ? (
                    <div className="flex flex-col items-center gap-1 px-2 text-center" data-testid="link-compare-path-edge">
                      <ArrowDown className="h-4 w-4 text-muted" aria-hidden="true" />
                      <p className="max-w-full text-sm font-medium leading-snug text-foreground break-words">{edgeLabel}</p>
                      <ArrowDown className="h-4 w-4 text-muted" aria-hidden="true" />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "min-w-0 rounded-lg border px-3 py-2.5",
                      isPathCase && isIndirect
                        ? "border-accent bg-accent/5"
                        : "border-border bg-neutral-bg/50"
                    )}
                    data-testid={isPathCase ? "link-compare-path-case" : "link-compare-path-node"}
                  >
                    <div className="flex items-start gap-2">
                      <DrugEntityIconMark type={step.node.type} size={isPathCase && isIndirect ? "md" : "sm"} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                          {t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[step.node.type] as TranslationKey)}
                        </p>
                        <p
                          className={cn(
                            "break-words text-foreground",
                            isPathCase && isIndirect ? "text-base font-bold" : "text-sm font-semibold"
                          )}
                        >
                          {step.node.label}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}

        {extraCases.length > 0 ? (
          <section className="space-y-2 border-t border-border pt-3" data-testid="link-compare-shared-cases">
            <h3 className="text-sm font-semibold text-foreground">{sharedJunctionHeading(extraCases.length, t)}</h3>
            <ul className="space-y-2">
              {shared.items.map((row) => (
                <li
                  key={row.caseId}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-neutral-bg/40 px-3 py-2"
                >
                  <p className="text-sm font-medium text-foreground break-words">
                    {t("di.linkCompare.caseItem").replace("{case}", row.caseNumber)}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={linkCompareCaseHref(row.caseId, compareHref)} data-testid="link-compare-case-link">
                      {t("di.linkCompare.openCase")}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            {shared.hidden > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setCasesExpanded(true)} data-testid="link-compare-expand-cases">
                {t("di.linkCompare.showMoreCases").replace("{count}", String(extraCases.length))}
              </Button>
            ) : null}
          </section>
        ) : null}

        {groupedEntities.length > 0 ? (
          <section className="space-y-2 border-t border-border pt-3" data-testid="link-compare-shared-entities">
            <h3 className="text-sm font-semibold text-foreground">{t("di.linkCompare.otherSharedData")}</h3>
            {groupedEntities.map((group) => (
              <div key={group.entityType}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t(sharedEntityTypeLabelKey(group.entityType))}
                </p>
                <ul className="mt-1 space-y-1">
                  {group.items.map((item) => (
                    <li key={`${item.entityType}:${item.entityId}`} className="text-sm text-foreground break-words">
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        {isNone ? (
          <Button type="button" variant="outline" size="sm" onClick={onChangeSelection} data-testid="link-compare-change-selection">
            {t("di.linkCompare.changeSelection")}
          </Button>
        ) : null}

        {slots.A || slots.B ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {primaryNetworkHref ? (
              <Button asChild variant="accent" size="sm">
                <Link href={primaryNetworkHref} data-testid="link-compare-open-network">
                  {t("di.linkCompare.viewInNetwork")}
                </Link>
              </Button>
            ) : null}
            {slots.A ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={linkCompareNetworkFocusHref(slots.A.entityType, slots.A.entityId, compareHref)}
                  data-testid="link-compare-open-a"
                >
                  {t("di.linkCompare.openAInNetwork")}
                </Link>
              </Button>
            ) : null}
            {slots.B ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={linkCompareNetworkFocusHref(slots.B.entityType, slots.B.entityId, compareHref)}
                  data-testid="link-compare-open-b"
                >
                  {t("di.linkCompare.openBInNetwork")}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
