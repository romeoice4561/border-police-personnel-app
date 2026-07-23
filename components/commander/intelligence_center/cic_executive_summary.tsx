/**
 * CicExecutiveSummary (Phase 49B — Commander Intelligence Center).
 *
 * Renders the executive summary headline + bullet counts — text entirely
 * composed by build_view_model.ts from existing engine counts (promotion
 * eligibility, document expiry, retirement, training). No AI call is made;
 * this is a deterministic template over already-computed numbers, matching
 * the example format in the spec exactly.
 */
"use client";

import { Sparkles } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";
import type { ExecutiveSummaryViewModel } from "@/lib/commander_intelligence_center/types";

export function CicExecutiveSummary({ summary }: { summary: ExecutiveSummaryViewModel }) {
  const { t } = useT();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
          {t("cic.summary.title")}
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {summary.urgentOfficerCount === 0 && summary.bulletsTh.length === 0 ? (
          <p className="text-sm text-muted">{t("cic.summary.empty")}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">{summary.headlineTh}</p>
            {summary.bulletsTh.length > 0 ? (
              <ul className="space-y-1 pl-1">
                {summary.bulletsTh.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-foreground/90">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
