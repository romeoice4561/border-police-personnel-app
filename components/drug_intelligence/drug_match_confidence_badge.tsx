/**
 * DrugMatchConfidenceBadge (Phase DI-2 Round B — Section 12).
 *
 * Renders a DrugMatchConfidence value ("HIGH"/"MEDIUM"/"LOW") as a colored
 * Badge with a text label — never color alone (same convention as
 * DrugCaseStatusBadge). Confidence is always explainable from the signal
 * list the backend computed; this component never re-derives it.
 */
import { useT } from "@/components/i18n/language_provider";
import { Badge } from "@/components/ui/badge";
import type { DrugMatchConfidence } from "@/lib/drug_intelligence/drug_intelligence_client";

const TONE: Record<DrugMatchConfidence, "critical" | "warning" | "neutral"> = {
  HIGH: "critical",
  MEDIUM: "warning",
  LOW: "neutral",
};

export function DrugMatchConfidenceBadge({ confidence }: { confidence: DrugMatchConfidence }) {
  const { t } = useT();
  const labelKey = confidence === "HIGH" ? "di.person.confidenceHigh" : confidence === "MEDIUM" ? "di.person.confidenceMedium" : "di.person.confidenceLow";
  return <Badge tone={TONE[confidence]}>{t(labelKey)}</Badge>;
}
