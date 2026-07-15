/**
 * BilingualLabel (Phase 26B Part 5 Part K; Phase 43 — runtime language-aware).
 *
 * Renders a field label in the ACTIVE language. This is the single place the
 * label-rendering rule lives, so every form field that passes a BilingualText
 * (or a FIELD_LABELS entry) switches with the global language toggle without
 * any call-site change. Before the provider mounts (or outside it — e.g. an
 * isolated render), `useBilingualText()` falls back to the default language,
 * so this is SSR- and test-safe.
 *
 * Accepts either a BilingualText object or a FIELD_LABELS key, so callers can
 * pass `label={FIELD_LABELS.dateOfBirth}` directly.
 */
"use client";

import type { BilingualText } from "@/lib/i18n/bilingual_label";
import { useBilingualText } from "@/components/i18n/language_provider";

export interface BilingualLabelProps {
  text: BilingualText;
  htmlFor?: string;
  className?: string;
}

export function BilingualLabel({ text, htmlFor, className }: BilingualLabelProps) {
  const render = useBilingualText();
  return (
    <label className={className ?? "mb-1.5 block text-xs font-medium text-muted"} htmlFor={htmlFor}>
      {render(text)}
    </label>
  );
}
