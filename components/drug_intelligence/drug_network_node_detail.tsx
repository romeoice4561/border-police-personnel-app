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
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
import { DrugNetworkInspectorMedia } from "@/components/drug_intelligence/drug_network_inspector_media";
import { withReturnTo } from "@/lib/ui/return_context";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { SelectedPathStep } from "@/lib/drug_intelligence/drug_network_graph_readability";
import type { DrugGraphNode } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { formatThaiOperationalDate } from "@/lib/drug_intelligence/di_date_helpers";

export function DrugNetworkNodeDetail({
  node,
  onExpand,
  pinned,
  onTogglePin,
  isFocus,
  hopDistance,
  reasonKey,
  pathSteps,
  openReturnPath = null,
}: {
  node: DrugGraphNode;
  onExpand: () => void;
  /** DI-9.2: whether this node is currently pinned. Ignored unless `onTogglePin` is provided. */
  pinned?: boolean;
  /** DI-9.2: present only in Analyst Mode — omitting it hides the entire pin section (Section 3: no edit affordances in View Mode). */
  onTogglePin?: () => void;
  isFocus?: boolean;
  hopDistance?: number;
  reasonKey?: TranslationKey;
  pathSteps?: SelectedPathStep[];
  /** Navigation-only Network (or other internal) path to restore after opening this entity. */
  openReturnPath?: string | null;
}) {
  const { t } = useT();

  const actionLabel = node.type === "PERSON" ? t("di.network.openProfile") : node.type === "CASE" ? t("di.network.openCase") : t("di.network.openDetail");
  const showOpenLink = node.type !== "LOCATION";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <DrugEntityVisualThumb
          entityType={node.type}
          label={node.label}
          thumbnailUrl={node.visual?.thumbnailUrl}
          size={node.type === "PERSON" ? "lg" : node.type === "VEHICLE" ? "md" : "sm"}
        />
        <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[node.type] as TranslationKey)}</p>
        <p className="text-lg font-semibold text-foreground">{node.label}</p>
        {node.secondaryLabel ? <p className="text-sm text-muted">{node.secondaryLabel}</p> : null}
        {node.metadata.type === "PERSON" ? (
          <p className="mt-1 text-xs text-muted">
            {t("di.profile.status")}: {node.metadata.status === "MERGED" ? t("di.profile.statusMerged") : t("di.profile.statusActive")}
          </p>
        ) : null}
        </div>
      </div>

      <DrugNetworkInspectorMedia entityType={node.type} entityId={node.id} openReturnPath={openReturnPath} />

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

      {reasonKey || hopDistance !== undefined ? (
        <div className="rounded-lg bg-neutral-bg/60 px-3 py-2 text-xs text-foreground">
          <p>
            <span className="text-muted">{t("di.network.graphRelationHeading")}</span>{" "}
            {isFocus || hopDistance === 0
              ? t("di.network.hopFocus")
              : hopDistance === 1
                ? t("di.network.hopDirect")
                : t("di.network.hopIndirect")}
          </p>
          {reasonKey ? <p className="mt-1 text-muted">{t(reasonKey)}</p> : null}
        </div>
      ) : null}

      {pathSteps && pathSteps.length >= 2 ? (
        <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs">
          <p className="font-semibold uppercase tracking-wide text-muted">{t("di.network.selectedPathHeading")}</p>
          <ol className="mt-1.5 space-y-1 text-foreground">
            {pathSteps.map((step, index) => (
              <li key={step.id}>
                {index > 0 ? <span className="mr-1 text-muted">→</span> : null}
                <span className="text-muted">{t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[step.type] as TranslationKey)}</span>{" "}
                {step.label}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {node.type === "CASE" ? (
          <>
            {node.metadata.type === "CASE" ? (
              <>
                <div>
                  <dt className="text-xs text-muted">{t("di.field.arrestDate")}</dt>
                  <dd className="text-foreground">{node.metadata.arrestDate ? formatThaiOperationalDate(node.metadata.arrestDate) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t("di.field.province")}</dt>
                  <dd className="text-foreground">{node.metadata.province || "—"}</dd>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div>
              <dt className="text-xs text-muted">{t("di.network.firstRecorded")}</dt>
              <dd className="text-foreground">{node.firstSeenAt ? formatThaiOperationalDate(node.firstSeenAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("di.network.lastRecorded")}</dt>
              <dd className="text-foreground">{node.lastSeenAt ? formatThaiOperationalDate(node.lastSeenAt) : "—"}</dd>
            </div>
          </>
        )}
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
            <Link href={withReturnTo(drugEntityDetailPath(node.type, node.id), openReturnPath)}>{actionLabel}</Link>
          </Button>
        ) : null}
        {showOpenLink && (node.type === "PERSON" || node.type === "VEHICLE" || node.type === "CASE" || node.type === "DEVICE") ? (
          <Button asChild variant="outline" size="sm">
            <Link href={withReturnTo(`${drugEntityDetailPath(node.type, node.id)}#media`, openReturnPath)}>
              {t("di.media.openGallery")}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
