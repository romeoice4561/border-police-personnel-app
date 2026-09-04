/**
 * Compact Commander attention items (Phase 2E).
 *
 * Workflow / data-readiness grouping only — never a risk or AI score.
 * Zero counts are omitted. Pure — no I/O, no React.
 */

export type CommanderAttentionGroup = "review" | "complete";

export interface CommanderAttentionItem {
  id: "new-alerts" | "duplicates" | "missing-arrested" | "missing-unit" | "missing-coords";
  group: CommanderAttentionGroup;
  count: number;
  href: string;
  labelKey:
    | "di.command.attentionSignals"
    | "di.command.attentionDuplicates"
    | "di.command.attentionMissingArrested"
    | "di.command.attentionMissingUnit"
    | "di.command.attentionMissingCoords";
  queueScope: boolean;
}

export interface CommanderAttentionInput {
  newAlertsCount: number;
  pendingDuplicatesCount: number;
  missingArrestedCount: number;
  missingUnitCount: number;
  missingCoordsCount: number;
  alertsHref: string;
  duplicatesHref: string;
  missingArrestedHref: string;
  missingUnitHref: string;
  missingCoordsHref: string;
}

export function buildCommanderAttentionItems(input: CommanderAttentionInput): CommanderAttentionItem[] {
  const items: CommanderAttentionItem[] = [
    {
      id: "new-alerts",
      group: "review",
      count: input.newAlertsCount,
      href: input.alertsHref,
      labelKey: "di.command.attentionSignals",
      queueScope: true,
    },
    {
      id: "duplicates",
      group: "review",
      count: input.pendingDuplicatesCount,
      href: input.duplicatesHref,
      labelKey: "di.command.attentionDuplicates",
      queueScope: true,
    },
    {
      id: "missing-arrested",
      group: "complete",
      count: input.missingArrestedCount,
      href: input.missingArrestedHref,
      labelKey: "di.command.attentionMissingArrested",
      queueScope: false,
    },
    {
      id: "missing-unit",
      group: "complete",
      count: input.missingUnitCount,
      href: input.missingUnitHref,
      labelKey: "di.command.attentionMissingUnit",
      queueScope: false,
    },
    {
      id: "missing-coords",
      group: "complete",
      count: input.missingCoordsCount,
      href: input.missingCoordsHref,
      labelKey: "di.command.attentionMissingCoords",
      queueScope: false,
    },
  ];
  return items.filter((item) => item.count > 0);
}
