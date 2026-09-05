"use client";

import { Bookmark } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { useT } from "@/components/i18n/language_provider";
import { formatThaiPersonnelDate } from "@/lib/officer_profile/thai_personnel_date";
import type { DrugInvestigationBoardSummary } from "@/lib/drug_intelligence/drug_intelligence_client";

export function DrugNetworkSavedBoardsDrawer({
  open,
  boards,
  isLoading,
  isError,
  onRetry,
  status,
  onStatusChange,
  onClose,
  onOpenBoard,
  onStartNew,
}: {
  open: boolean;
  boards: DrugInvestigationBoardSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  status: "ACTIVE" | "ARCHIVED";
  onStatusChange: (status: "ACTIVE" | "ARCHIVED") => void;
  onClose: () => void;
  onOpenBoard: (boardId: string) => void;
  onStartNew: () => void;
}) {
  const { t } = useT();

  return (
    <Drawer open={open} onClose={onClose} titleId="di-saved-boards-title" title={t("di.board.listTitle")}>
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={status === "ACTIVE" ? "accent" : "outline"}
            size="sm"
            onClick={() => onStatusChange("ACTIVE")}
          >
            {t("di.board.showActive")}
          </Button>
          <Button
            type="button"
            variant={status === "ARCHIVED" ? "accent" : "outline"}
            size="sm"
            onClick={() => onStatusChange("ARCHIVED")}
          >
            {t("di.board.showArchived")}
          </Button>
        </div>

        {isLoading ? (
          <LoadingState rows={6} label={t("di.board.listLoading")} />
        ) : isError ? (
          <ErrorState message={t("di.board.listError")} onRetry={onRetry} />
        ) : !boards || boards.length === 0 ? (
          <EmptyState title={t("di.board.listEmpty")} icon={<Bookmark className="h-8 w-8" />} />
        ) : (
          <ul className="space-y-2 overflow-y-auto">
            {boards.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left hover:bg-neutral-bg"
                  onClick={() => onOpenBoard(board.id)}
                  data-testid={`investigation-board-open-${board.id}`}
                >
                  <p className="truncate text-sm font-medium text-foreground">{board.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t("di.board.updated")}: {formatThaiPersonnelDate(board.updatedAt) || board.updatedAt}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto">
          <Button type="button" variant="outline" className="w-full" onClick={onStartNew} data-testid="investigation-board-start-new">
            {t("di.board.startNew")}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
