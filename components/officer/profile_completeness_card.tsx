/**
 * ProfileCompletenessCard (Phase 21A — Editable Profile Foundation).
 *
 * Shows the overall completeness percentage (derived purely from persisted
 * data via computeProfileCompleteness) plus the itemized checklist. Fields
 * with no backing data source yet (Contact, Education, Training, Awards,
 * Documents, GP7) always render unchecked — this card never invents progress.
 */
import { Check, Square } from "lucide-react";
import type { OfficerWithRelations } from "@/lib/database/query_types";
import { computeProfileCompleteness } from "@/lib/ui/profile_completeness";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/ui/cn";

export function ProfileCompletenessCard({ officer }: { officer: OfficerWithRelations }) {
  const { percent, items } = computeProfileCompleteness(officer);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Completeness</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completeness"
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-bg"
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              {item.complete ? (
                <Check className="h-4 w-4 shrink-0 text-good" aria-hidden="true" />
              ) : (
                <Square className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              )}
              <span className={cn(item.complete ? "text-foreground" : "text-muted")}>{item.label}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
