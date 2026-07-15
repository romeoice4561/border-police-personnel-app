/**
 * ProfileActionsCard (Phase 21A — Editable Profile Foundation, Part 11;
 * Phase 23A — Edit Profile enabled, Section 7).
 *
 * The right-rail actions card. "Edit Profile" now enters the workspace's
 * global Edit Mode (Section 7 — one button for the whole page). Upload
 * Portrait/GP7/Manage Documents/Manage Achievements remain disabled — they
 * are explicitly out of scope for this phase (Section 10: "No GP7. No
 * Achievement." / Part 4/5 upload architecture only).
 */
"use client";

import type { ComponentType, SVGProps } from "react";
import { Pencil, ImageUp, FileUp, FolderCog, Trophy } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

interface DisabledAction {
  id: string;
  labelKey: TranslationKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const DISABLED_ACTIONS: DisabledAction[] = [
  { id: "uploadPortrait", labelKey: "officer.uploadPortrait", icon: ImageUp },
  { id: "uploadGp7", labelKey: "officer.uploadGp7", icon: FileUp },
  { id: "manageDocuments", labelKey: "officer.manageDocuments", icon: FolderCog },
  { id: "manageAchievements", labelKey: "officer.manageAchievements", icon: Trophy },
];

export interface ProfileActionsCardProps {
  editing: boolean;
  onEditProfile: () => void;
}

export function ProfileActionsCard({ editing, onEditProfile }: ProfileActionsCardProps) {
  const { t } = useT();
  const reason = t("officer.availableFuture");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("officer.actions")}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          disabled={editing}
          onClick={onEditProfile}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t("officer.editProfile")}
        </Button>

        {DISABLED_ACTIONS.map(({ id, labelKey, icon: Icon }) => {
          const label = t(labelKey);
          return (
            <Tooltip key={id} label={reason} className="block w-full">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled
                aria-label={`${label} (${reason})`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {/* Phase 23B bug #7: explicit Coming Soon so a disabled action never reads as a dead click. */}
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted">{t("officer.comingSoon")}</span>
              </Button>
            </Tooltip>
          );
        })}
      </CardBody>
    </Card>
  );
}
