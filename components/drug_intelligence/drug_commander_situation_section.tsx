/**
 * Deterministic Commander situation summary (Phase 2D). Not AI.
 */
"use client";

import Link from "next/link";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderSituationObservation } from "@/lib/drug_intelligence/drug_commander_comparison";

export interface CommanderSituationRow extends CommanderSituationObservation {
  actionHref: string;
}

interface Props {
  observations: CommanderSituationRow[];
}

export function CommanderSituationSection({ observations }: Props) {
  const { t, language } = useT();

  if (observations.length === 0) return null;

  return (
    <section aria-labelledby="situation-heading" data-testid="commander-situation-summary">
      <CardHeader className="mb-3 px-0">
        <CardTitle id="situation-heading">{t("di.command.situationTitle")}</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-muted">{t("di.command.situationNote")}</p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {observations.map((obs) => {
          const text = language === "en" ? obs.textEn : obs.textTh;
          return (
            <li key={obs.id}>
              <Link
                href={obs.actionHref}
                className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5 text-sm leading-snug text-foreground transition-colors hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="min-w-0 break-words">{text}</span>
                <span className="shrink-0 text-xs text-accent">{t("di.command.situationOpen")} →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
