/**
 * Edge detail panel content (Phase DI-5, Section 11; polished DI-9.1
 * Section 10). Rendered inside the shared Drawer primitive. Every edge
 * always shows: source/target entity, relationship type, DIRECT vs
 * INFERRED, explanation, evidence count, first/last seen, and clickable
 * source cases (Section 11's explicit requirement — "never a mysterious
 * line").
 *
 * DI-9.1 addition: the source/target node LABELS ("ระหว่าง A และ B"). The
 * canvas only ever labels the RELATIONSHIP on the edge itself, not which
 * two entities it connects — on a dense graph a user opening this drawer
 * could not previously tell which two nodes this specific line was
 * between without looking back at the canvas. DrugGraphEdge only carries
 * source/target as opaque node IDs, so the page resolves them to
 * DrugGraphNode objects from the already-fetched neighborhood and passes
 * them in — no new API call, no new data.
 */
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_GRAPH_RELATIONSHIP_LABEL_KEY, explainDrugGraphEdgeClient } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphEdge, DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function formatDate(value: string | null, language: "th" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US");
}

export function DrugNetworkEdgeDetail({ edge, sourceNode, targetNode }: { edge: DrugGraphEdge; sourceNode: DrugGraphNode | null; targetNode: DrugGraphNode | null }) {
  const { t, language } = useT();

  const roleLabel = (role: string): string => {
    if (!isValidDrugCasePersonRole(role)) return role;
    const meta = DRUG_CASE_PERSON_ROLE_LABELS[role];
    return language === "th" ? meta.labelTh : meta.labelEn;
  };
  const explanation = explainDrugGraphEdgeClient(edge.explanation, roleLabel, language);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold text-foreground">{t(DRUG_GRAPH_RELATIONSHIP_LABEL_KEY[edge.relationshipType] as TranslationKey)}</p>
        <Badge tone={edge.edgeKind === "DIRECT" ? "accent" : "warning"}>{edge.edgeKind === "DIRECT" ? t("di.network.edgeDirect") : t("di.network.edgeInferred")}</Badge>
      </div>

      {sourceNode && targetNode ? (
        <p className="rounded-lg bg-neutral-bg px-3 py-2 text-sm text-foreground">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">{t("di.network.edgeBetween")}: </span>
          {sourceNode.label} <span aria-hidden="true">↔</span> <span className="sr-only">{t("di.network.edgeTo")}</span> {targetNode.label}
        </p>
      ) : null}

      <p className="text-sm text-foreground">{explanation}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">{t("di.network.evidenceCount")}</dt>
          <dd className="text-foreground">{edge.evidenceCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("di.network.firstSeen")}</dt>
          <dd className="text-foreground">{formatDate(edge.firstSeenAt, language)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("di.network.lastSeen")}</dt>
          <dd className="text-foreground">{formatDate(edge.lastSeenAt, language)}</dd>
        </div>
      </dl>

      {edge.sourceCaseIds.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t("di.network.sourceCases")}</p>
          <div className="flex flex-wrap gap-2">
            {edge.sourceCaseIds.map((caseId) => (
              <Link
                key={caseId}
                href={`/drug-intelligence/cases/${encodeURIComponent(caseId)}`}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-accent hover:border-accent/50 hover:underline"
              >
                {t("di.network.openCase")}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
