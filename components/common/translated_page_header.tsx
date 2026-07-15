/**
 * TranslatedPageHeader (Phase 43) — a reusable client wrapper that renders a
 * PageHeader whose title/description come from the central dictionary in the
 * active language. Lets Server Component pages show a language-reactive header
 * without introducing a per-page language switch (the single switch lives in
 * the app shell).
 */
"use client";

import { PageHeader } from "@/components/common/page_header";
import { useT } from "@/components/i18n/language_provider";
import type { TranslationKey } from "@/lib/i18n/dictionary";

export function TranslatedPageHeader({
  titleKey,
  descriptionKey,
}: {
  titleKey: TranslationKey;
  descriptionKey?: TranslationKey;
}) {
  const { t } = useT();
  return <PageHeader title={t(titleKey)} description={descriptionKey ? t(descriptionKey) : undefined} />;
}
