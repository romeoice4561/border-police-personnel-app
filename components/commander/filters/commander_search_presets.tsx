/**
 * CommanderSearchPresets (Phase 41 Part 5).
 *
 * A row of one-click preset buttons ("ผู้ครบขึ้น สารวัตร", "ผู้ใกล้เกษียณ",
 * "ผู้มีสิทธิ์ 2 ขั้น", …). Clicking a preset REPLACES the current filters with
 * the preset's filter set (defined as pure data in lib/commander_query/presets)
 * — applying a preset is identical to the user setting those fields by hand.
 */
"use client";

import { COMMANDER_PRESETS, type CommanderPreset } from "@/lib/commander_query/presets";

export function CommanderSearchPresets({
  activePresetId,
  onApply,
}: {
  activePresetId?: string;
  onApply: (preset: CommanderPreset) => void;
}) {
  return (
    <section aria-label="ชุดค้นหาสำเร็จรูป / Search presets" className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">ชุดค้นหาสำเร็จรูป / Presets</h3>
      <div className="flex flex-wrap gap-2">
        {COMMANDER_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onApply(preset)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-foreground hover:border-accent hover:text-accent"
              }`}
            >
              {preset.labelTh}
            </button>
          );
        })}
      </div>
    </section>
  );
}
