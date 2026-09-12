/**
 * DI-11D.1 — Investigation Task priority badge. Separate from overdue.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import { investigationTaskPriorityLabelKey } from "@/lib/drug_intelligence/drug_investigation_tasks_view";
import type { DrugInvestigationTaskPriority } from "@/lib/drug_intelligence/drug_collaboration_options";

function priorityTone(priority: DrugInvestigationTaskPriority): "neutral" | "default" | "warning" | "serious" {
  if (priority === "LOW") return "neutral";
  if (priority === "HIGH") return "warning";
  if (priority === "URGENT") return "serious";
  return "default";
}

export function DrugInvestigationTaskPriorityBadge({ priority }: { priority: DrugInvestigationTaskPriority }) {
  const { t } = useT();
  return (
    <Badge tone={priorityTone(priority)}>
      {t("di.tasks.priority")} · {t(investigationTaskPriorityLabelKey(priority))}
    </Badge>
  );
}
