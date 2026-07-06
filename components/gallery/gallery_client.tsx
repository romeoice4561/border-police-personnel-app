/**
 * GalleryClient (Phase 19D).
 *
 * Top-level client component for the Gallery feature. Manages view state:
 *   - "home"    → GalleryHome (category cards with counts)
 *   - "browser" → GalleryBrowser (filters + grid for a selected category)
 *
 * All data fetching is delegated to the child components via React Query hooks.
 * This component owns only the routing between the two views.
 */
"use client";

import { useState } from "react";
import { Images } from "lucide-react";
import type { AssetCategory } from "@/lib/gallery/asset_category";
import { PageHeader } from "@/components/common/page_header";
import { GalleryHome } from "@/components/gallery/gallery_home";
import { GalleryBrowser } from "@/components/gallery/gallery_browser";

type GalleryView = { kind: "home" } | { kind: "browser"; category: AssetCategory };

export function GalleryClient() {
  const [view, setView] = useState<GalleryView>({ kind: "home" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="คลังรูปภาพ"
        description="เรียกดูแผนที่ แผนผังโครงสร้าง แผนผังการวางกำลัง และข้อมูลภาพถ่าย"
        actions={
          view.kind === "browser" ? undefined : (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Images className="h-4 w-4" aria-hidden="true" />
              คลังข้อมูลภาพ
            </span>
          )
        }
      />

      {view.kind === "home" ? (
        <GalleryHome
          onSelectCategory={(category) => setView({ kind: "browser", category })}
        />
      ) : (
        <GalleryBrowser
          category={view.category}
          onBack={() => setView({ kind: "home" })}
        />
      )}
    </div>
  );
}
