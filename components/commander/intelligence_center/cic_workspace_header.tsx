/**
 * CicWorkspaceHeader (Phase 49B — Commander Intelligence Center).
 *
 * Thin client wrapper resolving title/subtitle/breadcrumb copy in the
 * active language, then handing them to the generic (i18n-free)
 * WorkspaceHeader — same pattern as DashboardWorkspaceHeader.
 */
"use client";

import { WorkspaceHeader } from "@/components/workspace/workspace_header";
import { useT } from "@/components/i18n/language_provider";

export function CicWorkspaceHeader() {
  const { t } = useT();
  return (
    <WorkspaceHeader
      title={t("cic.title")}
      subtitle={t("cic.subtitle")}
      breadcrumb={[
        { label: t("dashboard.breadcrumbHome"), href: "/dashboard" },
        { label: t("cic.title") },
      ]}
    />
  );
}
