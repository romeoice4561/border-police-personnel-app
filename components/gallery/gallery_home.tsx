/**
 * GalleryHome (Phase 19D).
 *
 * The Gallery landing screen: a grid of category cards, each showing the
 * category title, icon, and asset count. Clicking a card navigates to the
 * GalleryBrowser for that category. Uses useGalleryCategories() for the
 * counts; always displays all GALLERY_CATEGORIES so the grid is stable
 * even when a category has zero assets.
 */
"use client";

import type { LucideIcon } from "lucide-react";
import { Map, Network, Navigation, Building2, Landmark, FolderOpen } from "lucide-react";
import { AssetCategory, ASSET_CATEGORY_LABELS, GALLERY_CATEGORIES } from "@/lib/gallery/asset_category";
import type { AssetCategoryCount } from "@/lib/gallery/asset_types";
import { useGalleryCategories } from "@/lib/gallery/gallery_hooks";
import { Skeleton } from "@/components/common/states";
import { ErrorState } from "@/components/common/states";

const CATEGORY_META: Record<AssetCategory, { icon: LucideIcon; color: string }> = {
  [AssetCategory.NeighborMap]: { icon: Map, color: "text-accent" },
  [AssetCategory.OrgChart]: { icon: Network, color: "text-good" },
  [AssetCategory.DeploymentMap]: { icon: Navigation, color: "text-warning" },
  [AssetCategory.CompanyLocation]: { icon: Building2, color: "text-serious" },
  [AssetCategory.BattalionLocation]: { icon: Landmark, color: "text-neutral" },
  [AssetCategory.Unknown]: { icon: FolderOpen, color: "text-muted" },
  [AssetCategory.Profile]: { icon: FolderOpen, color: "text-muted" },
};

interface GalleryHomeProps {
  onSelectCategory: (category: AssetCategory) => void;
}

export function GalleryHome({ onSelectCategory }: GalleryHomeProps) {
  const { data: counts, isPending, isError, error, refetch } = useGalleryCategories();

  if (isError) {
    return (
      <ErrorState
        message={(error as Error).message}
        onRetry={() => refetch()}
      />
    );
  }

  // Build a lookup from the API response (categories that have assets).
  const countLookup = Object.fromEntries(
    (counts ?? []).map((c: AssetCategoryCount) => [c.category, c.count])
  ) as Partial<Record<AssetCategory, number>>;

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Gallery categories"
    >
      {GALLERY_CATEGORIES.map((category) => {
        const meta = CATEGORY_META[category];
        const Icon = meta.icon;
        const count = countLookup[category] ?? 0;
        const label = ASSET_CATEGORY_LABELS[category];

        if (isPending) {
          return (
            <Skeleton key={category} className="h-32 w-full rounded-xl" />
          );
        }

        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelectCategory(category)}
            className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 text-left shadow-sm transition-all hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`${label} — ${count} assets`}
          >
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-bg ${meta.color}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-accent">
                {label}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {count === 1 ? "1 asset" : `${count} assets`}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
