"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DrugEntityVisualThumb } from "@/components/drug_intelligence/drug_entity_visual_thumb";
import { useAuth } from "@/components/auth/auth_provider";
import { useT } from "@/components/i18n/language_provider";
import { useDrugEntityMedia } from "@/lib/drug_intelligence/drug_intelligence_hooks";
import { presentIdentifierValue } from "@/lib/drug_intelligence/drug_sensitive_presentation";
import {
  DRUG_PERSON_IDENTIFIER_TYPE_LABELS,
  isValidDrugPersonIdentifierType,
} from "@/lib/drug_intelligence/drug_person_options";
import type { DrugPersonAliasRow, DrugPersonIdentifierRow } from "@/lib/drug_intelligence/drug_intelligence_client";

function identifierTypeLabel(type: string, language: "th" | "en"): string {
  if (!isValidDrugPersonIdentifierType(type)) return type;
  const meta = DRUG_PERSON_IDENTIFIER_TYPE_LABELS[type];
  return language === "th" ? meta.labelTh : meta.labelEn;
}

export function DrugPersonIdentityHeader({
  personId,
  name,
  status,
  firstSeenAt,
  lastSeenAt,
  aliases,
  identifiers,
  canViewFull,
  duplicateHref,
  actions,
}: {
  personId: string;
  name: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  aliases: DrugPersonAliasRow[];
  identifiers: DrugPersonIdentifierRow[];
  canViewFull: boolean;
  duplicateHref?: string | null;
  actions?: ReactNode;
}) {
  const { user } = useAuth();
  const { t, language } = useT();
  const media = useDrugEntityMedia(user?.id ?? null, "PERSON", personId);
  const items = media.data?.items ?? [];
  const primary = items.find((item) => item.isPrimary) ?? items[0] ?? null;
  const statusLabel = status === "MERGED" ? t("di.profile.statusMerged") : t("di.profile.statusActive");
  const aliasText = aliases.map((alias) => alias.fullName).filter(Boolean).join(", ");
  const identifierPreview = identifiers.slice(0, 3);

  function formatDate(value: string): string {
    return new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-US");
  }

  return (
    <header
      className="w-full rounded-xl border border-border bg-surface p-3 sm:p-4"
      data-testid="person-visual-identity"
    >
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <div className="flex min-w-0 w-full flex-1 basis-0 flex-col gap-3 sm:flex-row sm:items-start">
          <a href="#media" className="mx-auto shrink-0 sm:mx-0" aria-label={t("di.media.openGallery")}>
            <DrugEntityVisualThumb
              entityType="PERSON"
              label={name}
              thumbnailUrl={primary?.thumbnailUrl ?? primary?.url}
              size="portrait"
            />
          </a>
          <div className="min-w-0 flex-1 space-y-1.5 text-center sm:text-left">
            <div>
              <h1 className="text-2xl font-semibold leading-tight break-words text-foreground">{name}</h1>
              <p className="mt-0.5 truncate text-xs text-muted" title={`${t("di.profile.personId")}: ${personId}`}>
                {t("di.profile.personId")}: {personId}
              </p>
            </div>
            <p className="text-sm text-foreground">
              <span className="text-muted">{t("di.profile.status")}:</span> {statusLabel}
            </p>
            <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted sm:justify-start">
              <span>
                {t("di.profile.firstSeen")}: <span className="text-foreground">{formatDate(firstSeenAt)}</span>
              </span>
              <span>
                {t("di.profile.lastSeen")}: <span className="text-foreground">{formatDate(lastSeenAt)}</span>
              </span>
            </p>
            {aliasText ? (
              <p className="text-sm text-muted break-words">
                {t("di.person.aliases")}: <span className="text-foreground">{aliasText}</span>
              </p>
            ) : null}
            {identifierPreview.length > 0 ? (
              <ul className="flex flex-col gap-0.5 text-sm">
                {identifierPreview.map((row) => (
                  <li key={row.id} className="min-w-0 text-muted">
                    {identifierTypeLabel(row.type, language)}:{" "}
                    <span className="break-words text-foreground">{presentIdentifierValue(row.value, canViewFull)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <a
                href="#media"
                className="inline-flex min-h-8 items-center rounded-lg border border-border bg-neutral-bg px-2.5 text-xs font-medium text-foreground hover:bg-surface"
              >
                {t("di.media.viewAllCount").replace("{count}", String(items.length))}
              </a>
              {duplicateHref ? (
                <Link
                  href={duplicateHref}
                  className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/5 px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/10"
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {t("di.profile.duplicateBadge")}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap content-start gap-2 md:w-auto md:max-w-56 md:shrink-0 md:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
