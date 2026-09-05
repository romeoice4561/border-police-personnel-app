/**
 * Action Center group cards (Phase 2E / 2E.1).
 *
 * Isolated module so Turbopack cannot leave a stale ActionGroup binding
 * inside CommanderActionsSection's previous client chunk.
 */
"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
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

export function CommanderActionGroup({
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
