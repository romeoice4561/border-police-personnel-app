/**
 * C-INTEL product mark — the system brand (not the Border Patrol Police emblem).
 *
 * Official BPP identity stays on BppisLogo. This mark is for product chrome:
 * login, sidebar, compact header, loading, and PWA install.
 *
 * Intrinsic 1254×1254. Callers size the wrapper; never crop the square mark.
 */
"use client";

import Image from "next/image";
import { cn } from "@/lib/ui/cn";

export function CIntelLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/assets/branding/c-intel-logo.png"
      alt="C-INTEL"
      width={1254}
      height={1254}
      priority={priority}
      sizes="(max-width: 640px) 160px, 200px"
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
