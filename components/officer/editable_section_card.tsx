/**
 * EditableSectionCard (Phase 21A — Editable Profile Foundation; Phase 23B —
 * clear Coming Soon indicator for not-yet-available sections, bug #7).
 *
 * Generic card shell every profile section is built from. In the Officer
 * Workspace, sections that ARE editable swap to their editor in edit mode and
 * never render this card's header control. Sections that are NOT yet available
 * (Documents, Achievements, Notes) previously showed a DISABLED "Edit" button —
 * which read as a dead/clickable-looking control. Phase 23B: those pass
 * `comingSoon` so the header shows an unambiguous "Coming Soon" badge instead
 * of an Edit button. Presentational only — no state, no forms.
 */
import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export function EditableSectionCard({
  title,
  children,
  className,
  comingSoon = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** When true, shows a "Coming Soon" badge instead of any edit control (Phase 23B, bug #7). */
  comingSoon?: boolean;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {comingSoon ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-border bg-neutral-bg px-2.5 py-1 text-xs font-medium text-muted"
            aria-label={`${title} — เร็ว ๆ นี้`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Coming Soon
          </span>
        ) : null}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/** Shared empty-state row for sections with no data yet (Education, Training, Awards, Achievements, Documents). */
export function SectionEmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted">{message}</p>;
}
