"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { formatThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";
import type { DrugInvestigationBoardDetail } from "@/lib/drug_intelligence/drug_intelligence_client";

export function DrugNetworkSavedBoardHeader({
  board,
  dirty,
  canManage,
  menuOpen,
  onToggleMenu,
  onRename,
  onDuplicate,
  onArchive,
}: {
  board: DrugInvestigationBoardDetail;
  dirty: boolean;
  canManage: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const { t } = useT();
  const archived = board.status === "ARCHIVED";
  const updatedLabel = formatThaiPersonnelDate(board.updatedAt) || board.updatedAt;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface px-3 py-2"
      data-testid="investigation-board-identity"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{board.title}</p>
          <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-[11px] font-medium text-muted">
            {archived ? t("di.board.statusArchived") : t("di.board.statusActive")}
          </span>
          <span
            role="status"
            className={dirty ? "text-xs font-medium text-warning" : "text-xs font-medium text-good"}
            data-testid="investigation-board-dirty"
          >
            {dirty ? t("di.board.unsaved") : t("di.board.saved")}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {t("di.board.owner")}: {board.ownerActorName}
          <span className="mx-2 text-border">·</span>
          {t("di.board.updated")}: {updatedLabel}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">{t("di.board.liveGraphAuthority")}</p>
      </div>
      {canManage ? (
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("di.board.moreActions")}
            aria-expanded={menuOpen}
            data-testid="investigation-board-overflow"
            onClick={onToggleMenu}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-lg border border-border bg-surface py-1 shadow-sm">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-neutral-bg"
                onClick={onRename}
              >
                {t("di.board.rename")}
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-neutral-bg"
                onClick={onDuplicate}
              >
                {t("di.board.duplicate")}
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-critical hover:bg-critical/5"
                onClick={onArchive}
              >
                {t("di.board.archive")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
