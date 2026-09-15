/**
 * DI-9.5.2 / DI-9.5.4 — reusable intelligence-entity detail presentation.
 * Phone, SIM, Device, and Vehicle pages compose this shell.
 * Presentation only: same DTOs, no extra requests.
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, History, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/states";
import { DrugEntityIconMark } from "@/components/drug_intelligence/drug_entity_visual";
import { useT } from "@/components/i18n/language_provider";
import { formatDiDate } from "@/lib/drug_intelligence/di_date_helpers";
import {
  DRUG_ENTITY_DETAIL_TONE,
  DRUG_ENTITY_SCAN_EMOJI,
  shouldShowRecurrenceBadge,
} from "@/lib/drug_intelligence/drug_entity_detail_presentation";
import { drugEntityDetailPath } from "@/lib/drug_intelligence/drug_entity_routes";
import type { DrugGraphNodeType } from "@/lib/drug_intelligence/drug_intelligence_client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/ui/cn";

export function DrugEntityCopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard unavailable — the identifier remains visible for manual copy.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-neutral-bg hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={copied ? t("di.entity.copied") : `${t("di.entity.copy")} ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-good" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}

export function DrugEntityRecurrenceBadge({ caseCount }: { caseCount: number }) {
  const { t } = useT();
  if (!shouldShowRecurrenceBadge(caseCount)) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-border bg-neutral-bg px-2.5 py-0.5 text-xs font-medium text-foreground"
      data-testid="drug-entity-recurrence-badge"
    >
      <span aria-hidden="true">🔗</span>
      {t("di.network.explainRepeatedBadge")}
    </span>
  );
}

export function DrugEntityHero({
  entityType,
  title,
  subtitle,
  caseCount,
  copyValue,
}: {
  entityType: DrugGraphNodeType;
  title: string;
  subtitle: string;
  caseCount: number;
  copyValue?: string | null;
}) {
  const { t } = useT();
  const tone = DRUG_ENTITY_DETAIL_TONE[entityType];
  return (
    <header
      className={cn("rounded-xl border border-border bg-surface p-4 sm:p-5", `border-l-4 ${tone.bar}`)}
      data-testid="drug-entity-hero"
      data-entity-type={entityType}
    >
      <div className="flex items-start gap-3">
        <DrugEntityIconMark type={entityType} size="lg" className={tone.shell} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">
            <span aria-hidden="true">{DRUG_ENTITY_SCAN_EMOJI[entityType]} </span>
            {subtitle}
          </p>
          <div className="mt-1 flex items-start gap-2">
            <h1 className="min-w-0 break-all text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{title}</h1>
            {copyValue ? <DrugEntityCopyButton value={copyValue} label={title} /> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DrugEntityRecurrenceBadge caseCount={caseCount} />
            {shouldShowRecurrenceBadge(caseCount) ? (
              <span className="text-xs text-muted">{t("di.entity.foundInNCases").replace("{count}", String(caseCount))}</span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export function DrugEntityActionBar({
  networkHref,
  timelineHref,
  backHref = "/drug-intelligence/search",
  backLabelKey = "di.entity.backToSearch",
}: {
  networkHref: string;
  timelineHref: string;
  backHref?: string;
  backLabelKey?: TranslationKey;
}) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-2" data-testid="drug-entity-actions">
      <Button asChild variant="accent" size="sm">
        <Link href={networkHref}>
          <Network className="h-4 w-4" aria-hidden="true" />
          {t("di.network.openNetwork")}
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={timelineHref}>
          <History className="h-4 w-4" aria-hidden="true" />
          {t("di.timeline.navLabel")}
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t(backLabelKey)}
        </Link>
      </Button>
    </div>
  );
}

export function DrugEntityKpiCard({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3">
      <p className="text-[11px] font-medium text-muted">
        <span aria-hidden="true">{emoji} </span>
        {label}
      </p>
      <p className="mt-1 break-all text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function DrugEntityIdentityField({
  emoji,
  label,
  value,
  copyValue,
}: {
  emoji: string;
  label: string;
  value: string;
  copyValue?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3">
      <p className="text-[11px] font-medium text-muted">
        <span aria-hidden="true">{emoji} </span>
        {label}
      </p>
      <div className="mt-1 flex items-start gap-2">
        <p className="min-w-0 flex-1 break-all text-sm font-semibold text-foreground">{value}</p>
        {copyValue && copyValue !== "—" ? <DrugEntityCopyButton value={copyValue} label={label} /> : null}
      </div>
    </div>
  );
}

export function DrugEntitySection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-foreground">{heading}</h2>
      {children}
    </section>
  );
}

export function DrugRelatedPersonCard({
  personId,
  name,
  linkedCaseCount,
}: {
  personId: string;
  name: string;
  linkedCaseCount?: number;
}) {
  const { t } = useT();
  const href = drugEntityDetailPath("PERSON", personId);
  const context =
    linkedCaseCount && linkedCaseCount > 0
      ? t("di.entity.linkedInNCases").replace("{count}", String(linkedCaseCount))
      : t("di.entity.foundAssociatedWith");
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border border-l-4 border-l-accent bg-surface p-4 transition-colors hover:border-accent/60 hover:bg-neutral-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      data-testid="drug-related-person-card"
    >
      <div className="flex items-start gap-3">
        <DrugEntityIconMark type="PERSON" size="sm" className={DRUG_ENTITY_DETAIL_TONE.PERSON.shell} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{name}</p>
          <p className="mt-1 text-xs text-muted">{context}</p>
          <p className="mt-2 text-xs font-medium text-accent">{t("di.entity.viewPersonProfile")}</p>
        </div>
      </div>
    </Link>
  );
}

export function DrugRelatedCaseCard({
  caseId,
  caseNumber,
  title,
  arrestDate,
  isCurrentContext,
}: {
  caseId: string;
  caseNumber: string;
  title: string;
  arrestDate: string | null;
  isCurrentContext: boolean;
}) {
  const { t } = useT();
  const href = drugEntityDetailPath("CASE", caseId);
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border bg-surface p-4 transition-colors hover:bg-neutral-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isCurrentContext ? "border-critical border-l-4 border-l-critical" : "border-border border-l-4 border-l-accent"
      )}
      data-testid="drug-related-case-card"
      data-current-context={isCurrentContext ? "true" : "false"}
    >
      <div className="flex items-start gap-3">
        <DrugEntityIconMark type="CASE" size="sm" className={DRUG_ENTITY_DETAIL_TONE.CASE.shell} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{caseNumber}</p>
            {isCurrentContext ? (
              <span className="rounded-full border border-critical bg-critical-bg px-2 py-px text-[10px] font-medium text-critical">
                {t("di.entity.currentContextCase")}
              </span>
            ) : null}
          </div>
          {title ? <p className="mt-1 text-sm text-muted">{title}</p> : null}
          {arrestDate ? (
            <p className="mt-1.5 text-xs text-muted">
              <span aria-hidden="true">📅 </span>
              {formatDiDate(arrestDate)}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function DrugEntityFindings({ items }: { items: string[] }) {
  const { t } = useT();
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-neutral-bg/40 px-4 py-3" data-testid="drug-entity-findings">
      <h2 className="text-sm font-semibold text-foreground">{t("di.entity.findingsTitle")}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function DrugEntityInfoNotice({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <aside className="rounded-xl border border-border bg-neutral-bg/50 px-4 py-3 text-xs leading-relaxed text-muted" data-testid="drug-entity-info-notice">
      <p className="font-medium text-foreground">{t("di.entity.safetyNoticeTitle")}</p>
      <p className="mt-1">{children}</p>
    </aside>
  );
}

export function DrugEntityRelatedPersonList({
  persons,
}: {
  persons: Array<{ id: string; name: string; linkedCaseCount?: number }>;
}) {
  const { t } = useT();
  const heading =
    persons.length > 1 ? t("di.entity.relatedPersonsHeadingMany") : t("di.entity.relatedPersonsHeading");
  return (
    <DrugEntitySection heading={heading}>
      {persons.length === 0 ? (
        <EmptyState title={t("di.entity.emptyRelatedPersons")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {persons.map((person) => (
            <DrugRelatedPersonCard
              key={person.id}
              personId={person.id}
              name={person.name}
              linkedCaseCount={person.linkedCaseCount}
            />
          ))}
        </div>
      )}
    </DrugEntitySection>
  );
}

export function DrugEntityRelatedCaseList({
  cases,
  currentCaseId,
}: {
  cases: Array<{ id: string; caseNumber: string; title: string; arrestDate: string | null }>;
  currentCaseId: string | null;
}) {
  const { t } = useT();
  return (
    <DrugEntitySection heading={t("di.entity.sourceCasesHeading")}>
      {cases.length === 0 ? (
        <EmptyState title={t("di.entity.emptySourceCases")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cases.map((item) => (
            <DrugRelatedCaseCard
              key={item.id}
              caseId={item.id}
              caseNumber={item.caseNumber}
              title={item.title}
              arrestDate={item.arrestDate}
              isCurrentContext={currentCaseId === item.id}
            />
          ))}
        </div>
      )}
    </DrugEntitySection>
  );
}
