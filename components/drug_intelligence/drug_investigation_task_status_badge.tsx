/**
 * DI-11D.1 — Investigation Task status badge. Text + tone; never color alone.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { investigationTaskStatusLabelKey } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import type { DrugInvestigationTaskStatus } from "@/lib/drug_intelligence/drug_collaboration_options";

function statusTone(status: DrugInvestigationTaskStatus): "accent" | "warning" | "good" | "neutral" {
  if (status === "IN_PROGRESS") return "warning";
  if (status === "DONE") return "good";
  if (status === "CANCELLED") return "neutral";
  return "accent";
}

export function DrugInvestigationTaskStatusBadge({ status }: { status: DrugInvestigationTaskStatus }) {
  const { t } = useT();
  return <Badge tone={statusTone(status)}>{t(investigationTaskStatusLabelKey(status))}</Badge>;
}
