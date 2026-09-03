/**
 * CommanderActionsSection (Phase 2B).
 *
 * Quick-action links for the Commander Dashboard.
 * Navigates to alerts center, duplicate review, cases, map, network.
 */
"use client";

import Link from "next/link";
import { BellRing, GitCompareArrows, Map, Network, FileText, Search } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderDashboardFilter } from "@/lib/drug_intelligence/drug_commander_filter";
import type { CommanderUrlState } from "@/lib/drug_intelligence/drug_commander_scope";
import { commanderAlertsHref, commanderCasesHref, commanderDuplicatesHref, commanderMapHref, commanderNetworkWorkspaceHref, commanderSearchHref } from "@/lib/drug_intelligence/drug_commander_drilldown";

interface CommanderAction {
  href: string;
  icon: typeof BellRing;
  labelKey: string;
  descKey?: string;
  badge?: number;
}

interface Props {
  pendingDuplicates?: number;
  newAlerts?: number;
  filter: CommanderDashboardFilter;
  urlState?: CommanderUrlState;
}

export function CommanderActionsSection({ pendingDuplicates, newAlerts, filter, urlState }: Props) {
  const { t } = useT();

  const actions: CommanderAction[] = [
    {
      href: commanderAlertsHref({ status: "NEW" }, filter, urlState),
      icon: BellRing,
      labelKey: "di.command.actionAlerts",
      badge: newAlerts,
    },
    {
      href: commanderDuplicatesHref(filter, urlState),
      icon: GitCompareArrows,
      labelKey: "di.command.actionDuplicates",
      badge: pendingDuplicates,
    },
    {
      href: commanderCasesHref(filter, undefined, urlState),
      icon: FileText,
      labelKey: "di.command.viewCases",
    },
    {
      href: commanderMapHref(filter, undefined, urlState),
      icon: Map,
      labelKey: "di.command.viewMap",
    },
    {
      href: commanderNetworkWorkspaceHref(filter, urlState),
      icon: Network,
      labelKey: "di.command.openNetwork",
    },
    {
      href: commanderSearchHref(filter, urlState),
      icon: Search,
      labelKey: "di.command.openSearch",
    },
  ];

  return (
    <section aria-labelledby="actions-heading">
      <CardHeader className="mb-4 px-0">
        <CardTitle id="actions-heading">{t("di.command.actionsTitle")}</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
            >
              <Card className="flex flex-col items-center gap-2 p-4 text-center hover:border-accent/50 hover:bg-neutral-bg transition-colors relative">
                {action.badge !== undefined && action.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-serious text-white text-xs font-bold px-1">
                    {action.badge > 99 ? "99+" : action.badge}
                  </span>
                )}
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-foreground leading-tight">
                  {t(action.labelKey as Parameters<typeof t>[0])}
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
