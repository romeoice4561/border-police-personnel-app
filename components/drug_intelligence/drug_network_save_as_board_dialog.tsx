"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, inputCls } from "@/components/drug_intelligence/create_case_field";
import { useT } from "@/components/i18n/language_provider";

export function DrugNetworkSaveAsBoardDialog({
  defaultTitle,
  pending = false,
  titleKey = "di.board.saveAsTitle",
  confirmKey = "di.board.saveAs",
  onConfirm,
  onCancel,
}: {
  open?: boolean;
  defaultTitle: string;
  pending?: boolean;
  titleKey?: "di.board.saveAsTitle" | "di.board.renameTitle";
  confirmKey?: "di.board.saveAs" | "di.board.rename" | "common.save";
  onConfirm: (input: { title: string; description: string }) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");

  const trimmed = title.trim();

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardBody className="space-y-4">
          <p className="text-base font-semibold text-foreground">{t(titleKey)}</p>
          <Field label={t("di.board.titleLabel")} htmlFor="di-board-title" required>
            <input
              id="di-board-title"
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              autoFocus
            />
          </Field>
          {titleKey === "di.board.saveAsTitle" ? (
            <Field label={t("di.board.descriptionLabel")} htmlFor="di-board-description">
              <textarea
                id="di-board-description"
                className={`${inputCls} min-h-24 resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
              />
            </Field>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => onConfirm({ title: trimmed, description: description.trim() })}
              disabled={pending || trimmed.length === 0}
            >
              {pending ? t("di.board.saving") : t(confirmKey)}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
