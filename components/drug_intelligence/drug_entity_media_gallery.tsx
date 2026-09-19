"use client";

import { useState } from "react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import {
  useDeleteDrugEntityMedia,
  useDrugEntityMedia,
  useUpdateDrugEntityMedia,
  useUploadDrugEntityMedia,
} from "@/lib/drug_intelligence/drug_intelligence_hooks";
import {
  DRUG_ENTITY_MEDIA_CATEGORIES,
  defaultMediaCategory,
  type DrugEntityMediaEntityType,
} from "@/lib/drug_intelligence/drug_entity_media_types";
import type { DrugEntityMediaRecord } from "@/lib/drug_intelligence/drug_intelligence_client";
import { cn } from "@/lib/ui/cn";

export const ENTITY_MEDIA_CATEGORY_KEY: Record<string, `di.media.cat.${string}`> = {
  PROFILE: "di.media.cat.PROFILE",
  ARREST: "di.media.cat.ARREST",
  DOCUMENT: "di.media.cat.DOCUMENT",
  SURVEILLANCE: "di.media.cat.SURVEILLANCE",
  SOCIAL_MEDIA: "di.media.cat.SOCIAL_MEDIA",
  OTHER: "di.media.cat.OTHER",
  FRONT: "di.media.cat.FRONT",
  REAR: "di.media.cat.REAR",
  LEFT: "di.media.cat.LEFT",
  RIGHT: "di.media.cat.RIGHT",
  LICENSE_PLATE: "di.media.cat.LICENSE_PLATE",
  INTERIOR: "di.media.cat.INTERIOR",
  IDENTIFYING_MARK: "di.media.cat.IDENTIFYING_MARK",
  ARREST_SCENE: "di.media.cat.ARREST_SCENE",
  SEIZED_ITEM: "di.media.cat.SEIZED_ITEM",
  OPERATION: "di.media.cat.OPERATION",
  EVIDENCE: "di.media.cat.EVIDENCE",
  BUILDING: "di.media.cat.BUILDING",
  HOUSE: "di.media.cat.HOUSE",
  ENTRANCE: "di.media.cat.ENTRANCE",
  SURROUNDING: "di.media.cat.SURROUNDING",
  MAP_REFERENCE: "di.media.cat.MAP_REFERENCE",
  PACKAGING: "di.media.cat.PACKAGING",
  RELATED_OBJECT: "di.media.cat.RELATED_OBJECT",
  DEVICE: "di.media.cat.DEVICE",
  IDENTIFIER: "di.media.cat.IDENTIFIER",
};

