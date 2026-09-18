"use client";

import { useState } from "react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
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

const CATEGORY_KEY: Record<string, `di.media.cat.${string}`> = {
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
  compactHero = false,
}: {
  entityType: DrugEntityMediaEntityType;
  entityId: string;
  sourceCaseId?: string;
  compactHero?: boolean;
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
  const primary = items.find((item) => item.isPrimary) ?? null;
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
    <section id="media" className="space-y-3" data-testid="drug-entity-media">
      {compactHero ? (
        <button
          type="button"
          className="block"
          onClick={() => setViewerIndex(primary ? items.findIndex((item) => item.id === primary.id) : 0)}
          aria-label={t("di.media.openGallery")}
        >
          <DrugEntityVisualThumb
            entityType={entityType}
            label={t("di.media.primary")}
            thumbnailUrl={primary?.thumbnailUrl ?? primary?.url}
            size="lg"
          />
        </button>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("di.media.title")}</h2>
          <p className="text-xs text-muted">{t("di.media.count").replace("{count}", String(items.length))}</p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label={t("di.media.category")}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {t((CATEGORY_KEY[value] ?? "di.media.cat.OTHER") as "di.media.cat.OTHER")}
                </option>
              ))}
            </select>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {t("di.media.add")}
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
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground">
              <Camera className="h-4 w-4" aria-hidden="true" />
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
        ) : null}
      </div>

      {progress ? <p className="text-xs text-muted">{progress}</p> : null}
      {error ? <p className="text-xs text-critical">{error}</p> : null}

      {items.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-muted">{t("di.media.empty")}</CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, index) => (
            <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <button type="button" className="block w-full" onClick={() => setViewerIndex(index)}>
                <div className="relative aspect-square bg-neutral-bg">
                  {item.thumbnailUrl || item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl ?? item.url ?? ""} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  {item.isPrimary ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-surface">
                      {t("di.media.primary")}
                    </span>
                  ) : null}
                </div>
              </button>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium text-foreground">
                  {t((CATEGORY_KEY[item.category] ?? "di.media.cat.OTHER") as "di.media.cat.OTHER")}
                </p>
                {item.caption ? <p className="truncate text-[11px] text-muted">{item.caption}</p> : null}
                <p className="text-[10px] text-muted">
                  {new Date(item.createdAt).toLocaleDateString(language === "th" ? "th-TH" : "en-US")}
                </p>
                {canEdit ? (
                  <div className="flex flex-wrap gap-1">
                    {!item.isPrimary ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => update.mutate({ mediaId: item.id, entityType, entityId, isPrimary: true })}
                      >
                        <Star className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("di.media.setPrimary")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(t("di.media.deleteConfirm"))) {
                          remove.mutate({ mediaId: item.id, entityType, entityId });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("common.delete")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
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
  const categoryLabel = t((CATEGORY_KEY[item.category] ?? "di.media.cat.OTHER") as "di.media.cat.OTHER");

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
