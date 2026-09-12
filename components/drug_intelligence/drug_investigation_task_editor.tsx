/**
 * DI-11D.2 — shared create/edit form. No status selector. No target selector.
 */
"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThaiDatePicker, THAI_EXPIRY_YEAR_BE_MAX, THAI_EXPIRY_YEAR_BE_MIN } from "@/components/ui/thai_date_picker";
import { Field, HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { DrugInvestigationTaskAssigneeSelect } from "@/components/drug_intelligence/drug_investigation_task_assignee_select";
import { useT } from "@/components/i18n/language_provider";
import {
  TASK_DESCRIPTION_MAX,
  TASK_TITLE_MAX,
  validateTaskDescription,
  validateTaskTitle,
  type InvestigationTaskDraft,
} from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import { DRUG_INVESTIGATION_TASK_PRIORITIES } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { DrugInvestigationTaskPriority } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const PRIORITY_LABEL: Record<DrugInvestigationTaskPriority, TranslationKey> = {
  LOW: "di.tasks.priorityLow",
  NORMAL: "di.tasks.priorityNormal",
  HIGH: "di.tasks.priorityHigh",
  URGENT: "di.tasks.priorityUrgent",
};

export function DrugInvestigationTaskEditor({
  mode,
  draft,
  onChange,
  onSave,
  onCancel,
  pending,
  saveError,
  saveDisabled,
  survivorPersonId,
  fallbackAssigneeLabel,
}: {
  mode: "create" | "edit";
  draft: InvestigationTaskDraft;
  onChange: (next: InvestigationTaskDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  saveError: string | null;
  saveDisabled?: boolean;
  survivorPersonId?: string | null;
  fallbackAssigneeLabel?: string | null;
}) {
  const { t } = useT();
  const titleId = useId();
  const descriptionId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const titleParsed = validateTaskTitle(draft.title);
  const descriptionParsed = validateTaskDescription(draft.description);
  const canSave = titleParsed.ok && descriptionParsed.ok && !pending && !saveDisabled;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4" data-testid="investigation-task-editor">
      <Field label={t("di.tasks.title")} htmlFor={titleId} required>
        <input
          ref={titleRef}
          id={titleId}
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          maxLength={TASK_TITLE_MAX + 1}
          disabled={pending}
          className={inputCls}
          aria-invalid={!titleParsed.ok || Boolean(saveError)}
          aria-describedby={`${titleId}-count`}
        />
      </Field>
      <HelperText>
        <span id={`${titleId}-count`}>
          {t("di.tasks.charCount").replace("{count}", String(draft.title.length)).replace("{max}", String(TASK_TITLE_MAX))}
        </span>
      </HelperText>
      {titleParsed.ok === false && titleParsed.reason === "too_long" ? (
        <p className="text-sm text-critical">{t("di.tasks.titleTooLong")}</p>
      ) : null}

      <Field label={t("di.tasks.description")} htmlFor={descriptionId}>
        <textarea
          id={descriptionId}
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          rows={4}
          maxLength={TASK_DESCRIPTION_MAX + 1}
          disabled={pending}
          className={`${inputCls} min-h-24 resize-y whitespace-pre-wrap break-words`}
        />
      </Field>
      <HelperText>
        {t("di.tasks.charCount").replace("{count}", String(draft.description.length)).replace("{max}", String(TASK_DESCRIPTION_MAX))}
      </HelperText>
      {descriptionParsed.ok === false ? <p className="text-sm text-critical">{t("di.tasks.descriptionTooLong")}</p> : null}

      <Field label={t("di.tasks.assignee")}>
        <DrugInvestigationTaskAssigneeSelect
          value={draft.assignedActorId}
          onChange={(assignedActorId) => onChange({ ...draft, assignedActorId })}
          disabled={pending}
          fallbackLabel={fallbackAssigneeLabel}
        />
      </Field>

      <Field label={t("di.tasks.priority")}>
        <Select
          value={draft.priority}
          onChange={(event) => onChange({ ...draft, priority: event.target.value as DrugInvestigationTaskPriority })}
          disabled={pending}
          options={DRUG_INVESTIGATION_TASK_PRIORITIES.map((value) => ({
            value,
            label: t(PRIORITY_LABEL[value]),
          }))}
          data-testid="investigation-task-priority"
          aria-label={t("di.tasks.priority")}
        />
      </Field>

      <Field label={t("di.tasks.dueAt")}>
        <ThaiDatePicker
          value={draft.dueDate}
          onChange={(dueDate) => onChange({ ...draft, dueDate })}
          outputFormat="iso"
          disabled={pending}
          commitOnBrowse={false}
          yearRangeBE={{ min: THAI_EXPIRY_YEAR_BE_MIN, max: THAI_EXPIRY_YEAR_BE_MAX }}
          data-testid="investigation-task-due"
          aria-label={t("di.tasks.dueAt")}
        />
      </Field>

      {saveError ? (
        <p className="text-sm text-critical" role="alert" data-testid="investigation-task-save-error">
          {saveError}
        </p>
      ) : null}

      {survivorPersonId ? (
        <p className="text-sm">
          <Link
            href={`/drug-intelligence/persons/${encodeURIComponent(survivorPersonId)}`}
            className="text-accent hover:underline"
            data-testid="investigation-task-open-survivor"
          >
            {t("di.profile.openSurvivor")}
          </Link>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={!canSave} data-testid="investigation-task-save">
          {pending ? t("di.profile.saving") : mode === "edit" ? t("common.save") : t("di.tasks.saveTask")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending} data-testid="investigation-task-editor-cancel">
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
