/**
 * Shared presentation helpers for Person Intelligence Workspace cards.
 * Display-only — does not invent facts or change API contracts.
 */
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, CircleHelp, AlertTriangle, Copy, Repeat2, Crosshair } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/ui/cn";

/** Compact technical ID for secondary UI (never primary when a human label exists). */
export function compactEntityId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function IntelligenceSection({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2 rounded-xl border border-border bg-surface p-3 sm:p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function IntelligenceStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-neutral-bg/60 px-2.5 py-2">
      <span className="text-accent">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function VerificationToneBadge({
  status,
  label,
}: {
  status: "CONFIRMED" | "SUPPORTED" | "UNVERIFIED" | string;
  label: string;
}) {
  const tone =
    status === "CONFIRMED"
      ? "border-good/40 bg-good/10 text-good"
      : status === "SUPPORTED"
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-border bg-neutral-bg text-muted";
  const Icon = status === "CONFIRMED" ? CheckCircle2 : status === "SUPPORTED" ? AlertTriangle : CircleHelp;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tone)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Discovery / origin status chip for entity cards (presentation only). */
export function DiscoveryStatusBadge({
  kind,
  label,
}: {
  kind: "REPEATED" | "SOURCE_ONLY" | "SOURCE" | "LINKED" | "NEUTRAL";
  label: string;
}) {
  const tone =
    kind === "REPEATED"
      ? "border-accent/40 bg-accent/10 text-accent"
      : kind === "SOURCE" || kind === "SOURCE_ONLY"
        ? "border-accent/40 bg-accent/10 text-accent"
        : kind === "LINKED"
          ? "border-border bg-neutral-bg text-muted"
          : "border-border bg-neutral-bg text-muted";
  const Icon = kind === "REPEATED" ? Repeat2 : kind === "SOURCE" || kind === "SOURCE_ONLY" ? Crosshair : null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tone)}
      data-testid="discovery-status-badge"
      data-kind={kind}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

/** Compact case chip — human case number preferred; never promotes raw UUID. */
export function CaseContextChip({
  label,
  href,
  emphasized,
}: {
  label: string;
  href?: string | null;
  emphasized?: boolean;
}) {
  const className = cn(
    "inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium",
    emphasized ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-surface text-foreground",
  );
  const content = (
    <>
      <span aria-hidden="true">📁</span>
      <span className="truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cn(className, "hover:underline")} data-testid="case-context-chip">
        {content}
      </Link>
    );
  }
  return (
    <span className={className} data-testid="case-context-chip">
      {content}
    </span>
  );
}

export function CaseChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} data-testid="case-chip-row">
      {children}
    </div>
  );
}

export function HumanIdLabel({
  primary,
  technicalId,
  fallbackPrimary,
  className,
}: {
  primary: string | null | undefined;
  technicalId?: string | null;
  /** Neutral label when no human-readable name (never invent a group title). */
  fallbackPrimary?: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const human = primary && !looksLikeUuid(primary) ? primary : null;
  const id = technicalId || (primary && looksLikeUuid(primary) ? primary : null);
  const display = human || fallbackPrimary || (id ? compactEntityId(id) : "—");

  return (
    <div className={cn("min-w-0", className)} data-testid="human-id-label">
      <p className="truncate text-sm font-semibold text-foreground">{display}</p>
      {id ? (
        <button
          type="button"
          className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[10px] text-muted hover:text-foreground"
          title={id}
          data-testid="human-id-copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(id);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            } catch {
              /* ignore */
            }
          }}
        >
          <span className="truncate">ID: {compactEntityId(id)}</span>
          <Copy className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          {copied ? <span>✓</span> : null}
        </button>
      ) : null}
    </div>
  );
}

