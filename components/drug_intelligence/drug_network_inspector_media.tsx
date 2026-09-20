/**
 * Compact Entity Media strip for the Network Graph node Inspector.
 * Reuses Entity Media list/upload/delete APIs and permissions — no parallel media stack.
 */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  useDeleteDrugEntityMedia,
  useDrugEntityMedia,
  useUploadDrugEntityMedia,
} from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { supportsEntityMediaAction } from "@/components/drug_intelligence/drug_entity_media_action";
import { DrugNetworkBoardConfirmDialog } from "@/components/drug_intelligence/drug_network_board_confirm_dialog";
import {
  defaultMediaCategory,
  type DrugEntityMediaEntityType,
} from "@/lib/drug_intelligence/drug_entity_media_types";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import { withReturnTo } from "@/lib/ui/return_context";
import { cn } from "@/lib/ui/cn";

const PREVIEW_LIMIT = 4;

export function networkInspectorSupportsEntityMedia(entityType: string): entityType is DrugEntityMediaEntityType {
  return supportsEntityMediaAction(entityType);
}

/** Entity types with a dedicated detail page that hosts `#media`. */
function hasEntityMediaGalleryPage(
  entityType: DrugEntityMediaEntityType,
): entityType is "PERSON" | "VEHICLE" | "CASE" | "DEVICE" {
  return entityType === "PERSON" || entityType === "VEHICLE" || entityType === "CASE" || entityType === "DEVICE";
}

export function DrugNetworkInspectorMedia({
  entityType,
  entityId,
  openReturnPath = null,
  className,
}: {
  entityType: string;
  entityId: string;
  openReturnPath?: string | null;
  className?: string;
}) {
  const { user, can } = useAuth();
  const { t } = useT();
  const canEdit = can("drug.edit");
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const mediaCapable = networkInspectorSupportsEntityMedia(entityType);
  const mediaType = mediaCapable ? entityType : null;
  const media = useDrugEntityMedia(user?.id ?? null, mediaType, mediaCapable ? entityId : null);
  const upload = useUploadDrugEntityMedia(user?.id ?? null, user?.displayName ?? "Analyst");
  const remove = useDeleteDrugEntityMedia(user?.id ?? null, user?.displayName ?? "Analyst");

  if (!mediaCapable) {
    return null;
  }

  const items = media.data?.items ?? [];
  const count = media.data?.photoCount ?? items.length;
  const preview = items.slice(0, PREVIEW_LIMIT);
  const overflow = Math.max(0, count - preview.length);
  const galleryHref = hasEntityMediaGalleryPage(entityType)
    ? withReturnTo(`${drugEntityDetailPath(entityType, entityId)}#media`, openReturnPath)
    : null;
  const busy = upload.isPending || remove.isPending;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setStatusMessage(null);
    try {
      await upload.mutateAsync({
        entityType,
        entityId,
        files: Array.from(files),
        category: defaultMediaCategory(entityType as DrugEntityMediaEntityType),
        setPrimary: count === 0,
      });
      setStatusMessage(t("di.media.uploadOk"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("di.media.uploadFailed"));
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const mediaId = pendingDeleteId;
    setError(null);
    setStatusMessage(null);
    try {
      await remove.mutateAsync({ mediaId, entityType, entityId });
      setPendingDeleteId(null);
      setStatusMessage(t("di.media.deleteOk"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("di.media.deleteFailed"));
      setPendingDeleteId(null);
    }
  }

  return (
    <section
      className={cn("space-y-2 rounded-lg border border-border bg-neutral-bg/40 p-2.5", className)}
      data-testid="network-inspector-media"
      data-entity-type={entityType}
      data-photo-count={String(count)}
      data-can-upload={canEdit ? "true" : "false"}
      data-can-delete={canEdit ? "true" : "false"}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("di.media.title")}</p>
        <p className="text-[11px] text-muted">{t("di.media.allPhotos").replace("{count}", String(count))}</p>
      </div>

      {count === 0 ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="network-inspector-media-empty">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-surface px-2 py-1.5 text-xs text-muted">
            <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("di.media.noneYet")}
          </span>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              data-testid="network-inspector-media-add"
            >
              {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />}
              {t("di.media.add")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2" data-testid="network-inspector-media-strip">
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {preview.map((item) => (
              <div
                key={item.id}
                className="group relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border border-border bg-surface focus-within:ring-2 focus-within:ring-accent"
                data-testid="network-inspector-media-thumb"
                data-media-id={item.id}
                data-is-primary={item.isPrimary ? "true" : "false"}
              >
                {item.thumbnailUrl || item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailUrl ?? item.url ?? ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted">
                    <Camera className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
                {item.isPrimary ? (
                  <span className="absolute left-1 top-1 rounded bg-accent px-1 py-0.5 text-[9px] font-semibold text-accent-fg">
                    {t("di.media.primary")}
                  </span>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className={cn(
                      "absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-surface/95 text-critical shadow-sm",
                      "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 sm:focus-visible:opacity-100",
                      "hover:bg-critical/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    )}
                    aria-label={t("di.media.deleteAction")}
                    data-testid="network-inspector-media-delete"
                    disabled={busy}
                    onClick={() => setPendingDeleteId(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
            {overflow > 0 ? (
              <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface text-xs font-semibold text-muted">
                {t("di.media.stripOverflow").replace("{count}", String(overflow))}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                data-testid="network-inspector-media-add"
              >
                {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />}
                {t("di.media.add")}
              </Button>
            ) : null}
            {galleryHref ? (
              <Button asChild size="sm" variant="ghost" className="h-8" data-testid="network-inspector-media-gallery">
                <Link href={galleryHref}>{t("di.media.openGallery")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {canEdit ? (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          multiple
          data-testid="network-inspector-media-file"
          onChange={(event) => {
            void onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      ) : null}
      {error ? (
        <p className="text-[11px] text-critical" data-testid="network-inspector-media-error">
          {error}
        </p>
      ) : null}
      {statusMessage && !error ? (
        <p className="text-[11px] text-good" data-testid="network-inspector-media-ok">
          {statusMessage}
        </p>
      ) : null}

      <DrugNetworkBoardConfirmDialog
        open={Boolean(pendingDeleteId)}
        title={t("di.media.deleteConfirm")}
        description={t("di.media.deleteBody")}
        confirmLabel={t("di.media.deleteAction")}
        cancelLabel={t("common.cancel")}
        pending={remove.isPending}
        danger
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={() => {
          if (!remove.isPending) setPendingDeleteId(null);
        }}
      />
    </section>
  );
}
