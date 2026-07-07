/**
 * EditableSectionCard (Phase 21A — Editable Profile Foundation).
 *
 * Generic card shell every future-editable profile section (Basic
 * Information, Career, Education, Training, Awards, Contact, Documents,
 * Notes, Achievements) is built from — one place that owns the "Edit" button
 * treatment so every section behaves identically. The Edit button is always
 * disabled in this phase (no edit mode exists yet) and carries a tooltip
 * explaining why, per spec. Presentational only — no state, no forms.
 */
import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

const EDIT_DISABLED_REASON = "Available in a future update";

export function EditableSectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        <Tooltip label={EDIT_DISABLED_REASON}>
          <Button type="button" variant="outline" size="sm" disabled aria-label={`Edit ${title} (${EDIT_DISABLED_REASON})`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Button>
        </Tooltip>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/** Shared empty-state row for sections with no data yet (Education, Training, Awards, Achievements, Documents). */
export function SectionEmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted">{message}</p>;
}
