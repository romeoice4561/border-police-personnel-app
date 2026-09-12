/**
 * DI-11D.2 — legal status workflow actions. No reopen. No delete.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DrugInvestigationTaskConfirmDialog } from "@/components/drug_intelligence/drug_investigation_task_confirm_dialog";
import { useT } from "@/components/i18n/language_provider";
import { legalTaskStatusTransitions } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import type { DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";

export function DrugInvestigationTaskActions({
  status,
  disabled,
  pending,
  onTransition,
}: {
  status: DrugInvestigationTaskStatus;
  disabled?: boolean;
  pending?: boolean;
  onTransition: (next: DrugInvestigationTaskStatus) => void;
}) {
  const { t } = useT();
  const [confirm, setConfirm] = useState<DrugInvestigationTaskStatus | null>(null);
  const allowed = legalTaskStatusTransitions(status);
  if (allowed.length === 0) return null;

  const locked = Boolean(disabled || pending);

  function request(next: DrugInvestigationTaskStatus) {
    if (next === "DONE" || next === "CANCELLED") {
      setConfirm(next);
      return;
    }
    onTransition(next);
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="investigation-task-actions">
      {allowed.includes("IN_PROGRESS") ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locked}
          onClick={() => request("IN_PROGRESS")}
          data-testid="investigation-task-start"
        >
          {t("di.tasks.startAction")}
        </Button>
      ) : null}
      {allowed.includes("DONE") ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locked}
          onClick={() => request("DONE")}
          data-testid="investigation-task-complete"
        >
          {t("di.tasks.completeAction")}
        </Button>
      ) : null}
      {allowed.includes("CANCELLED") ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locked}
          onClick={() => request("CANCELLED")}
          data-testid="investigation-task-cancel"
          className="border-critical text-critical hover:bg-critical/5"
        >
          {t("di.tasks.cancelAction")}
        </Button>
      ) : null}

      <DrugInvestigationTaskConfirmDialog
        open={confirm === "DONE"}
        title={t("di.tasks.completeConfirmTitle")}
        description={t("di.tasks.completeConfirm")}
        confirmLabel={t("di.tasks.completeAction")}
        cancelLabel={t("common.cancel")}
        pending={pending}
        onConfirm={() => {
          setConfirm(null);
          onTransition("DONE");
        }}
        onCancel={() => setConfirm(null)}
      />
      <DrugInvestigationTaskConfirmDialog
        open={confirm === "CANCELLED"}
        title={t("di.tasks.cancelConfirmTitle")}
        description={t("di.tasks.cancelConfirm")}
        confirmLabel={t("di.tasks.cancelAction")}
        cancelLabel={t("common.cancel")}
        pending={pending}
        danger
        onConfirm={() => {
          setConfirm(null);
          onTransition("CANCELLED");
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
