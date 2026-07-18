/**
 * OfficerTrainingIntelligenceCard (Phase 45 — Training Intelligence Engine;
 * Phase 45 completion pass — product visibility).
 *
 * Sits ABOVE the factual TrainingSection/TrainingEditor record list (never
 * replaces it) — the Intelligence summary answers "what does this mean for
 * a decision," the list below it remains the raw historical record. Every
 * value is read directly from OfficerIntelligenceViewModel.training — no
 * calculation happens here. `NoPolicy` renders its own distinct,
 * informational-tone panel (never a warning) rather than an empty/misleading
 * requirement list, and is never confused with `MissingRequired`.
 *
 * "verified"/"unverified" counts never claim a verification the schema
 * doesn't track — see TRAINING_STATUS_TONE and the unverified-count copy
 * below, which reads "ยังไม่ตรวจสอบ" (not yet verified), not "failed
 * verification."
 */
import type { OfficerIntelligenceViewModel } from "@/lib/officer_intelligence/types";
import { TRAINING_STATUS_TONE } from "@/lib/intelligence/training/status_tone";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function OfficerTrainingIntelligenceCard({ viewModel }: { viewModel: OfficerIntelligenceViewModel }) {
  const { t } = useT();
  const { training } = viewModel;

  if (!training.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("officer.trainingIntelligenceTitle")}</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-muted">{t("officer.trainingUnavailable")}</p>
        </CardBody>
      </Card>
    );
  }

  const isPolicyDriven = training.trainingStatus !== "NoPolicy" && training.trainingStatus !== "NoData";
  const isNoPolicy = training.trainingStatus === "NoPolicy";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("officer.trainingIntelligenceTitle")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">{t("officer.trainingStatusLabel")}</dt>
          <dd className="mt-0.5">
            <Badge tone={TRAINING_STATUS_TONE[training.trainingStatus]}>{training.displayStatusTh}</Badge>
          </dd>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label={t("officer.trainingTotalRecords")} value={`${training.totalRecords.toLocaleString("th-TH")}`} />
          <StatTile label={t("officer.trainingVerified")} value={`${training.verifiedRecords.toLocaleString("th-TH")}`} />
          <StatTile label={t("officer.trainingUnverified")} value={`${training.unverifiedRecords.toLocaleString("th-TH")}`} />
          {training.dataQualityFlags.length > 0 ? (
            <StatTile label={t("officer.trainingDataIssueCount")} value={`${training.dataQualityFlags.length.toLocaleString("th-TH")}`} />
          ) : null}
        </dl>

        {isPolicyDriven ? (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatTile label={t("officer.trainingRequiredByPolicy")} value={`${training.requiredRequirements.length.toLocaleString("th-TH")}`} />
              <StatTile label={t("officer.trainingMissing")} value={`${training.missingRequiredCourseCount.toLocaleString("th-TH")}`} />
            </dl>

            {training.missingRequirements.length > 0 ? (
              <div className="rounded-lg border border-serious/30 bg-serious/5 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-serious">{t("officer.trainingMissing")}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                  {training.missingRequirements.map((requirement) => (
                    <li key={requirement.requirementKey}>{requirement.displayNameTh}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : isNoPolicy ? (
          // Task 2 rule: NoPolicy is informational/neutral — never a red
          // warning, never a missing-course count (there is nothing to
          // measure against).
          <p className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-foreground">
            {t("officer.trainingNoPolicySupportingText")}
          </p>
        ) : null}

        {training.dataQualityFlags.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("officer.trainingDataIssuesTitle")}</p>
            <ul className="mt-1 space-y-1">
              {training.dataQualityFlags.map((flag) => (
                <li key={flag.code} className="flex items-start gap-1.5 text-sm text-foreground">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                  <span>{t(`officer.trainingFlag.${flag.code}` as TranslationKey)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted">{t("officer.trainingNoDataIssues")}</p>
        )}

        {training.recommendationsTh.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("officer.trainingRecommendationsTitle")}</p>
            <ul className="mt-1 space-y-0.5 text-sm text-foreground">
              {training.recommendationsTh.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
