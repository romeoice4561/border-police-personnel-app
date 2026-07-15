/**
 * Pagination (Phase 14 UI).
 *
 * Prev/next + page indicator over the API's page meta. Pure presentational —
 * the parent owns the page state and passes onPageChange. Disabled at bounds.
 */
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  const { t } = useT();
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted tabular-nums">
        {from}–{to} {t("common.of")} {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.previous")}
        </Button>
        <span className="text-sm text-muted tabular-nums">
          {t("common.page")} {page} / {Math.max(totalPages, 1)}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          {t("common.next")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
