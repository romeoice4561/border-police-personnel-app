"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language_provider";

export function DrugNetworkBoardConflictDialog({
  open,
  pending = false,
  onReloadLatest,
  onSaveAsCopy,
  onCancel,
}: {
  open: boolean;
  pending?: boolean;
  onReloadLatest: () => void;
  onSaveAsCopy: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4">
          <p className="text-base font-semibold text-foreground">{t("di.board.conflictTitle")}</p>
          <p className="text-sm text-muted">{t("di.board.conflictBody")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="outline" onClick={onSaveAsCopy} disabled={pending}>
              {t("di.board.saveAsCopy")}
            </Button>
            <Button type="button" onClick={onReloadLatest} disabled={pending}>
              {t("di.board.reloadLatest")}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
