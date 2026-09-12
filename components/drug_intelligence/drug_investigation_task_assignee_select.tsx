/**
 * DI-11D.2 — assignee directory select. Labels are displayName only.
 */
"use client";

import { Select } from "@/components/ui/select";
import { useT } from "@/components/i18n/language_provider";
import { useCollaborationAssignees } from "@/lib/drug_intelligence/drug_investigation_tasks_hooks";
import type { CollaborationAssigneeDto } from "@/lib/drug_intelligence/drug_collaboration_types";

export function DrugInvestigationTaskAssigneeSelect({
  value,
  onChange,
  disabled,
  fallbackLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  fallbackLabel?: string | null;
}) {
  const { t } = useT();
  const assignees = useCollaborationAssignees(true);
  const rows: CollaborationAssigneeDto[] = assignees.data ?? [];
  const options = rows.map((row) => ({ value: row.id, label: row.displayName }));
  if (value && !options.some((row) => row.value === value) && fallbackLabel) {
    options.unshift({ value, label: fallbackLabel });
  }

  return (
    <div className="space-y-1">
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || assignees.isPending}
        placeholder={t("di.tasks.unassigned")}
        options={options}
        data-testid="investigation-task-assignee"
        aria-label={t("di.tasks.assignee")}
      />
      {assignees.isError ? <p className="text-xs text-critical">{t("di.tasks.assigneeLoadError")}</p> : null}
    </div>
  );
}
