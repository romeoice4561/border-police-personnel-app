/**
 * Relationship Search builder + results (Phase 1B.2 UX).
 * Field-officer 3-step workflow — consumes Phase 1B catalog/API unchanged.
 */
"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Car,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  Info,
  Link2,
  Phone,
  RotateCcw,
  ScanSearch,
  Smartphone,
  User,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
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
  type DrugControlledRelationDefinition,
} from "@/lib/drug_intelligence/drug_relationship_query_catalog";
import { DRUG_GRAPH_NODE_TYPE_LABEL_KEY } from "@/lib/drug_intelligence/drug_network_graph_client_labels";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const SOURCE_TYPES: DrugGraphNodeType[] = ["PERSON", "PHONE", "SIM", "DEVICE", "VEHICLE", "CASE"];

const ENTITY_ICON: Record<DrugGraphNodeType, LucideIcon> = {
  PERSON: User,
  PHONE: Phone,
  SIM: CreditCard,
  DEVICE: Smartphone,
  VEHICLE: Car,
  CASE: FileSpreadsheet,
  LOCATION: FileSpreadsheet,
};

const PRESET_UI: Record<
  string,
  { titleKey: TranslationKey; descKey: TranslationKey; icon: LucideIcon }
> = {
  preset_phone_cases: {
    titleKey: "di.rel.presetPhoneCasesTitle",
    descKey: "di.rel.presetPhoneCasesDesc",
    icon: Phone,
  },
  preset_person_phones: {
    titleKey: "di.rel.presetPersonPhonesTitle",
    descKey: "di.rel.presetPersonPhonesDesc",
    icon: User,
  },
  preset_vehicle_cases: {
    titleKey: "di.rel.presetVehicleCasesTitle",
    descKey: "di.rel.presetVehicleCasesDesc",
    icon: Car,
  },
  preset_device_cases: {
    titleKey: "di.rel.presetDeviceCasesTitle",
    descKey: "di.rel.presetDeviceCasesDesc",
    icon: Smartphone,
  },
  preset_sim_cases: {
    titleKey: "di.rel.presetSimCasesTitle",
    descKey: "di.rel.presetSimCasesDesc",
    icon: CreditCard,
  },
  preset_person_path: {
    titleKey: "di.rel.presetPersonPathTitle",
    descKey: "di.rel.presetPersonPathDesc",
    icon: Link2,
  },
};

