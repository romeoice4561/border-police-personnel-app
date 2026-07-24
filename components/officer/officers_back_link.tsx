/**
 * Localized “Back to officers” control for the Officer Profile page.
 */
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/language_provider";

export function OfficersBackLink() {
  const { t } = useT();
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/officers">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("officer.backToOfficers")}
      </Link>
    </Button>
  );
}
