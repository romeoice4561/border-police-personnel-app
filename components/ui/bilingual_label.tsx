/**
 * BilingualLabel (Phase 26B Part 5 Part K).
 *
 * Renders a field label as "ไทย / English" — the single place this
 * rendering rule lives, so every new/touched form field shares one
 * component instead of each section hand-writing "th / en" text. A future
 * language switcher changes only this component (e.g. show just `text.th`
 * or just `text.en` based on a locale setting), never the call sites.
 *
 * Accepts either a BilingualText object or a FIELD_LABELS key, so callers
 * can pass `label={FIELD_LABELS.dateOfBirth}` directly.
 */
import type { BilingualText } from "@/lib/i18n/bilingual_label";

export interface BilingualLabelProps {
  text: BilingualText;
  htmlFor?: string;
  className?: string;
}

export function BilingualLabel({ text, htmlFor, className }: BilingualLabelProps) {
  return (
    <label className={className ?? "mb-1.5 block text-xs font-medium text-muted"} htmlFor={htmlFor}>
      <span lang="th">{text.th}</span>
      <span className="text-muted/70"> / </span>
      <span lang="en">{text.en}</span>
    </label>
  );
}
