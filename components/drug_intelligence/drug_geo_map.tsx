/**
 * DrugGeoMap (Phase DI-8) — client-only dynamic-import wrapper around
 * DrugGeoMapCanvas. Leaflet reads `window`/`document` at import time, which
 * does not exist during Next.js's server render — `dynamic(..., { ssr:
 * false })` is the standard fix, and (per the architecture audit) this is
 * the FIRST use of that pattern in this codebase; every other heavy
 * interactive library here (e.g. @xyflow/react on the DI-5 Network page)
 * happens to tolerate SSR via a plain "use client" boundary, Leaflet does
 * not.
 */
"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import "@/components/drug_intelligence/drug_geo_marker_popup.css";
import { Loader2 } from "lucide-react";
import type { DrugGeoMapCanvasProps } from "@/components/drug_intelligence/drug_geo_map_canvas";

const DrugGeoMapCanvasNoSSR = dynamic(
  () => import("@/components/drug_intelligence/drug_geo_map_canvas").then((m) => m.DrugGeoMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] min-h-[420px] w-full items-center justify-center rounded-xl border border-border bg-neutral-bg">
        <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden="true" />
      </div>
    ),
  }
);

export function DrugGeoMap(props: DrugGeoMapCanvasProps) {
  return <DrugGeoMapCanvasNoSSR {...props} />;
}
