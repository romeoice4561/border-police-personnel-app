export const POSITION_LEVELS = [
  "รองสารวัตร",
  "สารวัตร",
  "รองผู้กำกับ",
  "ผู้กำกับ",
  "รองผู้บังคับการ",
  "ผู้บังคับการ",
] as const;

export type PositionLevel = (typeof POSITION_LEVELS)[number];

export function detectPositionLevel(position: string | null | undefined): PositionLevel | null {
  const value = position?.trim();
  if (!value) return null;
  return POSITION_LEVELS.find((level) => value.includes(level)) ?? null;
}
