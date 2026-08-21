/**
 * DrugMatchSignalsList (Phase DI-2 Round B — Section 12).
 *
 * Renders the backend-computed match signals as human-readable reasons via
 * explainDrugMatch() — reuses the SAME explanation function the API/service
 * layer uses, never recomputes matching rules or wording in React.
 */
import { useT } from "@/components/i18n/language_provider";
import { explainDrugMatch } from "@/lib/drug_intelligence/drug_match_explanation";
import type { DrugMatchSignal, DrugMatchConfidence } from "@/lib/drug_intelligence/drug_intelligence_client";

export function DrugMatchSignalsList({ signals, confidence }: { signals: DrugMatchSignal[]; confidence: DrugMatchConfidence }) {
  const { language } = useT();
  const explanation = explainDrugMatch(signals, confidence, language);

  if (explanation.reasons.length === 0) return null;

  return (
    <ul className="space-y-1 text-sm text-muted">
      {explanation.reasons.map((reason, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span aria-hidden="true">•</span>
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  );
}
