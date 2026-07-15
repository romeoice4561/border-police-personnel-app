/**
 * BppisLogo — the official Border Patrol Police mark (Phase 46A).
 *
 * Renders the official logo from public/assets/logo/bpp-logo.png via
 * next/image, preserving transparency and aspect ratio (never cropped). The
 * component NAME and the `className` prop are unchanged from the Phase 46
 * placeholder so callers don't change — only the implementation swapped from an
 * inline SVG to the real PNG.
 *
 * Sizing: intrinsic dimensions are supplied for correct layout/aspect; the
 * displayed width is controlled by the caller's wrapper (the login screen uses
 * ~160px, centered, responsive). `priority` so it's not lazy-loaded on the
 * login screen.
 */
"use client";

import Image from "next/image";
import { cn } from "@/lib/ui/cn";

export function BppisLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/assets/logo/bpp-logo.png"
      alt="Border Patrol Police"
      width={4759}
      height={4401}
      priority
      sizes="(max-width: 640px) 140px, 160px"
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
