/**
 * AchievementsSection (Phase 21A — Editable Profile Foundation, Part 7;
 * Phase 26B Part 6 Part K — reusable category structure; Phase 49A.2 —
 * localization/UI polish pass).
 *
 * Architecture + UI only. No achievements exist in the schema yet (confirmed
 * against prisma/schema.prisma — no Achievement model, no relation, no
 * repository, no API route), so this always renders an honest empty state —
 * never a fabricated "Coming Soon" badge implying imminent availability with
 * no committed timeline, and never a dead "Add" button with nothing behind
 * it. Future support (documented, not implemented): images, description,
 * date, category, attachment, admin verification.
 *
 * Phase 26B Part 6 Part K: the future `category` field is expected to be one
 * of ACHIEVEMENT_CATEGORY_OPTIONS (Royal Decorations / Awards / Certificates
 * / Commendations) — documented here, alongside the row shape, so a future
 * implementation has one place both the data shape and its category list
 * come from, matching the "prepare reusable structure" instruction (same
 * pattern as Part I/J's Education/Training row shapes, which are already
 * fully implemented — see EducationSection/TrainingSection).
 */
import { Trophy } from "lucide-react";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";
import { useT } from "@/components/i18n/language_provider";

/** Phase 26B Part 6 Part K: the 4 achievement categories the spec lists — documentation only, not yet a real column. */
export const ACHIEVEMENT_CATEGORY_OPTIONS = ["ROYAL_DECORATION", "AWARD", "CERTIFICATE", "COMMENDATION"] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORY_OPTIONS)[number];

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, { labelTh: string; labelEn: string }> = {
  ROYAL_DECORATION: { labelTh: "เครื่องราชอิสริยาภรณ์", labelEn: "Royal Decorations" },
  AWARD: { labelTh: "รางวัล", labelEn: "Awards" },
  CERTIFICATE: { labelTh: "ประกาศนียบัตร", labelEn: "Certificates" },
  COMMENDATION: { labelTh: "หนังสือชมเชย", labelEn: "Commendations" },
};

/** Shape a future Achievement record is expected to take (not persisted yet — documentation only). */
export interface FutureAchievement {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  category: AchievementCategory | null;
  attachmentUrl: string | null;
  verifiedByAdmin: boolean;
  imageUrl: string | null;
}

export function AchievementsSection() {
  const { t } = useT();
  return (
    <EditableSectionCard title={t("officer.achievements")}>
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Trophy className="h-8 w-8 text-muted" aria-hidden="true" />
        <SectionEmptyState message={t("officer.achievementsEmpty")} />
      </div>
    </EditableSectionCard>
  );
}
