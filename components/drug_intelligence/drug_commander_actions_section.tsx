/**
 * Commander Action Center (Phase 2D / 2E).
 *
 * Workflow queue — not AI advice. Current queues are labelled as such.
 * CommanderActionGroup is declared before the exported section so the
 * runtime binding exists before JSX evaluation (Phase 2E.1).
 */
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export interface CommanderActionItem {
  id: string;
  href: string;
  label: string;
  why: string;
  actionLabel?: string;
  count?: number;
  queueScope?: boolean;
  group?: "review" | "complete";
}

interface Props {
  items: CommanderActionItem[];
}

function CommanderActionGroup({
  heading,
  items,
  t,
}: {
  heading: string;
  items: CommanderActionItem[];
  t: (key: TranslationKey) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted">{heading}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Card className="flex h-full min-h-[8.5rem] flex-col gap-2 p-4 transition-colors hover:border-accent/50 hover:bg-neutral-bg">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm font-medium leading-snug break-words text-foreground">{item.label}</span>
                <span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
                  {(item.count ?? 0).toLocaleString("th-TH")}
                </span>
              </div>
              <p className="text-xs leading-snug text-muted">{item.why}</p>
              {item.queueScope && (
                <span className="w-fit rounded-full bg-neutral-bg px-2 py-0.5 text-[11px] text-muted">
                  {t("di.command.kpiQueueBadge")}
                </span>
              )}
              <span className="mt-auto text-xs text-accent">
                {item.actionLabel ?? t("di.command.actionOpen")} →
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
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
