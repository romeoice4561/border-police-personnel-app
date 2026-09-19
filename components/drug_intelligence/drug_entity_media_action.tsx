/**
 * Compact contextual Entity Media upload control for intelligence cards.
 * Reuses the existing Entity Media API / permissions / storage pipeline.
 */
"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugEntityMedia, useUploadDrugEntityMedia } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import {
  defaultMediaCategory,
  isDrugEntityMediaEntityType,
  type DrugEntityMediaEntityType,
} from "@/lib/drug_intelligence/drug_entity_media_types";
import { cn } from "@/lib/ui/cn";

export function supportsEntityMediaAction(entityType: string): entityType is DrugEntityMediaEntityType {
  return isDrugEntityMediaEntityType(entityType);
}

/** Entity types requested in UX but not present in Entity Media backend. */
export const ENTITY_MEDIA_UNSUPPORTED_TYPES = ["PHONE", "SIM"] as const;

export function DrugEntityMediaAction({
  entityType,
  entityId,
  sourceCaseId,
  className,
  compact = false,
}: {
  entityType: DrugEntityMediaEntityType;
  entityId: string;
  sourceCaseId?: string;
  className?: string;
  compact?: boolean;
}) {
  const { user, can } = useAuth();
  const { t } = useT();
  const canEdit = can("drug.edit");
  const media = useDrugEntityMedia(user?.id ?? null, entityType, entityId);
  const upload = useUploadDrugEntityMedia(user?.id ?? null, user?.displayName ?? "Analyst");
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const count = media.data?.photoCount ?? media.data?.items?.length ?? 0;

  if (!canEdit) {
    return count > 0 ? (
      <span className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-neutral-bg px-1.5 py-0.5 text-[11px] text-muted", className)}>
        <Camera className="h-3 w-3" aria-hidden="true" />
        {count}
      </span>
    ) : null;
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setOk(false);
    try {
      await upload.mutateAsync({
        entityType,
        entityId,
        files: Array.from(files),
        category: defaultMediaCategory(entityType),
        sourceCaseId,
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("di.media.uploadFailed"));
    }
  }

  return (
    <div className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <div className="inline-flex items-center gap-1">
        {count > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-neutral-bg px-1.5 py-0.5 text-[11px] font-medium text-foreground">
            <Camera className="h-3 w-3" aria-hidden="true" />
            {count}
          </span>
        ) : null}
        <button
          type="button"
          className={cn(
            "inline-flex min-h-7 items-center gap-1 rounded-md border border-border bg-surface px-1.5 text-[11px] font-medium text-foreground hover:bg-neutral-bg",
            compact && "px-1",
          )}
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          aria-label={t("di.media.add")}
        >
          {upload.isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-3 w-3" aria-hidden="true" />}
          {compact ? null : t("di.media.add")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          multiple
          onChange={(event) => {
            void onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {error ? <p className="text-[10px] text-critical">{error}</p> : null}
      {ok && !error ? <p className="text-[10px] text-good">{t("di.media.uploadOk")}</p> : null}
    </div>
  );
}
