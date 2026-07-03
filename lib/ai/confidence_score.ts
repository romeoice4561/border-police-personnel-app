import type { FieldConfidence, PersonnelExtraction } from "@/lib/types/vision";

const PHONE_PATTERN = /\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/;

function scoreName(data: Partial<PersonnelExtraction>): number {
  const hasFirst = typeof data.first_name === "string" && data.first_name.trim().length > 0;
  const hasLast = typeof data.last_name === "string" && data.last_name.trim().length > 0;

  if (hasFirst && hasLast) return 100;
  if (hasFirst || hasLast) return 50;
  return 0;
}

function scorePhone(data: Partial<PersonnelExtraction>): number {
  const phone = data.phone;
  if (typeof phone !== "string" || phone.trim().length === 0) return 0;
  return PHONE_PATTERN.test(phone) ? 100 : 40;
}

function scoreTimeline(data: Partial<PersonnelExtraction>): number {
  const timeline = data.timeline;
  if (!Array.isArray(timeline) || timeline.length === 0) return 0;

  const completeEntries = timeline.filter(
    (entry) =>
      typeof entry.year === "string" &&
      entry.year.trim().length > 0 &&
      typeof entry.position === "string" &&
      entry.position.trim().length > 0 &&
      typeof entry.unit === "string" &&
      entry.unit.trim().length > 0
  ).length;

  return Math.round((completeEntries / timeline.length) * 100);
}

export function scoreExtraction(data: Partial<PersonnelExtraction>): FieldConfidence {
  const name = scoreName(data);
  const phone = scorePhone(data);
  const timeline = scoreTimeline(data);
  const overall = Math.round((name + phone + timeline) / 3);

  return { name, phone, timeline, overall };
}
