/**
 * AppearanceSwitcher (Phase 48A.1 — Real Theme System).
 *
 * The visible control for changing the active theme — mounted in AppShell's
 * top bar next to LanguageToggle/UserMenu, on both desktop and mobile. A
 * dropdown disclosure (four options don't fit a compact toggle row the way
 * the two-option LanguageToggle does), built with the exact same open/close/
 * outside-click/Escape interaction pattern as UserMenu, so it behaves
 * identically to the other header controls.
 *
 * Selecting a theme calls ThemeProvider's setTheme(), which persists to
 * localStorage and updates `data-theme` on <html> immediately (no reload,
 * no flash — the bootstrap script in app/layout.tsx only matters for the
 * FIRST paint of a fresh page load).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check, ChevronDown } from "lucide-react";
import { useTheme } from "@/components/theme/theme_provider";
import { useT } from "@/components/i18n/language_provider";
import { THEMES, THEME_LABELS } from "@/lib/theme/theme_config";
import { cn } from "@/lib/ui/cn";

/** A small swatch previewing each theme's background/accent, so the option is recognizable at a glance, not just by name. */
const THEME_SWATCH: Record<(typeof THEMES)[number], { bg: string; accent: string }> = {
  "navy-command": { bg: "#0b1120", accent: "#3b82f6" },
  "border-patrol-green": { bg: "#10241a", accent: "#c8a24a" },
  "classic-white": { bg: "#f5f6f7", accent: "#14509e" },
  "midnight-black": { bg: "#0a0a0b", accent: "#d98a3d" },
};

export function AppearanceSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t, language } = useT();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("appearance.switcher")}
        title={t("appearance.switcher")}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-muted transition-colors hover:bg-neutral-bg hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Palette className="h-4 w-4" aria-hidden="true" />
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open ? (
        <div role="menu" aria-label={t("appearance.selectTheme")} className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <p className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{t("appearance.selectTheme")}</p>
          {THEMES.map((id) => {
            const isActive = id === theme;
            const swatch = THEME_SWATCH[id];
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setTheme(id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-neutral-bg focus:outline-none focus-visible:bg-neutral-bg",
                  isActive ? "font-semibold text-foreground" : "text-foreground"
                )}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border"
                  style={{ backgroundColor: swatch.bg }}
                  aria-hidden="true"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch.accent }} />
                </span>
                <span className="min-w-0 flex-1 truncate">{THEME_LABELS[id][language]}</span>
                {isActive ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
