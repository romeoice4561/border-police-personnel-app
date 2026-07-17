/**
 * BppisLogo — the official Border Patrol Police mark (Phase 46A; Phase
 * 48A.1 reused, unmodified, in the sidebar/mobile header brand areas;
 * Phase 48A.2 — canonical source moved to public/assets/branding/).
 *
 * Renders the official logo from public/assets/branding/bppis-logo.png (the
 * single canonical branding source — the old public/assets/logo/bpp-logo.png
 * has been removed) via next/image, preserving transparency and aspect ratio
 * (never cropped). The component NAME and the `className` prop are unchanged
 * since Phase 46 so callers don't change — only the source path moved. ONE
 * component, reused everywhere the official mark appears (login screen,
 * sidebar, mobile top bar) — never duplicated.
 *
 * Sizing: intrinsic dimensions are supplied for correct layout/aspect; the
 * displayed width is controlled by the caller's wrapper.
 *
 * `priority` defaults to `false` (Phase 48A.1): the sidebar mounts TWO
 * instances simultaneously (desktop sidebar + mobile top bar, one hidden via
 * CSS depending on viewport) — marking both `priority` would fight over LCP
 * priority for a small, non-hero mark. The login screen explicitly passes
 * `priority` since the logo IS its largest above-the-fold element there.
 */
"use client";

import Image from "next/image";
import { cn } from "@/lib/ui/cn";

export function BppisLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/assets/branding/bppis-logo.png"
      alt="Border Patrol Police"
      width={4759}
      height={4401}
      priority={priority}
      sizes="(max-width: 640px) 140px, 160px"
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
