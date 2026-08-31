/**
 * Relationship Search builder + results panel (Phase 1B MVP).
 * Stacked Thai form — no horizontal node editor.
 */
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, ScanSearch } from "lucide-react";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { DrugNetworkEntityPicker, type DrugNetworkEntitySelection } from "@/components/drug_intelligence/drug_network_entity_picker";
import { DrugRelationshipSearchResults } from "@/components/drug_intelligence/drug_relationship_search_results";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useDrugRelationshipSearch } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import {
  DRUG_RELATIONSHIP_SEARCH_PRESETS,
  getControlledRelation,
  relationsForSourceType,
} from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const SOURCE_TYPES: DrugGraphNodeType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE"];

export function DrugRelationshipSearchPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useT();

  const sourceType = (searchParams.get("relSourceType") as DrugGraphNodeType | null) ?? "PHONE";
  const sourceId = searchParams.get("relSourceId") ?? "";
  const sourceLabel = searchParams.get("relSourceLabel") ?? "";
  const relationId = searchParams.get("relationId") ?? "";
  const targetType = (searchParams.get("relTargetType") as DrugGraphNodeType | null) ?? "";
  const targetId = searchParams.get("relTargetId") ?? "";
  const targetLabel = searchParams.get("relTargetLabel") ?? "";
  const page = Number(searchParams.get("relPage") ?? "1") || 1;
  const run = searchParams.get("relRun") === "1";

  const [draftSourceType, setDraftSourceType] = useState<DrugGraphNodeType>(SOURCE_TYPES.includes(sourceType) ? sourceType : "PHONE");
  const [draftSource, setDraftSource] = useState<DrugNetworkEntitySelection | null>(
    sourceId ? { entityType: sourceType, entityId: sourceId, label: sourceLabel || sourceId } : null
  );
  const [draftRelationId, setDraftRelationId] = useState(relationId);
  const [draftTarget, setDraftTarget] = useState<DrugNetworkEntitySelection | null>(
    targetId ? { entityType: (targetType as DrugGraphNodeType) || "CASE", entityId: targetId, label: targetLabel || targetId } : null
  );
  const [draftTargetType, setDraftTargetType] = useState<DrugGraphNodeType | "">(targetType as DrugGraphNodeType | "");

  const availableRelations = useMemo(() => relationsForSourceType(draftSource?.entityType ?? draftSourceType), [draftSource, draftSourceType]);
  const selectedRelation = draftRelationId ? getControlledRelation(draftRelationId) : null;

  const effectiveTargetType: DrugGraphNodeType | "" =
    draftTargetType ||
    (selectedRelation && selectedRelation.targetTypes.length === 1 ? selectedRelation.targetTypes[0]! : "") ||
    (selectedRelation?.targetTypes[0] ?? "");

  function pushRelationshipParams(patch: Record<string, string | undefined>, options?: { run?: boolean }) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", "relationship");
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (options?.run) next.set("relRun", "1");
    router.push(`/drug-intelligence/search?${next.toString()}`);
  }

  function applyPreset(presetId: string) {
    const preset = DRUG_RELATIONSHIP_SEARCH_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const relation = getControlledRelation(preset.relationId);
    setDraftSourceType(preset.sourceType);
    setDraftRelationId(preset.relationId);
    setDraftTarget(null);
    setDraftTargetType(relation?.targetTypes[0] ?? "");
    if (!draftSource || draftSource.entityType !== preset.sourceType) {
      setDraftSource(null);
    }
    pushRelationshipParams({
      relSourceType: preset.sourceType,
      relationId: preset.relationId,
      relTargetType: relation?.targetTypes[0],
      relTargetId: undefined,
      relTargetLabel: undefined,
      relRun: undefined,
      relPage: undefined,
      ...(draftSource && draftSource.entityType === preset.sourceType
        ? { relSourceId: draftSource.entityId, relSourceLabel: draftSource.label }
        : { relSourceId: undefined, relSourceLabel: undefined }),
    });
  }

  function onSourceTypeChange(nextType: DrugGraphNodeType) {
    setDraftSourceType(nextType);
    setDraftSource(null);
    setDraftRelationId("");
    setDraftTarget(null);
    setDraftTargetType("");
  }

  function onRelationChange(nextId: string) {
    setDraftRelationId(nextId);
    const relation = getControlledRelation(nextId);
    const nextTargetType = relation?.targetTypes[0] ?? "";
    setDraftTargetType(nextTargetType);
    if (draftTarget && relation && !relation.targetTypes.includes(draftTarget.entityType)) {
      setDraftTarget(null);
    }
  }

  function submitSearch() {
    if (!draftSource || !draftRelationId || !effectiveTargetType) return;
    const relation = getControlledRelation(draftRelationId);
    if (!relation) return;
    if (!relation.targetOptional && !draftTarget) return;

    pushRelationshipParams(
      {
        relSourceType: draftSource.entityType,
        relSourceId: draftSource.entityId,
        relSourceLabel: draftSource.label,
        relationId: draftRelationId,
        relTargetType: effectiveTargetType,
        relTargetId: draftTarget?.entityId,
        relTargetLabel: draftTarget?.label,
        relPage: "1",
      },
      { run: true }
    );
  }

  function onExpand(entity: { entityType: DrugGraphNodeType; entityId: string; label: string }) {
    setDraftSourceType(entity.entityType);
    setDraftSource(entity);
    setDraftRelationId("");
    setDraftTarget(null);
    setDraftTargetType("");
    pushRelationshipParams({
      relSourceType: entity.entityType,
      relSourceId: entity.entityId,
      relSourceLabel: entity.label,
      relationId: undefined,
      relTargetType: undefined,
      relTargetId: undefined,
      relTargetLabel: undefined,
      relRun: undefined,
      relPage: undefined,
    });
  }

  const query =
    run && sourceId && relationId && targetType
      ? {
          sourceType,
          sourceId,
          relationId,
          targetType: targetType as DrugGraphNodeType,
          targetId: targetId || undefined,
          page,
          pageSize: 20,
        }
      : null;

  const search = useDrugRelationshipSearch(user?.id ?? null, user?.displayName ?? "", query);
  const returnPath = `/drug-intelligence/search?${searchParams.toString()}`;

  const sourceTypeOptions = SOURCE_TYPES.map((et) => ({
    value: et,
    label: t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[et] as TranslationKey),
  }));

  const relationOptions = availableRelations.map((r) => ({ value: r.id, label: t(r.labelKey) }));

  const targetTypeOptions = (selectedRelation?.targetTypes ?? []).map((et) => ({
    value: et,
    label: t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[et] as TranslationKey),
  }));

  const canSubmit =
    Boolean(draftSource) &&
    Boolean(draftRelationId) &&
    Boolean(effectiveTargetType) &&
    Boolean(selectedRelation?.targetOptional || draftTarget);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("di.rel.presetsLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {DRUG_RELATIONSHIP_SEARCH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm text-foreground hover:border-accent/50"
            >
              {t(preset.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardBody className="space-y-5">
          <section className="space-y-3" aria-labelledby="rel-source-heading">
            <h2 id="rel-source-heading" className="text-sm font-semibold text-foreground">
              {t("di.rel.sourceSection")}
            </h2>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.rel.sourceType")}</label>
              <Select
                options={sourceTypeOptions}
                value={draftSource?.entityType ?? draftSourceType}
                onChange={(e) => onSourceTypeChange(e.target.value as DrugGraphNodeType)}
              />
            </div>
            {draftSource ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-neutral-bg px-3 py-2">
                <div>
                  <p className="text-xs text-muted">{t("di.rel.selectedEntity")}</p>
                  <p className="text-sm font-medium text-foreground break-words">{draftSource.label}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraftSource(null)}>
                  {t("di.rel.clearEntity")}
                </Button>
              </div>
            ) : (
              <DrugNetworkEntityPicker
                allowedTypes={[draftSourceType]}
                placeholder={t("di.rel.selectEntity")}
                onSelect={(selection) => {
                  setDraftSource(selection);
                  setDraftSourceType(selection.entityType);
                }}
              />
            )}
          </section>

          <div className="flex justify-center text-muted" aria-hidden="true">
            <Link2 className="h-4 w-4" />
          </div>

          <section className="space-y-3" aria-labelledby="rel-relation-heading">
            <h2 id="rel-relation-heading" className="text-sm font-semibold text-foreground">
              {t("di.rel.relationSection")}
            </h2>
            <Select
              options={[{ value: "", label: t("di.rel.relationPlaceholder") }, ...relationOptions]}
              value={draftRelationId}
              onChange={(e) => onRelationChange(e.target.value)}
              disabled={!draftSource && availableRelations.length === 0}
            />
          </section>

          <div className="flex justify-center text-muted" aria-hidden="true">
            <Link2 className="h-4 w-4" />
          </div>

          <section className="space-y-3" aria-labelledby="rel-target-heading">
            <h2 id="rel-target-heading" className="text-sm font-semibold text-foreground">
              {t("di.rel.targetSection")}
            </h2>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">{t("di.rel.targetType")}</label>
              <Select
                options={targetTypeOptions.length > 0 ? targetTypeOptions : [{ value: "", label: "—" }]}
                value={effectiveTargetType}
                onChange={(e) => {
                  setDraftTargetType(e.target.value as DrugGraphNodeType);
                  setDraftTarget(null);
                }}
                disabled={!selectedRelation}
              />
            </div>
            {selectedRelation ? (
              <p className="text-xs text-muted">{selectedRelation.targetOptional ? t("di.rel.targetOptionalHint") : t("di.rel.targetRequiredHint")}</p>
            ) : null}
            {draftTarget ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-neutral-bg px-3 py-2">
                <div>
                  <p className="text-xs text-muted">{t("di.rel.selectedEntity")}</p>
                  <p className="text-sm font-medium text-foreground break-words">{draftTarget.label}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraftTarget(null)}>
                  {t("di.rel.clearEntity")}
                </Button>
              </div>
            ) : effectiveTargetType && effectiveTargetType !== "LOCATION" ? (
              <DrugNetworkEntityPicker
                allowedTypes={[effectiveTargetType]}
                placeholder={t("di.rel.selectEntity")}
                onSelect={(selection) => setDraftTarget(selection)}
              />
            ) : null}
          </section>

          <Button type="button" onClick={submitSearch} disabled={!canSubmit} className="min-h-11 w-full sm:w-auto">
            🔎 {t("di.rel.searchButton")}
          </Button>
        </CardBody>
      </Card>

      {!run || !query ? (
        <EmptyState title={t("di.rel.promptEmpty")} icon={<ScanSearch className="h-8 w-8" />} />
      ) : search.isPending ? (
        <LoadingState />
      ) : search.isError ? (
        <ErrorState message={t("di.rel.errorLoad")} onRetry={() => search.refetch()} />
      ) : search.data.summary.total === 0 ? (
        <EmptyState
          title={selectedRelation?.queryMode === "PATH" ? t("di.rel.pathNotFound") : t("di.rel.noResults")}
          message={selectedRelation?.queryMode === "PATH" ? t("di.rel.pathNotFoundHint") : undefined}
          icon={<Link2 className="h-8 w-8" />}
        />
      ) : (
        <DrugRelationshipSearchResults data={search.data} returnPath={returnPath} onExpand={onExpand} />
      )}
    </div>
  );
}