export function MiniTimeline({
  items,
}: {
  items: Array<{ id: string; label: string; dateLabel: string; badge?: string | null; href?: string | null }>;
}) {
  if (items.length === 0) return null;
  return (
    <ol className="space-y-0" data-testid="person-mini-timeline">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-3 last:pb-0" data-testid="person-mini-timeline-item">
          <div className="flex w-3 flex-col items-center">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
            {index < items.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] text-muted">{item.dateLabel}</p>
            <p className="text-sm text-foreground">
              {item.href ? (
                <a href={item.href} className="font-medium text-accent hover:underline">
                  {item.label}
                </a>
              ) : (
                item.label
              )}
            </p>
            {item.badge ? (
              <span className="mt-0.5 inline-flex rounded-full border border-border bg-neutral-bg px-2 py-0.5 text-[10px] font-medium text-muted">
                {item.badge}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Compact Visual Intelligence card shell.
 * Meaning-first layout: identity → badges → summary → chips → action.
 */
export function VisualIntelligenceCard({
  icon,
  title,
  badges,
  summary,
  chips,
  meta,
  media,
  action,
  emphasized,
  className,
  testId,
  dataAttrs,
}: {
  icon?: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  summary?: ReactNode;
  chips?: ReactNode;
  meta?: ReactNode;
  media?: ReactNode;
  action?: ReactNode;
  emphasized?: boolean;
  className?: string;
  testId?: string;
  dataAttrs?: Record<string, string | undefined>;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-surface p-3 shadow-sm",
        emphasized ? "border-accent/50 ring-1 ring-accent/20" : "border-border",
        className,
      )}
      data-testid={testId ?? "visual-intelligence-card"}
      {...Object.fromEntries(
        Object.entries(dataAttrs ?? {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k.startsWith("data-") ? k : `data-${k}`, v]),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {icon ? <span className="shrink-0 text-accent">{icon}</span> : null}
            <div className="min-w-0 text-sm font-semibold text-foreground">{title}</div>
          </div>
          {badges ? <div className="flex flex-wrap gap-1">{badges}</div> : null}
          {summary ? <div className="text-sm text-foreground">{summary}</div> : null}
          {chips}
          {meta ? <div className="text-xs text-muted">{meta}</div> : null}
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
        {media ? <div className="shrink-0">{media}</div> : null}
      </div>
    </article>
  );
}

/** @deprecated Prefer VisualIntelligenceCard — kept for residual callers. */
export function EntityIntelligenceCard({
  href,
  title,
  subtitle,
  meta,
  badge,
  footer,
  media,
}: {
  href?: string | null;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  media?: ReactNode;
}) {
  const body = (
    <VisualIntelligenceCard title={title} badges={badge} summary={subtitle} meta={meta} media={media} action={footer} />
  );
  if (!href) return body;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}

export function ReviewStatusRow({
  tone,
  label,
  detail,
  action,
}: {
  tone: "good" | "warn" | "neutral" | "question";
  label: string;
  detail?: string;
  action?: ReactNode;
}) {
  const mark = tone === "good" ? "✓" : tone === "warn" ? "⚠" : tone === "question" ? "?" : "·";
  const color =
    tone === "good" ? "text-good" : tone === "warn" ? "text-warning" : tone === "question" ? "text-muted" : "text-foreground";
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
      data-testid="review-status-row"
      data-tone={tone}
    >
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", color)}>
          <span className="mr-1.5" aria-hidden="true">
            {mark}
          </span>
          {label}
        </p>
        {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
      </div>
      {action}
    </li>
  );
}

/**
 * Responsive card grid: one card stays ~60–70% width; 2+ use multi-column.
 * Avoids huge empty half-pages for single-entity tabs.
 */
export function IntelligenceCardGrid({
  count,
  children,
  className,
}: {
  count: number;
  children: ReactNode;
  className?: string;
}) {
  if (count <= 0) return null;
  if (count === 1) {
    return (
      <div className={cn("w-full max-w-[min(100%,42rem)] sm:max-w-[70%]", className)} data-testid="intelligence-card-grid" data-count="1">
        {children}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)} data-testid="intelligence-card-grid" data-count={String(count)}>
      {children}
    </div>
  );
}
