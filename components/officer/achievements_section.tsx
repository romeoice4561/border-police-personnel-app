/**
 * AchievementsSection (Phase 21A — Editable Profile Foundation, Part 7).
 *
 * Architecture + UI only. No achievements exist in the schema yet, so this
 * always renders the empty state. Future support (documented, not
 * implemented): images, description, date, category, attachment, admin
 * verification.
 */
import { Trophy } from "lucide-react";
import { EditableSectionCard, SectionEmptyState } from "@/components/officer/editable_section_card";

/** Shape a future Achievement record is expected to take (not persisted yet — documentation only). */
export interface FutureAchievement {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  category: string | null;
  attachmentUrl: string | null;
  verifiedByAdmin: boolean;
  imageUrl: string | null;
}

export function AchievementsSection() {
  return (
    <EditableSectionCard title="Achievements">
      <div className="flex flex-col items-center gap-2 py-2">
        <Trophy className="h-8 w-8 text-muted" aria-hidden="true" />
        <SectionEmptyState message="No achievements yet." />
      </div>
    </EditableSectionCard>
  );
}
