/**
 * DI-11D.1 — read-only Investigation Tasks panel for Case and Person.
 *
 * Shared UI: Case/Person supply targetKind + targetId only. No create/edit/
 * status actions. No delete. No factual mutation.
 */
"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "@/components/common/states";
import { Pagination } from "@/components/common/pagination";
import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { DrugInvestigationTaskCard } from "@/components/drug_intelligence/drug_investigation_task_card";
import { useT } from "@/components/i18n/language_provider";
import { useInvestigationTasks } from "@/lib/drug_intelligence/drug_investigation_tasks_hooks";
import {
  classifyInvestigationTasksError,
  investigationTasksErrorMessageKey,
  investigationTasksListVisibility,
} from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import { COLLABORATION_PAGE_DEFAULT, DRUG_INVESTIGATION_TASK_STATUSES } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { CollaborationTargetKind, DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const STATUS_LABEL: Record<DrugInvestigationTaskStatus, TranslationKey> = {
  OPEN: "di.tasks.statusOpen",
  IN_PROGRESS: "di.tasks.statusInProgress",
  DONE: "di.tasks.statusDone",
  CANCELLED: "di.tasks.statusCancelled",
};

export function DrugInvestigationTasksPanel({
  targetKind,
  targetId,
}: {
  targetKind: CollaborationTargetKind;
  targetId: string;
}) {
  const { t } = useT();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DrugInvestigationTaskStatus | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const tasks = useInvestigationTasks(targetKind, targetId, { page, status, overdueOnly });
  const emptyTitle = targetKind === "CASE" ? t("di.tasks.emptyCase") : t("di.tasks.emptyPerson");
  const meta = tasks.data?.meta;
  const items = tasks.data?.items ?? [];
  const { showLoading, showError, showEmpty, showList } = investigationTasksListVisibility({
    hasData: tasks.data != null,
    isPending: tasks.isPending,
    isError: tasks.isError,
    itemCount: items.length,
  });

  return (
    <Card data-testid="investigation-tasks-panel" data-target-kind={targetKind}>
      <CardBody className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.tasks.sectionTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("di.tasks.notFactual")}</p>
          {meta ? (
            <p className="mt-1 text-sm text-muted">
              {t("di.tasks.count").replace("{count}", String(meta.total))}
              {" · "}
              {t("di.tasks.showingPageSize").replace("{pageSize}", String(meta.pageSize || COLLABORATION_PAGE_DEFAULT))}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem] flex-1 space-y-1 text-xs text-muted">
            <span>{t("di.tasks.status")}</span>
            <Select
              value={status}
              disabled={overdueOnly}
              onChange={(event) => {
                setStatus(event.target.value as DrugInvestigationTaskStatus | "");
                setPage(1);
              }}
              placeholder={t("di.tasks.statusAll")}
              options={DRUG_INVESTIGATION_TASK_STATUSES.map((value) => ({
                value,
                label: t(STATUS_LABEL[value]),
              }))}
              data-testid="investigation-tasks-status-filter"
              aria-label={t("di.tasks.status")}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              checked={overdueOnly}
              onChange={(event) => {
                setOverdueOnly(event.target.checked);
                setPage(1);
              }}
              data-testid="investigation-tasks-overdue-filter"
            />
            {t("di.tasks.overdueOnly")}
          </label>
        </div>

        {showLoading ? <LoadingState rows={3} /> : null}

        {showError ? (
          <ErrorState
            title={t("di.tasks.loadError")}
            message={t(investigationTasksErrorMessageKey(classifyInvestigationTasksError(tasks.error)))}
            onRetry={() => void tasks.refetch()}
          />
        ) : null}

        {showEmpty ? <EmptyState title={emptyTitle} icon={<ListChecks className="h-8 w-8" />} /> : null}

        {showList ? (
          <div className="space-y-3">
            {items.map((task) => (
              <DrugInvestigationTaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : null}

        {meta && meta.total > 0 ? (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={meta.pageSize}
            onPageChange={setPage}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}