export function DrugEntityMediaGallery({
  entityType,
  entityId,
  sourceCaseId,
}: {
  entityType: DrugEntityMediaEntityType;
  entityId: string;
  sourceCaseId?: string;
}) {
  const { user, can } = useAuth();
  const { t, language } = useT();
  const canEdit = can("drug.edit");
  const media = useDrugEntityMedia(user?.id ?? null, entityType, entityId);
  const upload = useUploadDrugEntityMedia(user?.id ?? null, user?.displayName ?? "Analyst");
  const update = useUpdateDrugEntityMedia(user?.id ?? null, user?.displayName ?? "Analyst");
  const remove = useDeleteDrugEntityMedia(user?.id ?? null, user?.displayName ?? "Analyst");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [category, setCategory] = useState(defaultMediaCategory(entityType));
  const items = media.data?.items ?? [];
  const categories = DRUG_ENTITY_MEDIA_CATEGORIES[entityType];

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setProgress(t("di.media.uploading").replace("{count}", String(files.length)));
    try {
      await upload.mutateAsync({
        entityType,
        entityId,
        files: Array.from(files),
        category,
        sourceCaseId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("di.media.uploadFailed"));
    } finally {
      setProgress(null);
    }
  }

  const viewer = viewerIndex != null ? items[viewerIndex] ?? null : null;

  return (
    <section id="media" className="space-y-1.5" data-testid="drug-entity-media">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t("di.media.title")}</h2>
          <p className="text-xs text-muted">{t("di.media.count").replace("{count}", String(items.length))}</p>
        </div>
        {progress ? <p className="text-xs text-muted">{progress}</p> : null}
        {error ? <p className="text-xs text-critical">{error}</p> : null}
      </div>

      {items.length === 0 && !canEdit ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-2.5 py-1.5 text-xs text-muted">{t("di.media.empty")}</p>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="drug-entity-media-strip">
          {items.slice(0, 8).map((item, index) => (
            <div key={item.id} className="group relative shrink-0">
              <button
                type="button"
                className="relative block h-[76px] w-[76px] overflow-hidden rounded-lg border border-border bg-neutral-bg shadow-sm"
                onClick={() => setViewerIndex(index)}
                aria-label={t((ENTITY_MEDIA_CATEGORY_KEY[item.category] ?? "di.media.cat.OTHER") as "di.media.cat.OTHER")}
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
                  <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-fg shadow-sm">
                    <Star className="h-2.5 w-2.5" aria-hidden="true" />
                    {t("di.media.primary")}
                  </span>
                ) : null}
              </button>
              {canEdit ? (
                <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  {!item.isPrimary ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 rounded-md bg-surface/90 p-0 text-[10px] shadow-sm"
                      onClick={() => update.mutate({ mediaId: item.id, entityType, entityId, isPrimary: true })}
                      aria-label={t("di.media.setPrimary")}
                    >
                      <Star className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 rounded-md bg-surface/90 p-0 text-[10px] shadow-sm"
                    onClick={() => {
                      if (window.confirm(t("di.media.deleteConfirm"))) {
                        remove.mutate({ mediaId: item.id, entityType, entityId });
                      }
                    }}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {items.length > 8 ? (
            <button
              type="button"
              className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-neutral-bg text-sm font-semibold text-muted"
              onClick={() => setViewerIndex(8)}
            >
              {t("di.media.stripOverflow").replace("{count}", String(items.length - 8))}
            </button>
          ) : null}
          {canEdit ? (
            <details className="relative shrink-0">
              <summary className="flex h-[76px] w-[76px] cursor-pointer list-none flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border bg-neutral-bg/60 text-[11px] font-medium text-muted marker:content-none hover:border-accent/40 hover:text-accent [&::-webkit-details-marker]:hidden">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("di.media.add")}
              </summary>
              <div className="absolute left-0 z-20 mt-1 w-56 space-y-2 rounded-lg border border-border bg-surface p-2 shadow-lg">
                <label className="block text-[11px] font-medium text-muted" htmlFor={`media-category-${entityId}`}>
                  {t("di.media.category")}
                </label>
                <select
                  id={`media-category-${entityId}`}
                  className="h-9 w-full rounded-lg border border-border bg-neutral-bg px-2 text-xs text-foreground"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  aria-label={t("di.media.category")}
                >
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {t((ENTITY_MEDIA_CATEGORY_KEY[value] ?? "di.media.cat.OTHER") as "di.media.cat.OTHER")}
                    </option>
                  ))}
                </select>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-foreground hover:bg-neutral-bg">
                  <ImagePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("di.media.chooseFile")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      void onFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-foreground hover:bg-neutral-bg">
                  <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("di.media.camera")}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => {
                      void onFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </details>
          ) : null}
          {items.length === 0 && canEdit ? (
            <p className="shrink-0 self-center text-xs text-muted">{t("di.media.empty")}</p>
          ) : null}
        </div>
      )}

      {viewer ? (
        <MediaLightbox
          items={items}
          index={viewerIndex!}
          onClose={() => setViewerIndex(null)}
          onIndex={setViewerIndex}
        />
      ) : null}
    </section>
  );
}

function MediaLightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: DrugEntityMediaRecord[];
  index: number;
  onClose: () => void;
  onIndex: (index: number) => void;
}) {
  const { t, language } = useT();
  const item = items[index];
  const prev = () => onIndex((index - 1 + items.length) % items.length);
  const next = () => onIndex((index + 1) % items.length);
  const categoryLabel = t((ENTITY_MEDIA_CATEGORY_KEY[item.category] ?? "di.media.cat.OTHER") as "di.media.cat.OTHER");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3 text-white" role="dialog" aria-modal="true">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{item.caption || categoryLabel}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-white">
          <X className="h-4 w-4" aria-hidden="true" />
          {t("common.close")}
        </Button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {items.length > 1 ? (
          <button type="button" className="absolute left-1 rounded-full bg-black/40 p-2" onClick={prev} aria-label={t("di.media.prev")}>
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url ?? item.thumbnailUrl ?? ""} alt="" className={cn("max-h-full max-w-full object-contain")} />
        {items.length > 1 ? (
          <button type="button" className="absolute right-1 rounded-full bg-black/40 p-2" onClick={next} aria-label={t("di.media.next")}>
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/80">
        <div>
          <dt>{t("di.media.category")}</dt>
          <dd>{categoryLabel}</dd>
        </div>
        <div>
          <dt>{t("di.media.uploadedAt")}</dt>
          <dd>{new Date(item.createdAt).toLocaleString(language === "th" ? "th-TH" : "en-US")}</dd>
        </div>
        {item.sourceCaseId ? (
          <div>
            <dt>{t("di.media.sourceCase")}</dt>
            <dd>{item.sourceCaseId}</dd>
          </div>
        ) : null}
        {item.capturedAt ? (
          <div>
            <dt>{t("di.media.capturedAt")}</dt>
            <dd>{new Date(item.capturedAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US")}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
