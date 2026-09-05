/**
 * Commander Action Center (Phase 2D / 2E).
 *
 * Workflow queue — not AI advice. Current queues are labelled as such.
 * Group cards live in drug_commander_action_group.tsx so this module
 * never evaluates a local ActionGroup identifier (Phase 2E.1).
 */
"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import {
  CommanderActionGroup,
  type CommanderActionItem,
} from "@/components/drug_intelligence/drug_commander_action_group";

export type { CommanderActionItem };

interface Props {
  items: CommanderActionItem[];
}

export function CommanderActionsSection({ items }: Props) {
  const { t } = useT();
  const visible = items.filter((item) => (item.count ?? 0) > 0);
  const review = visible.filter((item) => item.group !== "complete");
  const complete = visible.filter((item) => item.group === "complete");

  return (
    <section aria-labelledby="actions-heading" data-testid="commander-action-center">
      <CardHeader className="mb-2 px-0">
        <CardTitle id="actions-heading">{t("di.command.actionCenterTitle")}</CardTitle>
      </CardHeader>
      <p className="mb-4 text-xs text-muted">{t("di.command.actionCenterNote")}</p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">{t("di.command.actionCenterEmpty")}</p>
      ) : (
        <div className="space-y-4">
          <CommanderActionGroup heading={t("di.command.attentionReview")} items={review} t={t} />
          <CommanderActionGroup heading={t("di.command.attentionComplete")} items={complete} t={t} />
        </div>
      )}
    </section>
  );
}
