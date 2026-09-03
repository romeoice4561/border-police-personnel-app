/**
 * Contextual return link (Phase 2B.2.1).
 *
 * Renders the existing returnTo back action only when a safe inbound
 * `returnTo` is present. Reused on Cases / Persons / Alerts / Duplicates
 * list headers so Commander drill-downs get a discoverable return without
 * injecting the button on ordinary sidebar visits.
 */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";
import { getSafeReturnTo } from "@/lib/ui/return_context";
import { returnToBackLabelKey } from "@/lib/ui/return_to_back_label";

export function DrugContextualReturnLink() {
  const searchParams = useSearchParams();
  const { t } = useT();
  const returnTo = getSafeReturnTo(searchParams);
  if (!returnTo) return null;
  return (
    <Button asChild variant="outline" size="sm" className="min-h-10">
      <Link href={returnTo} data-testid="back-via-return-to">
        {t(returnToBackLabelKey(returnTo))}
      </Link>
    </Button>
  );
}
