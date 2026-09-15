/**
 * DI-11C — plain-text Analyst Note composer (create + edit).
 */
"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, HelperText, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";
import { formatDiDateTime } from "@/lib/drug_intelligence/di_date_helpers";
import { ANALYST_NOTE_BODY_MAX, validateNoteBody } from "@/lib/drug_intelligence/drug_analyst_notes_view";

export function DrugAnalystNoteEditor({
  value,
  onChange,
  onSave,
  onCancel,
  pending,
  saveError,
  mode,
  sourceTask = null,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  saveError: string | null;
  mode: "create" | "edit";
  sourceTask?: { title: string; createdAt?: string } | null;
}) {
  const { t } = useT();
  const fieldId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const parsed = validateNoteBody(value);
  const overLimit = value.trim().length > ANALYST_NOTE_BODY_MAX;
  const canSave = parsed.ok && !pending;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4" data-testid="analyst-note-editor">
      {sourceTask ? (
        <div className="rounded-lg border border-border bg-neutral-bg px-3 py-2" data-testid="analyst-note-source-task-context">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {t("di.collaboration.resultNoteContext")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {t("di.collaboration.resultNoteTaskLabel")}: {sourceTask.title}
          </p>
          {sourceTask.createdAt ? (
            <p className="mt-0.5 text-xs text-muted">
              {t("di.collaboration.createdAt")} {formatDiDateTime(sourceTask.createdAt)}
            </p>
          ) : null}
        </div>
      ) : null}
      <Field label={t("di.collaboration.noteBody")} htmlFor={fieldId} required>
        <textarea
          ref={textareaRef}
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={6}
          maxLength={ANALYST_NOTE_BODY_MAX + 1}
          disabled={pending}
          className={`${inputCls} min-h-28 resize-y`}
          aria-invalid={overLimit || Boolean(saveError)}
          aria-describedby={`${fieldId}-count${saveError ? ` ${fieldId}-error` : ""}`}
        />
      </Field>
      <HelperText>
        <span id={`${fieldId}-count`}>
          {t("di.collaboration.charCount").replace("{count}", String(value.length)).replace("{max}", String(ANALYST_NOTE_BODY_MAX))}
        </span>
      </HelperText>
      {overLimit ? <p className="text-sm text-critical">{t("di.collaboration.tooLong")}</p> : null}
      {saveError ? (
        <p id={`${fieldId}-error`} className="text-sm text-critical" role="alert">
          {saveError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={!canSave} data-testid="analyst-note-save">
          {pending ? t("di.profile.saving") : mode === "edit" ? t("common.save") : t("di.collaboration.saveNote")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending} data-testid="analyst-note-cancel">
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
