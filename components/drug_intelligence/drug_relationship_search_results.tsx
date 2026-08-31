/**
 * Relationship Search results (Phase 1B) — evidence-first, not a giant graph dump.
 */
"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DRUG_GRAPH_RELATIONSHIP_LABEL_KEY, explainDrugGraphEdgeClient } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { withReturnTo } from "@/lib/ui/return_context";
import type { DrugRelationshipSearchResponse, DrugRelationshipSearchResultItem, DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function roleLabel(role: string, language: "th" | "en"): string {
  if (!isValidDrugCasePersonRole(role)) return role;
  const labels = DRUG_CASE_PERSON_ROLE_LABELS[role];
  return language === "th" ? labels.labelTh : labels.labelEn;
}

function evidenceText(item: DrugRelationshipSearchResultItem, language: "th" | "en", t: (key: TranslationKey) => string): string {
  if (item.explanation.kind === "PATH") {
    return t("di.rel.pathHops").replace("{count}", String(item.explanation.hopCount));
  }
  if (item.explanation.kind === "PATH_NOT_FOUND") {
    return t("di.rel.pathNotFound");
  }
  return explainDrugGraphEdgeClient(item.explanation, (role) => roleLabel(role, language), language);
}

function Badge({ kind }: { kind: DrugRelationshipSearchResultItem["edgeKind"] }) {
  const { t } = useT();
  if (kind === "INFERRED") {
    return (
      <span className="inline-flex items-center rounded border border-amber-700/40 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" title={t("di.rel.badgeInferredHint")}>
        {t("di.rel.badgeInferred")}
      </span>
    );
  }
  if (kind === "PATH") {
    return (
      <span className="inline-flex items-center rounded border border-border bg-neutral-bg px-2 py-0.5 text-xs font-medium text-foreground">
        {t("di.rel.badgePath")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-emerald-700/40 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" title={t("di.rel.badgeDirectHint")}>
      {t("di.rel.badgeDirect")}
    </span>
  );
}

export function DrugRelationshipSearchResults({
  data,
  returnPath,
  onExpand,
}: {
  data: DrugRelationshipSearchResponse;
  returnPath: string;
  onExpand: (entity: { entityType: DrugGraphNodeType; entityId: string; label: string }) => void;
}) {
  const { t, language } = useT();
  const lang = language === "th" ? "th" : "en";

  const typeCounts = Object.entries(data.summary.byTargetType)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([type, n]) => `${type}: ${n}`)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted" aria-live="polite">
          {t("di.rel.resultCount").replace("{count}", data.summary.total.toLocaleString(lang === "th" ? "th-TH" : "en-US"))}
        </p>
        {typeCounts ? <p className="text-xs text-muted">{typeCounts}</p> : null}
        {data.truncated ? <p className="text-xs text-amber-800 dark:text-amber-200">{t("di.rel.truncatedNotice")}</p> : null}
        <p className="text-xs text-muted">{t("di.rel.queryConditionNote")}</p>
      </div>

      {!data.summary.found ? (
        <div className="space-y-1 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium text-foreground">{t("di.rel.pathNotFound")}</p>
          <p className="text-xs text-muted">{t("di.rel.pathNotFoundHint")}</p>
        </div>
      ) : null}

      <div className="grid gap-3">
        {data.results.map((item, index) => {
          const relationLabel =
            item.relationshipType && item.relationshipType in DRUG_GRAPH_RELATIONSHIP_LABEL_KEY
              ? t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[item.relationshipType as keyof typeof DRUG_GRAPH_RELATIONSHIP_LABEL_KEY])
              : null;
          const networkHref = withReturnTo(`${item.actions.networkPath}&depth=2`, returnPath);
          return (
            <Card key={`${item.to.entityId}-${item.relationshipType ?? "path"}-${index}`}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground break-words">{item.to.label}</p>
                    {item.to.secondaryLabel ? <p className="text-xs text-muted break-words">{item.to.secondaryLabel}</p> : null}
                    <p className="text-xs text-muted">
                      {item.from.label}
                      {" → "}
                      {relationLabel ?? t("di.rel.relationSection")}
                      {" → "}
                      {item.to.label}
                    </p>
                  </div>
                  <Badge kind={item.edgeKind} />
                </div>

                <div className="space-y-1 text-xs text-muted">
                  <p className="font-medium text-foreground">{t("di.rel.evidenceLabel")}</p>
                  <p>{evidenceText(item, lang, t)}</p>
                  {item.sourceCaseIds.length > 0 ? <p>cases: {item.sourceCaseIds.length}</p> : null}
                  {item.pathSteps && item.pathSteps.length > 0 ? (
                    <ol className="list-decimal space-y-0.5 pl-4">
                      {item.pathSteps.map((step, i) => (
                        <li key={`${step.entity.entityId}-${i}`}>
                          {step.entity.label}
                          {step.viaRelationshipType ? ` (${step.viaRelationshipType})` : ""}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.actions.detailPath ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={withReturnTo(item.actions.detailPath, returnPath)}>{t("di.rel.viewDetail")}</Link>
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => onExpand(item.actions.expandSource)}>
                    {t("di.rel.expand")}
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={networkHref}>{t("di.rel.openNetwork")}</Link>
                  </Button>
                  {item.actions.timelinePath ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={withReturnTo(item.actions.timelinePath, returnPath)}>{t("di.rel.viewTimeline")}</Link>
                    </Button>
                  ) : null}
                  {item.actions.mapPath ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={withReturnTo(item.actions.mapPath, returnPath)}>{t("di.rel.viewMap")}</Link>
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