function EntityCard({
  selection,
  onClear,
  typeLabel,
}: {
  selection: DrugNetworkEntitySelection;
  onClear: () => void;
  typeLabel: string;
}) {
  const { t } = useT();
  const Icon = ENTITY_ICON[selection.entityType] ?? FileSpreadsheet;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-border bg-neutral-bg px-3 py-3"
      data-testid="selected-entity-card"
    >
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-accent" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground break-words">{selection.label}</p>
        <p className="text-xs text-muted">{typeLabel}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={t("di.rel.clearEntity")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StepArrow({ mobile }: { mobile?: boolean }) {
  const { t } = useT();
  return (
    <div
      className={[
        "flex items-center justify-center text-muted",
        mobile ? "py-1 lg:hidden" : "hidden lg:flex",
      ].join(" ")}
      aria-hidden="true"
      title={t("di.rel.flowArrow")}
    >
      {mobile ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </div>
  );
}

function relationExplainKey(relation: DrugControlledRelationDefinition): TranslationKey {
  if (relation.queryMode === "PATH" || relation.edgeKind === "PATH") return "di.rel.explainPath";
  if (relation.edgeKind === "INFERRED") return "di.rel.explainInferred";
  return "di.rel.explainDirect";
}

function presetBadgeKey(relation: DrugControlledRelationDefinition | null): TranslationKey {
  if (!relation) return "di.rel.badgeDirect";
  if (relation.queryMode === "PATH" || relation.edgeKind === "PATH") return "di.rel.badgePath";
  if (relation.edgeKind === "INFERRED") return "di.rel.badgeInferred";
  return "di.rel.badgeDirect";
}

export function DrugRelationshipSearchPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useT();
  const step1Ref = useRef<HTMLElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sourceType = (searchParams.get("relSourceType") as DrugGraphNodeType | null) ?? "PHONE";
  const sourceId = searchParams.get("relSourceId") ?? "";
  const sourceLabel = searchParams.get("relSourceLabel") ?? "";
  const relationId = searchParams.get("relationId") ?? "";
  const targetType = (searchParams.get("relTargetType") as DrugGraphNodeType | null) ?? "";
  const targetId = searchParams.get("relTargetId") ?? "";
  const targetLabel = searchParams.get("relTargetLabel") ?? "";
  const page = Number(searchParams.get("relPage") ?? "1") || 1;
  const run = searchParams.get("relRun") === "1";
  const activePresetId = searchParams.get("relPreset") ?? "";

  const [draftSourceType, setDraftSourceType] = useState<DrugGraphNodeType>(
    SOURCE_TYPES.includes(sourceType) ? sourceType : "PHONE"
  );
  const [draftSource, setDraftSource] = useState<DrugNetworkEntitySelection | null>(
    sourceId ? { entityType: sourceType, entityId: sourceId, label: sourceLabel || sourceId } : null
  );
  const [draftRelationId, setDraftRelationId] = useState(relationId);
  const [draftTarget, setDraftTarget] = useState<DrugNetworkEntitySelection | null>(
    targetId ? { entityType: (targetType as DrugGraphNodeType) || "CASE", entityId: targetId, label: targetLabel || targetId } : null
  );
  const [draftTargetType, setDraftTargetType] = useState<DrugGraphNodeType | "">(targetType as DrugGraphNodeType | "");
  const [draftPresetId, setDraftPresetId] = useState(activePresetId);

  const availableRelations = useMemo(
    () => relationsForSourceType(draftSource?.entityType ?? draftSourceType),
    [draftSource, draftSourceType]
  );
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
    else if (options?.run === false) next.delete("relRun");
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
    setDraftPresetId(presetId);
    const keepSource = draftSource && draftSource.entityType === preset.sourceType;
    if (!keepSource) setDraftSource(null);
    pushRelationshipParams({
      relSourceType: preset.sourceType,
      relationId: preset.relationId,
      relTargetType: relation?.targetTypes[0],
      relTargetId: undefined,
      relTargetLabel: undefined,
      relRun: undefined,
      relPage: undefined,
      relPreset: presetId,
      ...(keepSource
        ? { relSourceId: draftSource!.entityId, relSourceLabel: draftSource!.label }
        : { relSourceId: undefined, relSourceLabel: undefined }),
    });
    // Quick Search sits below the builder — bring the officer back to Step 1 when source is required.
    if (!keepSource) {
      requestAnimationFrame(() => {
        step1Ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = step1Ref.current?.querySelector<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
        );
        focusable?.focus({ preventScroll: true });
      });
    }
  }

  function onSourceTypeChange(nextType: DrugGraphNodeType) {
    setDraftSourceType(nextType);
    setDraftSource(null);
    setDraftRelationId("");
    setDraftTarget(null);
    setDraftTargetType("");
    setDraftPresetId("");
  }

  function onRelationChange(nextId: string) {
    setDraftRelationId(nextId);
    setDraftPresetId("");
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
    if (submitting) return;
    setSubmitting(true);
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
        relPreset: draftPresetId || undefined,
      },
      { run: true }
    );
    window.setTimeout(() => setSubmitting(false), 600);
  }

  function resetAll() {
    setDraftSourceType("PHONE");
    setDraftSource(null);
    setDraftRelationId("");
    setDraftTarget(null);
    setDraftTargetType("");
    setDraftPresetId("");
    pushRelationshipParams({
      relSourceType: undefined,
      relSourceId: undefined,
      relSourceLabel: undefined,
      relationId: undefined,
      relTargetType: undefined,
      relTargetId: undefined,
      relTargetLabel: undefined,
      relRun: undefined,
      relPage: undefined,
      relPreset: undefined,
    });
  }

  function onExpand(entity: { entityType: DrugGraphNodeType; entityId: string; label: string }) {
    setDraftSourceType(entity.entityType);
    setDraftSource(entity);
    setDraftRelationId("");
    setDraftTarget(null);
    setDraftTargetType("");
    setDraftPresetId("");
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
      relPreset: undefined,
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
    <div className="space-y-4" data-testid="relationship-search-panel">
      {/* 3-step workflow — primary investigation path (before shortcuts) */}
      <div data-testid="relationship-workflow">
      <Card>
        <CardBody className="space-y-3">
          <h2 className="sr-only">{t("di.rel.workflowLabel")}</h2>

          <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-2">
            {/* Step 1 */}
            <section
              ref={step1Ref}
              id="rel-step-1"
              className="space-y-2.5 rounded-xl border border-border bg-neutral-bg/40 p-2.5 sm:p-3"
              aria-labelledby="rel-source-heading"
              data-testid="rel-step-1"
            >
              <div>
                <h3 id="rel-source-heading" className="text-sm font-semibold text-foreground">
                  {t("di.rel.sourceSection")}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{t("di.rel.sourceSectionHint")}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("di.rel.sourceType")}</label>
                <Select
                  options={sourceTypeOptions}
                  value={draftSource?.entityType ?? draftSourceType}
                  onChange={(e) => onSourceTypeChange(e.target.value as DrugGraphNodeType)}
                />
              </div>
              {draftSource ? (
                <EntityCard
                  selection={draftSource}
                  typeLabel={t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[draftSource.entityType] as TranslationKey)}
                  onClear={() => setDraftSource(null)}
                />
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

            <StepArrow />
            <StepArrow mobile />

            {/* Step 2 */}
            <section
              id="rel-step-2"
              className="space-y-2.5 rounded-xl border border-border bg-neutral-bg/40 p-2.5 sm:p-3"
              aria-labelledby="rel-relation-heading"
              data-testid="rel-step-2"
            >
              <div>
                <h3 id="rel-relation-heading" className="text-sm font-semibold text-foreground">
                  {t("di.rel.relationSection")}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{t("di.rel.relationSectionHint")}</p>
              </div>
              <Select
                options={[{ value: "", label: t("di.rel.relationPlaceholder") }, ...relationOptions]}
                value={draftRelationId}
                onChange={(e) => onRelationChange(e.target.value)}
                disabled={availableRelations.length === 0}
              />
              {selectedRelation ? (
                <div
                  className="space-y-1.5 rounded-xl border border-border bg-surface px-3 py-2.5"
                  data-testid="relation-explain-card"
                >
                  <p className="text-sm font-medium text-foreground">{t(selectedRelation.labelKey)}</p>
                  <p className="text-xs text-muted">{t(relationExplainKey(selectedRelation))}</p>
                  <span className="inline-flex rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {t(presetBadgeKey(selectedRelation))}
                  </span>
                </div>
              ) : null}
            </section>

            <StepArrow />
            <StepArrow mobile />

            {/* Step 3 */}
            <section
              id="rel-step-3"
              className="space-y-2.5 rounded-xl border border-border bg-neutral-bg/40 p-2.5 sm:p-3"
              aria-labelledby="rel-target-heading"
              data-testid="rel-step-3"
            >
              <div>
                <h3 id="rel-target-heading" className="text-sm font-semibold text-foreground">
                  {t("di.rel.targetSection")}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{t("di.rel.targetSectionHint")}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t("di.rel.targetType")}</label>
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
                <p className="text-xs text-muted">
                  {selectedRelation.targetOptional ? t("di.rel.targetOptionalHint") : t("di.rel.targetRequiredHint")}
                </p>
              ) : null}
              {draftTarget ? (
                <EntityCard
                  selection={draftTarget}
                  typeLabel={t(DRUG_GRAPH_NODE_TYPE_LABEL_KEY[draftTarget.entityType] as TranslationKey)}
                  onClear={() => setDraftTarget(null)}
                />
              ) : effectiveTargetType && effectiveTargetType !== "LOCATION" ? (
                <DrugNetworkEntityPicker
                  allowedTypes={[effectiveTargetType]}
                  placeholder={
                    selectedRelation?.targetOptional ? t("di.rel.targetSearchOptional") : t("di.rel.selectEntity")
                  }
                  onSelect={(selection) => setDraftTarget(selection)}
                />
              ) : null}
            </section>
          </div>

          {/* Primary Search CTA — immediately beneath workflow */}
          <div className="flex flex-col items-stretch gap-2.5 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-center">
            <Button
              type="button"
              variant="accent"
              onClick={submitSearch}
              disabled={!canSubmit || submitting}
              data-testid="rel-search-submit"
              className="min-h-12 w-full px-8 text-base font-semibold sm:w-[min(100%,22rem)]"
              title={!canSubmit ? t("di.rel.searchDisabledHint") : undefined}
            >
              🔎 {t("di.rel.searchButton")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetAll}
              data-testid="rel-reset-all"
              className="min-h-11 w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("di.rel.resetAll")}
            </Button>
          </div>
          {!canSubmit ? (
            <p className="text-center text-xs text-muted" data-testid="rel-search-disabled-hint">
              {t("di.rel.searchDisabledHint")}
            </p>
          ) : null}
        </CardBody>
      </Card>
      </div>

      {/* Quick Search — secondary shortcuts below main workflow + CTA */}
      <section className="space-y-2.5" aria-labelledby="rel-presets-heading" data-testid="relationship-quick-search">
        <div>
          <h2 id="rel-presets-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
            <Zap className="h-4 w-4 text-accent" aria-hidden="true" />
            {t("di.rel.presetsLabel")}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{t("di.rel.presetsHint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {DRUG_RELATIONSHIP_SEARCH_PRESETS.map((preset) => {
            const ui = PRESET_UI[preset.id];
            const relation = getControlledRelation(preset.relationId);
            const Icon = ui?.icon ?? Link2;
            const selected = draftPresetId === preset.id || (draftRelationId === preset.relationId && draftSourceType === preset.sourceType);
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`rel-preset-${preset.id}`}
                data-active={selected ? "true" : "false"}
                onClick={() => applyPreset(preset.id)}
                className={[
                  "min-h-[6.25rem] rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  selected
                    ? "border-accent bg-accent/10 shadow-sm"
                    : "border-border bg-surface hover:border-accent/50 hover:bg-neutral-bg/50",
                ].join(" ")}
              >
                <div className="flex h-full flex-col gap-1.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-bg text-accent" aria-hidden="true">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {ui ? t(ui.titleKey) : t(preset.labelKey)}
                  </span>
                  <span className="text-xs leading-snug text-muted">
                    {ui ? t(ui.descKey) : t(preset.labelKey)}
                  </span>
                  <span className="mt-auto inline-flex w-fit rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {t(presetBadgeKey(relation))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* QUERY CONDITION notice */}
      <aside
        className="flex gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
        data-testid="query-condition-notice"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{t("di.rel.queryConditionNote")}</p>
          <p className="text-xs leading-relaxed text-muted">{t("di.rel.queryConditionBody")}</p>
        </div>
      </aside>

      {/* Results */}
      <section aria-live="polite" data-testid="relationship-results-area">
        {!run || !query ? (
          <div className="rounded-xl border border-dashed border-border bg-neutral-bg/30 px-4 py-8 text-center">
            <EmptyState
              title={t("di.rel.promptEmptyTitle")}
              message={t("di.rel.promptEmpty")}
              icon={<ScanSearch className="h-8 w-8" />}
            />
          </div>
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
      </section>
    </div>
  );
}
