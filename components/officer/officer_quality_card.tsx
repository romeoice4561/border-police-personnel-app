/**
 * OfficerQualityCard (Phase 15A).
 *
 * Quality score, knowledge score, and the AI Quality Summary sentence. The
 * summary text is derived by the pure helper (lib/ui/officer_summary) from the
 * persisted signals — no derivation logic in this component.
 */
import { Sparkles } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { buildQualitySummary } from "@/lib/ui/officer_summary";
import { bandForScore } from "@/lib/ui/quality";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { QualityBadge } from "@/components/common/quality_badge";
import { useT } from "@/components/i18n/language_provider";

function ScoreRow({ label, score }: { label: string; score: number | null | undefined }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {score === null || score === undefined ? "—" : `${score}/100`}
      </span>
    </div>
  );
}

export function OfficerQualityCard({ officer }: { officer: OfficerWithRelations }) {
  const { t } = useT();
  const summary = buildQualitySummary(officer);
  const band = bandForScore(officer.qualityScore).band;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("officer.qualityAiSummary")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{t("officer.qualityOverall")}</span>
          <QualityBadge score={officer.qualityScore} />
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <ScoreRow label={t("officer.qualityScoreLabel")} score={officer.qualityScore} />
          <ScoreRow label={t("officer.knowledgeScoreLabel")} score={officer.knowledgeScore} />
          <ScoreRow label={t("officer.extractionConfidenceLabel")} score={officer.confidence} />
        </div>

        <div className="rounded-lg border border-border bg-neutral-bg/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t("officer.qualityAiSummary")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{summary}</p>
          <p className="sr-only">
            {t("officer.qualityBandSrLabel")}: {band}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
