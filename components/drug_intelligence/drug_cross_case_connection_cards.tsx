/**
 * DI-8.2A — reusable cross-case connection evidence UI.
 * Case Detail is the richest surface; Person/Search reuse compact pieces.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Network, ExternalLink, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { IntelligenceSection } from "@/components/drug_intelligence/drug_person_workspace_cards";
import { formatThaiOperationalDate } from "@/lib/drug_intelligence/di_date_helpers";
import { chronologyLabelTh } from "@/lib/drug_intelligence/drug_cross_case_connection";
import { withReturnTo } from "@/lib/ui/return_context";
import type {
  CrossCaseConnectionDto,
  CrossCaseConnectionResultDto,
  CrossCaseEvidenceItemDto,
} from "@/lib/drug_intelligence/drug_intelligence_client";

export function ChronologyBadge({ chronology }: { chronology: CrossCaseConnectionDto["chronology"] }) {
  const tone = chronology === "BEFORE" ? "neutral" : chronology === "AFTER" ? "accent" : chronology === "SAME_DAY" ? "warning" : "neutral";
  return <Badge tone={tone}>{chronologyLabelTh(chronology)}</Badge>;
}

export function ConnectionReasonBadge({ item }: { item: CrossCaseEvidenceItemDto }) {
  return (
    <span className="inline-flex max-w-full flex-col gap-0.5 rounded-md border border-border bg-neutral-bg/50 px-2 py-1 text-xs">
      <span className="font-medium text-foreground">{item.displayLabel}</span>
      {item.href ? (
        <Link href={item.href} className="truncate text-accent hover:underline">
          {item.displayValue}
        </Link>
      ) : (
        <span className="truncate text-muted">{item.displayValue}</span>
      )}
    </span>
  );
}

export function ConnectionEvidenceList({ items }: { items: CrossCaseEvidenceItemDto[] }) {
  const { t } = useT();
  return (
    <ol className="space-y-2" data-testid="connection-evidence-list">
      {items.map((item, index) => (
        <li key={`${item.entityType}:${item.entityId}:${item.relationshipType}`} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {t("di.connection.evidenceItem").replace("{n}", String(index + 1))}
          </p>
          <p className="font-medium text-foreground">{item.displayLabel}</p>
          {item.href ? (
            <Link href={item.href} className="text-accent hover:underline">
              {item.displayValue}
            </Link>
          ) : (
            <p className="text-muted">{item.displayValue}</p>
          )}
          <p className="mt-1 text-[11px] text-muted">
            {item.provenance === "SHARED_ENTITY"
              ? t("di.connection.provenanceShared")
              : item.provenance === "INDIRECT_PATH"
                ? t("di.connection.provenanceIndirect")
                : item.provenance === "EXPLICIT_RELATIONSHIP"
                  ? t("di.connection.provenanceExplicit")
                  : t("di.connection.provenanceRecorded")}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function CrossCaseConnectionCard({
  connection,
  returnTo,
  compact = false,
}: {
  connection: CrossCaseConnectionDto;
  returnTo?: string | null;
  compact?: boolean;
}) {
  const { t } = useT();
  const [showEvidence, setShowEvidence] = useState(false);
  const target = connection.targetCase;
  const caseHref = withReturnTo(`/drug-intelligence/cases/${encodeURIComponent(target.caseId)}`, returnTo);
  const networkHref = withReturnTo(
    `/drug-intelligence/network?focusType=CASE&focusId=${encodeURIComponent(target.caseId)}`,
    returnTo,
  );
  const topReasons = connection.evidenceItems.slice(0, compact ? 2 : 3);

  return (
    <article
      className="rounded-xl border border-border bg-surface px-3 py-3 shadow-sm"
      data-testid="cross-case-connection-card"
      data-chronology={connection.chronology}
      data-directness={connection.directness}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{target.caseNumber}</p>
          <p className="text-xs text-muted">
            {t("di.field.arrestDate")}:{" "}
            {target.arrestDate ? formatThaiOperationalDate(target.arrestDate) : "—"}
            {target.arrestTime ? ` ${t("di.connection.timePrefix")} ${target.arrestTime}` : ""}
          </p>
          {target.province || target.locationName ? (
            <p className="text-xs text-muted">{[target.locationName, target.province].filter(Boolean).join(" · ")}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          <ChronologyBadge chronology={connection.chronology} />
          <Badge tone={connection.directness === "DIRECT" ? "good" : "warning"}>
            {connection.directness === "DIRECT"
              ? t("di.connection.direct")
              : t("di.connection.indirect").replace("{n}", String(connection.hopCount))}
          </Badge>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted">
        {t("di.connection.evidenceCount").replace("{count}", String(connection.evidenceItems.length))}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {topReasons.map((item) => (
          <ConnectionReasonBadge key={`${item.entityType}:${item.entityId}`} item={item} />
        ))}
      </div>

      {showEvidence ? (
        <div className="mt-3">
          <ConnectionEvidenceList items={connection.evidenceItems} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" data-testid="connection-open-case">
          <Link href={caseHref}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            {t("di.connection.openCase")}
          </Link>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowEvidence((v) => !v)} data-testid="connection-view-evidence">
          <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
          {showEvidence ? t("di.connection.hideEvidence") : t("di.connection.viewEvidence")}
        </Button>
        <Button asChild variant="ghost" size="sm" data-testid="connection-view-network">
          <Link href={networkHref}>
            <Network className="h-3.5 w-3.5" aria-hidden="true" />
            {t("di.connection.viewInGraph")}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function DrugCaseConnectedCasesSection({
  connectedCases,
  returnTo,
}: {
  connectedCases: CrossCaseConnectionResultDto | null | undefined;
  returnTo?: string | null;
}) {
  const { t } = useT();
  const connections = connectedCases?.connections ?? [];

  return (
    <div data-testid="case-connected-cases">
      <IntelligenceSection title={t("di.connection.sectionTitle")} icon={<Network className="h-4 w-4 text-accent" aria-hidden="true" />}>
        {connections.length === 0 ? (
          <p className="text-sm text-muted">{t("di.connection.empty")}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted">{t("di.connection.sectionHint")}</p>
            {connections.map((c) => (
              <CrossCaseConnectionCard key={c.targetCase.caseId} connection={c} returnTo={returnTo} />
            ))}
          </div>
        )}
      </IntelligenceSection>
    </div>
  );
}
