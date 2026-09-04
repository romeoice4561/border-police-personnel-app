/**
 * Compact Commander attention strip (Phase 2E).
 *
 * Workflow / data-readiness only — not a risk score. Zero-count items omitted.
 */
"use client";

import Link from "next/link";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import type { CommanderAttentionItem } from "@/lib/drug_intelligence/drug_commander_attention";

interface Props {
  items: CommanderAttentionItem[];
}

export function CommanderAttentionSection({ items }: Props) {
  const { t } = useT();
  const review = items.filter((item) => item.group === "review");
  const complete = items.filter((item) => item.group === "complete");

  return (
    <section aria-labelledby="attention-heading" data-testid="commander-attention-summary">
      <CardHeader className="mb-1 px-0">
        <CardTitle id="attention-heading">{t("di.command.attentionTitle")}</CardTitle>
      </CardHeader>
      <p className="mb-2 text-xs text-muted">{t("di.command.attentionNote")}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t("di.command.attentionEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {review.length > 0 ? (
            <AttentionGroup
              testId="commander-attention-review"
              heading={t("di.command.attentionReview")}
              items={review}
            />
          ) : null}
          {complete.length > 0 ? (
            <AttentionGroup
              testId="commander-attention-complete"
              heading={t("di.command.attentionComplete")}
              items={complete}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function AttentionGroup({
  heading,
  items,
  testId,
}: {
  heading: string;
  items: CommanderAttentionItem[];
  testId: string;
}) {
  const { t } = useT();
  return (
    <div data-testid={testId}>
      <h3 className="mb-1.5 text-xs font-medium text-muted">{heading}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              data-testid={`commander-attention-${item.id}`}
              className="inline-flex items-baseline gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-accent/50 hover:bg-neutral-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="font-semibold tabular-nums text-foreground">
                {item.count.toLocaleString("th-TH")}
              </span>
              <span className="leading-snug text-foreground">{t(item.labelKey)}</span>
              {item.queueScope ? (
                <span className="text-[11px] text-muted">{t("di.command.kpiQueueBadge")}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
