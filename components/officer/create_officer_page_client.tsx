/**
 * Create Personnel page client shell (Phase XX.1).
 *
 * Gates `officers.create` and renders the canonical OfficerWorkspace in
 * create mode — same layout as `/officers/[id]`, not a second profile UI.
 */
"use client";

import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { OfficersBackLink } from "@/components/officer/officers_back_link";
import { OfficerWorkspace, type OfficerWorkspaceProps } from "@/components/officer/officer_workspace";

export function CreateOfficerPageClient(props: Omit<OfficerWorkspaceProps, "mode">) {
  const { can } = useAuth();
  const { t } = useT();

  if (!can("officers.create")) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-muted">{t("manualEntry.noPermission")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OfficersBackLink />
      <OfficerWorkspace {...props} mode="create" />
    </div>
  );
}
