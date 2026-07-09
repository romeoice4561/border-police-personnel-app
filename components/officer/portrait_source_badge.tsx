/**
 * PortraitSourceBadge (Phase 24B-2).
 *
 * Shows which resolver tier produced the currently-displayed portrait, so a
 * reviewer immediately knows what they're looking at (spec: "🟢 Uploaded /
 * 🟡 Google Drive / 🔵 AI Match / ⚪ Placeholder").
 */
import type { PortraitSource } from "@/lib/server/officer_portrait_service";

const LABELS: Record<PortraitSource, { dot: string; label: string }> = {
  UPLOADED: { dot: "🟢", label: "Uploaded" },
  MANUAL_MATCH: { dot: "🟡", label: "Google Drive (Manual Match)" },
  AI_MATCH: { dot: "🔵", label: "AI Match" },
  VERIFIED_DRIVE: { dot: "🟡", label: "Google Drive (Verified)" },
  PLACEHOLDER: { dot: "⚪", label: "Placeholder" },
};

export function PortraitSourceBadge({ source }: { source: PortraitSource }) {
  const { dot, label } = LABELS[source];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-neutral-bg/60 px-2 py-0.5 text-xs font-medium text-foreground">
      <span aria-hidden="true">{dot}</span>
      {label}
    </span>
  );
}
