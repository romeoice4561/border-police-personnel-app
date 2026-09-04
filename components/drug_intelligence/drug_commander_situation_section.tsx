/**
 * Deterministic Commander situation summary (Phase 2D). Not AI.
 */
"use client";

import Link from "next/link";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import type {
  CommanderSituationHref,
  CommanderSituationObservation,
} from "@/lib/drug_intelligence/drug_commander_comparison";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const SITUATION_ACTION_KEYS: Record<CommanderSituationHref, TranslationKey> = {
  cases: "di.command.situationOpenCases",
  map: "di.command.situationOpenMap",
  alerts: "di.command.situationOpenSignals",
  persons: "di.command.situationOpenPersons",
  duplicates: "di.command.situationOpenDuplicates",
};

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
      <CardHeader className="mb-1 px-0">
        <CardTitle id="situation-heading">{t("di.command.situationTitle")}</CardTitle>
      </CardHeader>
      <p className="mb-2 text-xs text-muted">{t("di.command.situationNote")}</p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {observations.map((obs) => {
          const text = language === "en" ? obs.textEn : obs.textTh;
          return (
            <li key={obs.id}>
              <Link
                href={obs.actionHref}
                className="flex min-w-0 flex-col gap-1 px-3 py-1.5 text-sm leading-snug text-foreground transition-colors hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0 break-words">{text}</span>
                <span className="shrink-0 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  {t(SITUATION_ACTION_KEYS[obs.href] ?? "di.command.situationOpen")} →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
