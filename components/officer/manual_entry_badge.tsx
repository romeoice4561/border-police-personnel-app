/**
 * ManualEntryBadge (Phase XX — Manual Personnel Entry, Admin Only).
 *
 * Shows "🟡 Manual Entry" (Thai/English via useT) on any officer whose
 * `source` is "manual", so admins/commanders can tell a hand-created profile
 * apart from one the AI/Drive pipeline produced. Renders nothing for
 * source="import" (the default — every existing officer) so this is a pure
 * additive marker with zero visual effect anywhere else.
 */
import { useT } from "@/components/i18n/language_provider";
import { Badge } from "@/components/ui/badge";
import { OFFICER_SOURCE_META, type OfficerSource } from "@/lib/manual_entry/officer_source_options";

export function ManualEntryBadge({ source }: { source: string | null | undefined }) {
  const { language } = useT();
  if (source !== "manual") return null;
  const meta = OFFICER_SOURCE_META["manual" satisfies OfficerSource];
  return (
    <Badge tone={meta.color}>
      🟡 {language === "th" ? meta.labelTh : meta.labelEn}
    </Badge>
  );
}
