/**
 * TimelineActions (Phase 45 — Timeline Workspace UX, Part 7).
 *
 * Move Up / Move Down / Delete controls for one Timeline card. Real buttons
 * (keyboard-operable, ARIA-labelled), disabled at the list ends. Reorder is
 * expressed as intent callbacks (onMoveUp/onMoveDown) so a future drag-and-drop
 * layer can reuse the SAME reorder logic in lib/officer_profile/timeline_ux
 * without changing this component or the save contract.
 */
"use client";

import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { useT } from "@/components/i18n/language_provider";
import { Button } from "@/components/ui/button";

export function TimelineActions({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon" onClick={onMoveUp} disabled={!canMoveUp} aria-label={t("timeline.moveUp")}>
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={onMoveDown} disabled={!canMoveDown} aria-label={t("timeline.moveDown")}>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label={t("timeline.delete")}>
        <Trash2 className="h-4 w-4 text-serious" aria-hidden="true" />
      </Button>
    </div>
  );
}
