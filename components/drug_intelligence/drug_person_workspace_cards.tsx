/**
 * Shared presentation helpers for Person Intelligence Workspace cards.
 * Display-only — does not invent facts or change API contracts.
 */
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, CircleHelp, AlertTriangle, Copy } from "lucide-react";
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
  items: Array<{ id: string; label: string; dateLabel: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <ol className="space-y-0">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-3 last:pb-0">
          <div className="flex w-3 flex-col items-center">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
            {index < items.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] text-muted">{item.dateLabel}</p>
            <p className="text-sm text-foreground">{item.label}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

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
    <article className="flex gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm transition-colors hover:border-accent/40">
      {media}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">{title}</div>
          {badge}
        </div>
        {subtitle ? <div className="text-sm text-muted">{subtitle}</div> : null}
        {meta ? <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">{meta}</div> : null}
        {footer}
      </div>
    </article>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}
