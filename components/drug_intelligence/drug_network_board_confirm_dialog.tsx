"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export function DrugNetworkBoardConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pending = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted">{description}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={danger ? "outline" : "accent"}
              onClick={onConfirm}
              disabled={pending}
              className={danger ? "border-critical text-critical hover:bg-critical/5" : undefined}
            >
              {confirmLabel}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
