/**
 * DrugCaseStatusBadge (Phase DI-1 Round 2).
 *
 * Renders a DrugCase.status value as a colored Badge, reusing the shared
 * Badge primitive and DRUG_CASE_STATUS_META's tone mapping — mirrors
 * VerificationBadge/ManualEntryBadge's exact "always with a text label,
 * never color alone" convention from the Personnel module.
 */
import { useT } from "@/components/i18n/language_provider";
import { Badge } from "@/components/ui/badge";
import { DRUG_CASE_STATUS_META, isValidDrugCaseStatus } from "@/lib/drug_intelligence/drug_case_options";

export function DrugCaseStatusBadge({ status }: { status: string }) {
  const { language } = useT();
  if (!isValidDrugCaseStatus(status)) return <Badge tone="neutral">{status}</Badge>;
  const meta = DRUG_CASE_STATUS_META[status];
  return <Badge tone={meta.color}>{language === "th" ? meta.labelTh : meta.labelEn}</Badge>;
}
