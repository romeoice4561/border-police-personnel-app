/**
 * Optional HH:mm arrest-time helpers for the Create Case time picker.
 * Empty string remains valid (arrest time is optional).
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidThaiTime(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return TIME_PATTERN.test(trimmed);
}

export function parseThaiTime(value: string): { hour: string; minute: string } {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return { hour: "", minute: "" };
  return { hour: match[1], minute: match[2] };
}

export function formatThaiTime(hour: string, minute: string): string {
  if (!hour || !minute) return "";
  const candidate = `${hour}:${minute}`;
  return TIME_PATTERN.test(candidate) ? candidate : "";
}

export const THAI_TIME_HOURS: readonly string[] = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
export const THAI_TIME_MINUTE_STEP = 5;
export const THAI_TIME_QUICK_MINUTES: readonly string[] = Array.from({ length: 60 / THAI_TIME_MINUTE_STEP }, (_, i) =>
  String(i * THAI_TIME_MINUTE_STEP).padStart(2, "0")
);

const DEFAULT_EMPTY_TIME = "09:00";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fromParts(hour: number, minute: number): string {
  const wrappedHour = ((hour % 24) + 24) % 24;
  let wrappedMinute = minute;
  let nextHour = wrappedHour;
  while (wrappedMinute >= 60) {
    wrappedMinute -= 60;
    nextHour = (nextHour + 1) % 24;
  }
  while (wrappedMinute < 0) {
    wrappedMinute += 60;
    nextHour = (nextHour + 23) % 24;
  }
  return formatThaiTime(pad2(nextHour), pad2(wrappedMinute));
}

/** First +/- from an empty value starts at 09:00 rather than a 24-row list. */
export function stepThaiTimeHour(value: string, delta: number): string {
  const parsed = parseThaiTime(value);
  if (!parsed.hour) return DEFAULT_EMPTY_TIME;
  return fromParts(Number(parsed.hour) + delta, Number(parsed.minute));
}

export function stepThaiTimeMinute(value: string, deltaMinutes: number): string {
  const parsed = parseThaiTime(value);
  if (!parsed.hour) return DEFAULT_EMPTY_TIME;
  return fromParts(Number(parsed.hour), Number(parsed.minute) + deltaMinutes);
}

export function commitThaiTimeParts(hourText: string, minuteText: string): string {
  const hour = hourText.trim();
  const minute = minuteText.trim();
  if (!hour && !minute) return "";
  if (!hour) return "";
  const hourNum = Number(hour);
  const minuteNum = Number(minute === "" ? "0" : minute);
  if (!Number.isInteger(hourNum) || hourNum < 0 || hourNum > 23) return "";
  if (!Number.isInteger(minuteNum) || minuteNum < 0 || minuteNum > 59) return "";
  return fromParts(hourNum, minuteNum);
}
