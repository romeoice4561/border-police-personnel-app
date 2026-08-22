/**
 * Edge detail panel content (Phase DI-5, Section 11). Rendered inside the
 * shared Drawer primitive. Every edge always shows: relationship type,
 * DIRECT vs INFERRED, explanation, evidence count, first/last seen, and
 * clickable source cases (Section 11's explicit requirement — "never a
 * mysterious line").
 */
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { DRUG_CASE_PERSON_ROLE_LABELS, isValidDrugCasePersonRole } from "@/lib/drug_intelligence/drug_person_options";
import { DRUG_GRAPH_RELATIONSHIP_LABEL_KEY, explainDrugGraphEdgeClient } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphEdge } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function formatDate(value: string | null, language: "th" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US");
}

export function DrugNetworkEdgeDetail({ edge }: { edge: DrugGraphEdge }) {
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
