/**
 * Commander Action Center (Phase 2D).
 *
 * Workflow queue — not AI advice. Current queues are labelled as such.
 */
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";

export interface CommanderActionItem {
  id: string;
  href: string;
  label: string;
  why: string;
  count?: number;
  queueScope?: boolean;
}

interface Props {
  items: CommanderActionItem[];
}

export function CommanderActionsSection({ items }: Props) {
  const { t } = useT();
  const visible = items.filter((item) => (item.count ?? 0) > 0);

  return (
    <section aria-labelledby="actions-heading" data-testid="commander-action-center">
      <CardHeader className="mb-2 px-0">
        <CardTitle id="actions-heading">{t("di.command.actionCenterTitle")}</CardTitle>
      </CardHeader>
      <p className="mb-4 text-xs text-muted">{t("di.command.actionCenterNote")}</p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">{t("di.command.actionCenterEmpty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visible.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-accent/50 hover:bg-neutral-bg">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
                    {(item.count ?? 0).toLocaleString("th-TH")}
                  </span>
                </div>
                <p className="text-xs text-muted leading-snug">{item.why}</p>
                {item.queueScope && (
                  <span className="w-fit rounded-full bg-neutral-bg px-2 py-0.5 text-[11px] text-muted">
                    {t("di.command.kpiQueueBadge")}
                  </span>
                )}
                <span className="mt-auto text-xs text-accent">{t("di.command.actionOpen")} →</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
