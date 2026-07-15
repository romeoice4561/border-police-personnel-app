/**
 * CareerTimelineEditor (Phase 23A — Officer Profile Workspace, Section 2;
 * Phase 23B — preserve existing free-form values; Phase 45 — Timeline
 * Workspace UX refactor).
 *
 * The editable counterpart to CareerTimelineSection. Phase 45 turns the former
 * single long flat form into an ORCHESTRATOR that renders one TimelineCard per
 * entry — each a clearly-separated, collapsible record — plus a section-level
 * "Unsaved changes" indicator and a non-blocking validation panel. The actual
 * fields moved into TimelineCard verbatim; NO field or business logic changed.
 *
 * Phase 45 responsibilities added here (all presentation-only):
 *   • collapse/expand state per row (the current-position row is forced open);
 *   • Move Up / Move Down + delete + add, with automatic re-sequencing done by
 *     the array order the save mapping already turns into `sequence: i`;
 *   • per-card save status + a section "Unsaved changes" chip, from the REAL
 *     workspace save state (isSaving / saveError) passed in;
 *   • advisory warnings (duplicate current / year order / overlap / missing).
 *
 * Pure controlled component: receives the draft rows + setter from
 * useOfficerWorkspace, no fetching, no save logic of its own. Reorder is
 * expressed through lib/officer_profile/timeline_ux so a future drag-and-drop
 * layer can reuse the same logic without touching the save contract.
 */
"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { emptyTimelineRow, type TimelineDraftRow } from "@/components/officer/use_officer_workspace";
import { deriveCardStatus, deriveTimelineWarnings, moveDown, moveUp } from "@/lib/officer_profile/timeline_ux";
import { TimelineCard } from "@/components/officer/timeline/timeline_card";
import { TimelineValidationPanel } from "@/components/officer/timeline/timeline_validation_panel";
import type { OrganizationEngine } from "@/lib/organization/organization_engine";

export interface CareerTimelineEditorProps {
  rows: TimelineDraftRow[];
  onChange: (rows: TimelineDraftRow[]) => void;
  /** Phase 27: the shared OrganizationEngine, for the org hierarchy pickers. */
  organizationEngine: OrganizationEngine;
  /** Phase 45: real workspace save state, for per-card + section status. Additive/optional. */
  isSaving?: boolean;
  saveError?: unknown;
}

export function CareerTimelineEditor({ rows, onChange, organizationEngine, isSaving, saveError }: CareerTimelineEditorProps) {
  const { t } = useT();

  // Phase 27 Bug #6: legacy "Unit Name" suggestions from the shared engine.
  const unitNameSuggestions = useMemo(
    () => [...organizationEngine.getBattalions().map((b) => b.nameTh), ...organizationEngine.getCompanies().map((c) => c.nameTh)],
    [organizationEngine]
  );

  // Collapse state: which rows the user has explicitly collapsed (by key). The
  // current-position row is ALWAYS expanded regardless (enforced below), and a
  // brand-new draft row starts expanded so the user can fill it in.
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const warnings = useMemo(() => deriveTimelineWarnings(rows), [rows]);
  const hasError = Boolean(saveError);

  function updateRow(key: string, patch: Partial<TimelineDraftRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    // New rows are expanded by default (not in the collapsed set).
    onChange([...rows, emptyTimelineRow()]);
  }

  function removeRow(key: string) {
    onChange(rows.filter((r) => r.key !== key));
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function toggleCollapse(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Reorder (Part 7/8). The array order IS the persisted sequence (the save
  // mapping assigns `sequence: i`), so moving a row re-sequences automatically
  // with no business-logic change.
  function handleMoveUp(index: number) {
    onChange(moveUp(rows, index));
  }
  function handleMoveDown(index: number) {
    onChange(moveDown(rows, index));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{t("timeline.title")}</CardTitle>
          {/* Section-level "Unsaved changes" indicator (Part 7). Shown while
              editing (drafts aren't persisted until Save); suppressed during an
              in-flight save so it doesn't contradict the per-card "Saving". */}
          {isSaving ? null : <Badge tone="warning">{t("timeline.unsavedChanges")}</Badge>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("timeline.addRow")}
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        <TimelineValidationPanel warnings={warnings} />

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("timeline.empty")}</p>
        ) : (
          rows.map((row, index) => {
            const expanded = row.isPresent || !collapsedKeys.has(row.key);
            const status = deriveCardStatus(row, { isSaving, hasError });
            return (
              <TimelineCard
                key={row.key}
                row={row}
                index={index}
                total={rows.length}
                status={status}
                expanded={expanded}
                organizationEngine={organizationEngine}
                unitNameSuggestions={unitNameSuggestions}
                onToggle={() => toggleCollapse(row.key)}
                onUpdate={(patch) => updateRow(row.key, patch)}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                onDelete={() => removeRow(row.key)}
                canMoveUp={index > 0}
                canMoveDown={index < rows.length - 1}
              />
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
