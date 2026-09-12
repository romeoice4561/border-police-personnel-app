/**
 * DI-11D.2 — confirmation overlay for complete/cancel workflow.
 */
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export function DrugInvestigationTaskConfirmDialog({
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
  useEffect(() => {
    if (!open || pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="investigation-task-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="investigation-task-confirm"
    >
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4">
          <p id="investigation-task-confirm-title" className="text-base font-semibold text-foreground">
            {title}
          </p>
          <p className="text-sm text-muted">{description}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending} data-testid="investigation-task-confirm-dismiss">
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={danger ? "outline" : "accent"}
              onClick={onConfirm}
              disabled={pending}
              data-testid="investigation-task-confirm-accept"
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
