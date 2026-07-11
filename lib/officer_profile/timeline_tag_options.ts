/**
 * Timeline category tags (Phase 26B Part 6 Part L).
 *
 * Future timeline categories — Promotion/Transfer/Training/Education/
 * Appointment/Retirement — each with a bilingual label and a badge color.
 * Architecture + UI only: there is no Timeline.category column yet (an
 * additive migration is out of scope for this UX-only phase per Part U's "no
 * regressions" / "continue only from current implementation" — see AGENTS.md
 * on additive-only migrations), so this module exists purely so a future
 * category picker/badge has a single source of truth to render from, the
 * same "prepare reusable structure, don't invent the column yet" pattern
 * already used for Achievements (see achievements_section.tsx).
 *
 * Pure data — no I/O, no React.
 */

export const TIMELINE_TAG_OPTIONS = ["PROMOTION", "TRANSFER", "TRAINING", "EDUCATION", "APPOINTMENT", "RETIREMENT"] as const;
export type TimelineTag = (typeof TIMELINE_TAG_OPTIONS)[number];

export const TIMELINE_TAG_META: Record<TimelineTag, { labelTh: string; labelEn: string; color: "good" | "serious" | "critical" | "accent" | "warning" | "neutral" }> = {
  PROMOTION: { labelTh: "เลื่อนตำแหน่ง", labelEn: "Promotion", color: "good" },
  TRANSFER: { labelTh: "ย้ายหน่วย", labelEn: "Transfer", color: "accent" },
  TRAINING: { labelTh: "ฝึกอบรม", labelEn: "Training", color: "warning" },
  EDUCATION: { labelTh: "การศึกษา", labelEn: "Education", color: "warning" },
  APPOINTMENT: { labelTh: "แต่งตั้ง", labelEn: "Appointment", color: "accent" },
  RETIREMENT: { labelTh: "เกษียณอายุราชการ", labelEn: "Retirement", color: "neutral" },
};

const TIMELINE_TAG_SET = new Set<string>(TIMELINE_TAG_OPTIONS);

export function isValidTimelineTag(value: string): value is TimelineTag {
  return TIMELINE_TAG_SET.has(value);
}
