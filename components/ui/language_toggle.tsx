/**
 * LanguageToggle — the single, app-wide TH | EN switch (Phase 43).
 *
 * Functional (no longer a placeholder): reads and sets the active language via
 * the global LanguageProvider, so it works identically wherever it's mounted.
 * It lives in the shared AppShell (Part 6 — one switch for the whole app), so
 * there is never more than one language switch on screen.
 *
 * Accessibility (Part 10): a labelled radiogroup of real buttons; the active
 * language is `aria-checked`, every option is keyboard-focusable with a visible
 * focus ring, and the active option is clearly indicated (filled) — not by
 * color alone (it's also the checked radio).
 */
"use client";

import { LANGUAGES, type Language } from "@/lib/i18n/dictionary";
import { useLanguage } from "@/components/i18n/language_provider";
import { cn } from "@/lib/ui/cn";

const OPTION_LABEL: Record<Language, string> = { th: "TH", en: "EN" };
const OPTION_TITLE: Record<Language, string> = { th: "ภาษาไทย", en: "English" };

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label="เลือกภาษา / Language"
      className="inline-flex items-center overflow-hidden rounded-lg border border-border text-xs font-medium"
    >
      {LANGUAGES.map((code) => {
        const isActive = code === language;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={OPTION_TITLE[code]}
            onClick={() => setLanguage(code)}
            className={cn(
              "px-2.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
              isActive ? "bg-accent text-accent-fg" : "text-muted hover:bg-neutral-bg hover:text-foreground"
            )}
          >
            {OPTION_LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}
