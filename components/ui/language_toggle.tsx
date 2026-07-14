/**
 * LanguageToggle — TH | EN switch PLACEHOLDER (Phase 41 Part 7).
 *
 * i18n foundation only: Thai is the default and remains active. This control
 * is a visual placeholder that shows the intended TH | EN switch (top-right of
 * Commander Search) but does NOT change the UI language yet — runtime language
 * switching is a later phase. TH is shown as the selected segment; EN is
 * present but disabled, so the architecture and affordance exist without
 * pretending to do something it doesn't. Accessible: a labelled group of
 * buttons with aria-pressed / aria-disabled reflecting the true state.
 */
"use client";

import { DEFAULT_LANGUAGE, type Language } from "@/lib/i18n/labels";

const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "th", label: "TH" },
  { code: "en", label: "EN" },
];

export function LanguageToggle() {
  const active = DEFAULT_LANGUAGE;
  return (
    <div
      role="group"
      aria-label="เลือกภาษา / Language (placeholder — Thai only for now)"
      className="inline-flex items-center overflow-hidden rounded-lg border border-border text-xs font-medium"
    >
      {LANGUAGES.map((lang) => {
        const isActive = lang.code === active;
        return (
          <button
            key={lang.code}
            type="button"
            aria-pressed={isActive}
            aria-disabled={!isActive}
            disabled={!isActive}
            title={isActive ? "ภาษาไทย (ค่าเริ่มต้น)" : "English — coming soon"}
            className={
              isActive
                ? "bg-accent px-2.5 py-1 text-white"
                : "cursor-not-allowed px-2.5 py-1 text-muted"
            }
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
