/**
 * Node detail panel content (Phase DI-5, Section 10; polished DI-9.1
 * Section 9; DI-9.2 Section 14 adds a presentation-state pin section).
 * Rendered inside the shared Drawer primitive. Per-entity-type fields per
 * the spec; every entity type gets an "open detail/profile/case" link to
 * its canonical page (Section 10/14) and — where applicable — an "expand"
 * action handed back to the parent canvas.
 *
 * DI-9.1 additions: an explicit entity-type heading (was previously only
 * implied by icon/shape on the canvas, not restated in the drawer itself),
 * and PHONE/SIM metadata rows (carrier, IMSI) that the original DI-5 drawer
 * omitted despite the underlying DrugGraphNodeMetadata already carrying
 * them for DEVICE/VEHICLE/CASE/LOCATION. No new backend calls — every field
 * shown here already exists on the node the canvas already fetched.
 *
 * DI-9.2 addition: an optional "สถานะบนผัง" (board status) section shown
 * only in Analyst Mode (`onTogglePin` present) — pin/unpin is presentation
 * state, deliberately rendered in its own bordered block, visually and
 * semantically separate from the factual identity/risk/case fields above
 * it (Section 14's explicit instruction not to mix the two).
 */
"use client";

import Link from "next/link";
import { AlertTriangle, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

function formatDate(value: string | null, language: "th" | "en"): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US");
}

export function DrugNetworkNodeDetail({
  node,
  onExpand,
  pinned,
  onTogglePin,
}: {
  node: DrugGraphNode;
  onExpand: () => void;
  /** DI-9.2: whether this node is currently pinned. Ignored unless `onTogglePin` is provided. */
  pinned?: boolean;
  /** DI-9.2: present only in Analyst Mode — omitting it hides the entire pin section (Section 3: no edit affordances in View Mode). */
  onTogglePin?: () => void;
}) {
  const { t, language } = useT();

  const actionLabel = node.type === "PERSON" ? t("di.network.openProfile") : node.type === "CASE" ? t("di.network.openCase") : t("di.network.openDetail");
  const showOpenLink = node.type !== "LOCATION";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[node.type] as TranslationKey)}</p>
        <p className="text-lg font-semibold text-foreground">{node.label}</p>
        {node.secondaryLabel ? <p className="text-sm text-muted">{node.secondaryLabel}</p> : null}
      </div>

      {node.riskIndicators.length > 0 ? (
        <div className="space-y-1.5">
          {node.riskIndicators.includes("POTENTIAL_DUPLICATE_PERSON") ? (
            <p className="flex items-center gap-1.5 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("di.network.riskDuplicate")}
            </p>
          ) : null}
          {node.riskIndicators.includes("HIGH_CASE_COUNT") ? <Badge tone="warning">{t("di.network.riskHighCaseCount")}</Badge> : null}
        </div>
      ) : null}

      {node.type === "PERSON" && node.metadata.type === "PERSON" && node.metadata.canonicalTarget ? (
        <p className="rounded-lg bg-neutral-bg px-3 py-2 text-xs text-muted">{t("di.network.mergedNotice")}</p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">{t("di.network.firstSeen")}</dt>
          <dd className="text-foreground">{formatDate(node.firstSeenAt, language)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("di.network.lastSeen")}</dt>
          <dd className="text-foreground">{formatDate(node.lastSeenAt, language)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{t("di.entity.sourceCases")}</dt>
          <dd className="text-foreground">{node.caseCount}</dd>
        </div>
        {node.metadata.type === "PHONE" && node.metadata.carrier ? (
          <div>
            <dt className="text-xs text-muted">{t("di.entity.carrier")}</dt>
            <dd className="text-foreground">{node.metadata.carrier}</dd>
          </div>
        ) : null}
        {node.metadata.type === "SIM" ? (
          <>
            {node.metadata.imsi ? (
              <div>
                <dt className="text-xs text-muted">{t("di.entity.imsi")}</dt>
                <dd className="text-foreground">{node.metadata.imsi}</dd>
              </div>
            ) : null}
            {node.metadata.carrier ? (
              <div>
                <dt className="text-xs text-muted">{t("di.entity.carrier")}</dt>
                <dd className="text-foreground">{node.metadata.carrier}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        {node.metadata.type === "DEVICE" ? (
          <div>
            <dt className="text-xs text-muted">{t("di.entity.brand")}</dt>
            <dd className="text-foreground">{[node.metadata.brand, node.metadata.model].filter(Boolean).join(" ") || "—"}</dd>
          </div>
        ) : null}
        {node.metadata.type === "VEHICLE" ? (
          <div>
            <dt className="text-xs text-muted">{t("di.entity.registrationProvince")}</dt>
            <dd className="text-foreground">{node.metadata.registrationProvince || "—"}</dd>
          </div>
        ) : null}
        {node.metadata.type === "CASE" ? (
          <>
            <div>
              <dt className="text-xs text-muted">{t("di.field.arrestDate")}</dt>
              <dd className="text-foreground">{formatDate(node.metadata.arrestDate, language)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("di.field.province")}</dt>
              <dd className="text-foreground">{node.metadata.province || "—"}</dd>
            </div>
          </>
        ) : null}
        {node.metadata.type === "LOCATION" ? (
          <div>
            <dt className="text-xs text-muted">{t("di.field.province")}</dt>
            <dd className="text-foreground">{[node.metadata.province, node.metadata.district].filter(Boolean).join(" / ") || "—"}</dd>
          </div>
        ) : null}
      </dl>

      {onTogglePin ? (
        <div className="space-y-1.5 rounded-lg border border-border bg-neutral-bg/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.network.pinStatusTitle")}</p>
          <p className="text-sm text-foreground">{pinned ? t("di.network.pinStatusPinned") : t("di.network.pinStatusUnpinned")}</p>
          <Button variant="outline" size="sm" onClick={onTogglePin}>
            {pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}
            {pinned ? t("di.network.unpinNode") : t("di.network.pinNode")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={onExpand}>
          {t("di.network.expandNode")}
        </Button>
        {showOpenLink ? (
          <Button asChild size="sm">
            <Link href={drugEntityDetailPath(node.type, node.id)}>{actionLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
