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

const REASON = "Available in a future update";

interface DisabledAction {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const DISABLED_ACTIONS: DisabledAction[] = [
  { id: "uploadPortrait", label: "Upload Portrait", icon: ImageUp },
  { id: "uploadGp7", label: "Upload GP7", icon: FileUp },
  { id: "manageDocuments", label: "Manage Documents", icon: FolderCog },
  { id: "manageAchievements", label: "Manage Achievements", icon: Trophy },
];

export interface ProfileActionsCardProps {
  editing: boolean;
  onEditProfile: () => void;
}

export function ProfileActionsCard({ editing, onEditProfile }: ProfileActionsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
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
          แก้ไขข้อมูล
        </Button>

        {DISABLED_ACTIONS.map(({ id, label, icon: Icon }) => (
          <Tooltip key={id} label={REASON} className="block w-full">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              disabled
              aria-label={`${label} (${REASON})`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Button>
          </Tooltip>
        ))}
      </CardBody>
    </Card>
  );
}
