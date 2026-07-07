/**
 * ProfileActionsCard (Phase 21A — Editable Profile Foundation, Part 11).
 *
 * The right-rail actions card: Edit Profile, Upload Portrait, Upload GP7,
 * Manage Documents, Manage Achievements. Every action is disabled in this
 * phase (no edit mode, no upload) with a tooltip explaining why.
 */
import type { ComponentType, SVGProps } from "react";
import { Pencil, ImageUp, FileUp, FolderCog, Trophy } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

const REASON = "Available in a future update";

interface ProfileAction {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const ACTIONS: ProfileAction[] = [
  { id: "editProfile", label: "Edit Profile", icon: Pencil },
  { id: "uploadPortrait", label: "Upload Portrait", icon: ImageUp },
  { id: "uploadGp7", label: "Upload GP7", icon: FileUp },
  { id: "manageDocuments", label: "Manage Documents", icon: FolderCog },
  { id: "manageAchievements", label: "Manage Achievements", icon: Trophy },
];

export function ProfileActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {ACTIONS.map(({ id, label, icon: Icon }) => (
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
