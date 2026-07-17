/**
 * DashboardWorkspaceHeader (Phase 48A — Enterprise Workspace Foundation,
 * Dashboard reference implementation).
 *
 * A thin client wrapper resolving the Dashboard's title/subtitle/breadcrumb/
 * last-updated copy from the dictionary in the active language, then handing
 * them to the generic (i18n-free) WorkspaceHeader — same pattern as
 * TranslatedPageHeader wrapping PageHeader, so a Server Component page can
 * still show a language-reactive header without its own language switch.
 */
"use client";

import { useMemo } from "react";
import { Radio } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace/workspace_header";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language_provider";
import type { Language } from "@/lib/i18n/dictionary";

/** The current moment, formatted for the active language (Buddhist-era Thai vs. Gregorian English), as a plain wall-clock "last updated" label — this page is `force-dynamic`, so "now" IS the data's freshness. */
function useNowLabel(language: Language): string {
  return useMemo(() => {
    const now = new Date();
    return new Intl.DateTimeFormat(language === "th" ? "th-TH-u-ca-buddhist" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);
  }, [language]);
}

export function DashboardWorkspaceHeader() {
  const { t, language } = useT();
  const lastUpdated = useNowLabel(language);
  return (
    <WorkspaceHeader
      title={t("dashboard.commanderDashboard")}
      subtitle={t("dashboard.subtitle")}
      breadcrumb={[
        { label: t("dashboard.breadcrumbHome"), href: "/dashboard" },
        { label: t("dashboard.commanderDashboard") },
      ]}
      lastUpdatedLabel={`${t("dashboard.lastUpdated")}: ${lastUpdated}`}
      statusBadge={
        <Badge tone="good" className="gap-1">
          <Radio className="h-3 w-3" aria-hidden="true" />
          {t("dashboard.liveStatus")}
        </Badge>
      }
    />
  );
}
