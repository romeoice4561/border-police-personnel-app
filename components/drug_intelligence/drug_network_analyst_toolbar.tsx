/**
 * Vertical analyst drawing toolbar (Phase DI-9.4).
 *
 * Visible ONLY in Analyst Mode. Placed on the LEFT side of the canvas
 * overlay as a persistent vertical rail on desktop, and as a compact
 * "เครื่องมือ" button/popover on mobile (<640 px) to avoid consuming canvas
 * space on small screens.
 *
 * The toolbar carries NO graph intelligence — it only manages the currently-
 * active drawing tool, a purely client-side UI concern. It never creates a
 * DrugRelationship, never reads factual graph data, and never appears in View
 * Mode.
 *
 * DI-9.4 Section 29: after creating a shape the active tool returns to
 * SELECT. The toolbar signals a "pending line first-click" state via the
 * `pendingLineStart` prop so the user can see which step they're in.
 */
"use client";

import { useState } from "react";
import { MousePointer2, Hand, Minus, MoveRight, Square, Circle, Type, Image, ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useT } from "@/components/i18n/language_provider";
import type { DrugNetworkAnalystTool } from "@/lib/drug_intelligence/drug_network_annotations";
import type { TranslationKey } from "@/lib/i18n/dictionary";

// ─── Tool definitions ──────────────────────────────────────────────────────────

interface ToolDef {
  tool: DrugNetworkAnalystTool;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  labelKey: TranslationKey;
  /** If true, render a thin separator above this tool button. */
  groupStart?: boolean;
}

const TOOL_DEFS: ToolDef[] = [
  { tool: "SELECT",    Icon: MousePointer2, labelKey: "di.network.toolSelect" },
  { tool: "PAN",       Icon: Hand,          labelKey: "di.network.toolPan" },
  { tool: "LINE",      Icon: Minus,         labelKey: "di.network.toolLine",      groupStart: true },
  { tool: "ARROW",     Icon: MoveRight,     labelKey: "di.network.toolArrow" },
  { tool: "RECTANGLE", Icon: Square,        labelKey: "di.network.toolRectangle" },
  { tool: "ELLIPSE",   Icon: Circle,        labelKey: "di.network.toolEllipse" },
  { tool: "TEXT",      Icon: Type,          labelKey: "di.network.toolText" },
  { tool: "IMAGE",     Icon: Image,         labelKey: "di.network.toolImage" },
];

// ─── Component ────────────────────────────────────────────────────────────────

// Tooltip hint shown when a drag-drawing tool is active
const DRAG_HINT: Partial<Record<DrugNetworkAnalystTool, string>> = {
  RECTANGLE: "ลากบนผังเพื่อวาดสี่เหลี่ยม",
  ELLIPSE:   "ลากบนผังเพื่อวาดวงรี",
  LINE:      "ลากจากจุดเริ่มไปจุดปลายเพื่อวาดเส้น",
  ARROW:     "ลากจากจุดเริ่มไปจุดปลายเพื่อวาดลูกศร",
};

export interface DrugNetworkAnalystToolbarProps {
  activeTool: DrugNetworkAnalystTool;
  onToolSelect: (tool: DrugNetworkAnalystTool) => void;
  boardLocked: boolean;
}

export function DrugNetworkAnalystToolbar({ activeTool, onToolSelect, boardLocked }: DrugNetworkAnalystToolbarProps) {
  const { t } = useT();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isDisabled(tool: DrugNetworkAnalystTool): boolean {
    return boardLocked && tool !== "SELECT" && tool !== "PAN";
  }

  const ActiveIcon = TOOL_DEFS.find((d) => d.tool === activeTool)?.Icon ?? MousePointer2;
  const isDragTool = activeTool in DRAG_HINT;

  function renderToolButton(def: ToolDef, compact = false) {
    const { tool, Icon, labelKey } = def;
    const isActive = activeTool === tool;
    const disabled = isDisabled(tool);
    const label = t(labelKey);
    return (
      <button
        key={tool}
        type="button"
        role="radio"
        aria-checked={isActive}
        aria-label={label}
        title={disabled ? t("di.network.toolbarLockedTooltip") : label}
        disabled={disabled}
        onClick={() => {
          onToolSelect(tool);
          if (compact) setMobileOpen(false);
        }}
        className={cn(
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          compact
            ? "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm"
            : "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          isActive
            ? "bg-accent text-accent-fg shadow-sm"
            : "text-muted hover:bg-neutral-bg hover:text-foreground",
          disabled ? "cursor-not-allowed opacity-40" : ""
        )}
      >
        <Icon className={cn("shrink-0", compact ? "h-4 w-4" : "h-4 w-4")} aria-hidden />
        {compact ? <span>{label}</span> : null}
      </button>
    );
  }

  return (
    <>
      {/* ── Desktop: permanent vertical rail ──────────────────────────── */}
      <div
        className="absolute bottom-10 left-2 top-2 z-10 hidden flex-col items-center gap-0.5 rounded-xl border border-border bg-surface p-1 shadow-md sm:flex"
        role="radiogroup"
        aria-label={t("di.network.analystToolbarLabel")}
        data-testid="analyst-toolbar"
      >
        {TOOL_DEFS.map((def, i) => (
          <div key={def.tool} className="flex flex-col items-center">
            {def.groupStart && i > 0 ? (
              <div className="my-1 h-px w-6 bg-border" aria-hidden />
            ) : null}
            {renderToolButton(def)}
          </div>
        ))}
        {/* Draw hint: compact text below toolbar when drag tool is active */}
        {DRAG_HINT[activeTool] ? (
          <div className="mt-1 w-full">
            <div className="h-px w-6 bg-border" aria-hidden />
            <p
              className="mt-1 px-0.5 text-center text-[8px] leading-tight text-muted"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", maxHeight: 80 }}
              aria-live="polite"
            >
              {DRAG_HINT[activeTool]}
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Mobile: compact popover ────────────────────────────────────── */}
      <div className="absolute bottom-10 left-2 z-10 sm:hidden">
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={mobileOpen}
          aria-label={t("di.network.toolbarMobileLabel")}
          onClick={() => setMobileOpen((v) => !v)}
          data-testid="analyst-toolbar-mobile-toggle"
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            isDragTool ? "ring-2 ring-accent ring-offset-1" : ""
          )}
        >
          <ActiveIcon className="h-4 w-4 shrink-0" aria-hidden />
          {t("di.network.toolbarMobileLabel")}
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", mobileOpen ? "rotate-180" : "")} aria-hidden />
        </button>

        {mobileOpen ? (
          <div
            role="radiogroup"
            aria-label={t("di.network.analystToolbarLabel")}
            className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-border bg-surface p-1 shadow-lg"
          >
            {TOOL_DEFS.map((def, i) => (
              <div key={def.tool}>
                {def.groupStart && i > 0 ? (
                  <div className="my-0.5 h-px bg-border" aria-hidden />
                ) : null}
                {renderToolButton(def, true)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
