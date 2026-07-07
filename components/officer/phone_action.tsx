/**
 * PhoneAction (Phase 23A — Officer Profile Workspace, Section 1).
 *
 * The Profile Header's phone control: on a pointer-based device (desktop) it
 * copies the number to the clipboard on click; on a touch-primary device
 * (mobile) it opens the OS dialer via a `tel:` link instead. Detection uses
 * the `(pointer: coarse)` media query — a touch screen — rather than screen
 * width, since a mobile browser in "desktop site" mode still has a coarse
 * pointer and should still get the dialer.
 */
"use client";

import { useEffect, useState } from "react";
import { Phone, Copy, Check } from "lucide-react";
import { cn } from "@/lib/ui/cn";

/** Reads the current coarse-pointer (touch) state. SSR-safe: `window` is absent during server rendering. */
function readIsTouch(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export function PhoneAction({ phone, className }: { phone: string; className?: string }) {
  const [isTouch, setIsTouch] = useState(readIsTouch);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (isTouch) {
    return (
      <a
        href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-sm text-foreground hover:bg-neutral-bg",
          className
        )}
      >
        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
        {phone}
      </a>
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or unavailable — silently no-op, the
      // number is still visibly displayed for manual copy.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-sm text-foreground hover:bg-neutral-bg",
        className
      )}
      aria-label={`Copy phone number ${phone}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-good" aria-hidden="true" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          {phone}
        </>
      )}
    </button>
  );
}
