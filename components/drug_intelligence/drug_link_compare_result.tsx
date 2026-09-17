/**
 * Link Compare result — two-box investigation story, or compact three-entity summary.
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
  findLinkComparePair,
  groupSharedEntities,
  hasTripleIntersection,
  isThreeEntityCompare,
  linkCompareCaseHref,
  linkCompareErrorMessageKey,
  linkCompareInspectNetworkHref,
  pairSlotLabel,
  relationshipWordingKey,
  sharedEntityTypeLabelKey,
  sharedJunctionHeading,
  slotC,
  slotDisplayLabel,
  supportingSharedCases,
  visibleSharedCases,
  type LinkCompareSlotSelection,
  type LinkCompareTwoBoxState,
} from "@/lib/drug_intelligence/drug_link_compare_client_state";
import { buildCompareHighlightFromResult, type LinkCompareHighlightContext } from "@/lib/drug_intelligence/drug_link_compare_highlight";
import type {
  DrugLinkComparePairDto,
  DrugLinkCompareResponse,
  DrugLinkCompareSharedCaseDto,
} from "@/lib/drug_intelligence/drug_intelligence_client";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugLinkCompareSlotKey } from "@/lib/drug_intelligence/drug_link_compare_types";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function LinkComparePathStory({
  pair,
}: {
  pair: DrugLinkComparePairDto;
}) {
  const { t } = useT();
  const isDirect = pair.connectionKind === "DIRECT";
  const isIndirect = pair.connectionKind === "INDIRECT";
  const steps = pair.shortestPath?.steps ?? [];
  if (pair.connectionKind === "NONE_KNOWN" || steps.length === 0) return null;

  return (
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
                isPathCase && isIndirect ? "border-accent bg-accent/5" : "border-border bg-neutral-bg/50"
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
  );
}

function SlotChip({ slotKey, slot }: { slotKey: DrugLinkCompareSlotKey; slot: LinkCompareSlotSelection | null }) {
  const { t } = useT();
  if (!slot) return null;
  return (
    <div className="min-w-0 rounded-lg border border-border bg-neutral-bg/50 px-3 py-2 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{slotKey}</p>
      <p className="text-xs font-medium text-muted">{t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[slot.entityType] as TranslationKey)}</p>
      <p className="text-sm font-semibold text-foreground break-words">{slotDisplayLabel(slot)}</p>
    </div>
  );
}

function NetworkActions({
  slots,
  compareHref,
  highlight,
}: {
  slots: LinkCompareTwoBoxState;
  compareHref: string;
  highlight: LinkCompareHighlightContext | null;
}) {
  const { t } = useT();
  const c = slotC(slots);
  const primaryNetworkHref = slots.A
    ? linkCompareInspectNetworkHref({ inspect: "A", slots, compareHref, highlight })
    : null;
  if (!slots.A && !slots.B && !c) return null;
  return (
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
          <Link href={linkCompareInspectNetworkHref({ inspect: "A", slots, compareHref, highlight })} data-testid="link-compare-open-a">
            {t("di.linkCompare.openAInNetwork")}
          </Link>
        </Button>
      ) : null}
      {slots.B ? (
        <Button asChild variant="outline" size="sm">
          <Link href={linkCompareInspectNetworkHref({ inspect: "B", slots, compareHref, highlight })} data-testid="link-compare-open-b">
            {t("di.linkCompare.openBInNetwork")}
          </Link>
        </Button>
      ) : null}
      {c ? (
        <Button asChild variant="outline" size="sm">
          <Link href={linkCompareInspectNetworkHref({ inspect: "C", slots, compareHref, highlight })} data-testid="link-compare-open-c">
            {t("di.linkCompare.openCInNetwork")}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function TripleCases({
  cases,
  compareHref,
}: {
  cases: DrugLinkCompareSharedCaseDto[];
  compareHref: string;
}) {
  const { t } = useT();
  return (
    <ul className="space-y-2">
      {cases.map((row) => (
        <li
          key={row.caseId}
          className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-accent bg-accent/5 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground break-words">{t("di.linkCompare.caseItem").replace("{case}", row.caseNumber)}</p>
            <p className="text-xs text-muted">{t("di.linkCompare.tripleInCase")}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={linkCompareCaseHref(row.caseId, compareHref)} data-testid="link-compare-triple-case">
              {t("di.linkCompare.openCase")}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function TwoBoxBody({
  slots,
  pair,
  compareHref,
  highlight,
  onChangeSelection,
}: {
  slots: LinkCompareTwoBoxState;
  pair: DrugLinkComparePairDto;
  compareHref: string;
  highlight: LinkCompareHighlightContext | null;
  onChangeSelection: () => void;
}) {
  const { t } = useT();
  const [casesExpanded, setCasesExpanded] = useState(false);
  const extraCases = supportingSharedCases(pair.sharedCases, pair.shortestPath);
  const shared = visibleSharedCases(extraCases, casesExpanded);
  const groupedEntities = groupSharedEntities(pair.sharedEntities);
  const isNone = pair.connectionKind === "NONE_KNOWN";

  return (
    <>
      <p
        className={cn("text-base font-semibold", isNone ? "text-foreground" : "text-accent")}
        data-testid="link-compare-headline"
      >
        {t(connectionHeadlineKey(pair.connectionKind))}
      </p>
      {isNone ? (
        <p className="text-sm leading-relaxed text-muted" data-testid="link-compare-none-hint">
          {t("di.linkCompare.noneKnownHintLong")}
        </p>
      ) : null}
      <LinkComparePathStory pair={pair} />
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
      <NetworkActions slots={slots} compareHref={compareHref} highlight={highlight} />
    </>
  );
}

const PAIR_KEYS: Array<[DrugLinkCompareSlotKey, DrugLinkCompareSlotKey]> = [
  ["A", "B"],
  ["A", "C"],
  ["B", "C"],
];

function ThreeBoxBody({
  slots,
  result,
  compareHref,
  highlight,
}: {
  slots: LinkCompareTwoBoxState;
  result: DrugLinkCompareResponse;
  compareHref: string;
  highlight: LinkCompareHighlightContext | null;
}) {
  const { t } = useT();
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const triple = result.tripleIntersection;
  const triplePresent = hasTripleIntersection(triple);
  const tripleEntities = groupSharedEntities(triple?.entities ?? []);
  const c = slotC(slots);

  return (
    <>
      <ul className="space-y-1 text-sm text-foreground" data-testid="link-compare-triple-summary">
        <li>
          <span className="font-semibold">A</span>
          {" — "}
          {slotDisplayLabel(slots.A)}
        </li>
        <li>
          <span className="font-semibold">B</span>
          {" — "}
          {slotDisplayLabel(slots.B)}
        </li>
        <li>
          <span className="font-semibold">C</span>
          {" — "}
          {slotDisplayLabel(c)}
        </li>
      </ul>

      {triplePresent && triple ? (
        <section className="space-y-3 rounded-lg border border-accent bg-accent/5 p-3" data-testid="link-compare-triple-junction">
          <h3 className="text-sm font-semibold text-foreground">{t("di.linkCompare.tripleJunction")}</h3>
          <div className="flex flex-col items-stretch gap-3" data-testid="link-compare-triple-story">
            <SlotChip slotKey="A" slot={slots.A} />
            <div className="flex justify-center text-muted" aria-hidden="true">
              <ArrowDown className="h-4 w-4" />
            </div>
            {triple.cases.length > 0 ? <TripleCases cases={triple.cases} compareHref={compareHref} /> : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <SlotChip slotKey="B" slot={slots.B} />
              <SlotChip slotKey="C" slot={c} />
            </div>
          </div>
        </section>
      ) : (
        <p className="text-sm leading-relaxed text-foreground" data-testid="link-compare-no-triple">
          {t("di.linkCompare.noTripleJunction")}
        </p>
      )}

      {tripleEntities.length > 0 ? (
        <section className="space-y-2 border-t border-border pt-3" data-testid="link-compare-triple-entities">
          <h3 className="text-sm font-semibold text-foreground">{t("di.linkCompare.tripleSharedData")}</h3>
          {tripleEntities.map((group) => (
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

      <section className="space-y-2 border-t border-border pt-3" data-testid="link-compare-pairwise">
        <h3 className="text-sm font-semibold text-foreground">{t("di.linkCompare.pairwiseHeading")}</h3>
        <ul className="space-y-2">
          {PAIR_KEYS.map(([left, right]) => {
            const pair = findLinkComparePair(result.pairs, left, right);
            if (!pair) return null;
            const key = `${left}-${right}`;
            const open = expandedPair === key;
            return (
              <li key={key} className="rounded-lg border border-border px-3 py-2" data-testid={`link-compare-pair-${left}-${right}`}>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{pairSlotLabel(left, right)}</p>
                    <p
                      className={cn(
                        "text-sm",
                        pair.connectionKind === "NONE_KNOWN" ? "text-foreground" : "text-accent"
                      )}
                    >
                      {t(connectionHeadlineKey(pair.connectionKind))}
                    </p>
                  </div>
                  {pair.shortestPath?.steps.length ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedPair(open ? null : key)}
                      data-testid={`link-compare-pair-toggle-${left}-${right}`}
                    >
                      {open ? t("di.linkCompare.pairHidePath") : t("di.linkCompare.pairViewPath")}
                    </Button>
                  ) : null}
                </div>
                {open ? (
                  <div className="mt-3">
                    <LinkComparePathStory pair={pair} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <NetworkActions slots={slots} compareHref={compareHref} highlight={highlight} />
    </>
  );
}

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
  const three = isThreeEntityCompare(slots) && (result?.pairs.length ?? 0) >= 3;
  const pair = result?.pairs[0];
  const highlight = result ? buildCompareHighlightFromResult(slots, result) : null;

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

  if (!result || (!three && !pair)) return null;

  return (
    <Card
      data-testid="link-compare-result"
      data-connection-kind={three ? "TRIPLE" : pair?.connectionKind}
      data-compare-mode={three ? "three" : "two"}
    >
      <CardHeader className="px-4 py-3">
        <CardTitle>{t("di.linkCompare.resultTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4 px-4 py-4">
        {three ? (
          <ThreeBoxBody slots={slots} result={result} compareHref={compareHref} highlight={highlight} />
        ) : pair ? (
          <TwoBoxBody slots={slots} pair={pair} compareHref={compareHref} highlight={highlight} onChangeSelection={onChangeSelection} />
        ) : null}
      </CardBody>
    </Card>
  );
}
