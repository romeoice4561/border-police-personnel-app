/**
 * UI carrier choices for seized SIM entry.
 *
 * Not a Prisma enum — DrugSim.carrier remains a free string. Known Thai
 * operators are offered as a selector; anything else (historical values,
 * MVNO names) stays in that string unchanged.
 */
export const SIM_CARRIER_KNOWN_VALUES = ["AIS", "True", "dtac", "NT"] as const;
export const SIM_CARRIER_OTHER_SELECT = "OTHER";

export type SimCarrierKnownValue = (typeof SIM_CARRIER_KNOWN_VALUES)[number];

export function isKnownSimCarrier(value: string): value is SimCarrierKnownValue {
  return (SIM_CARRIER_KNOWN_VALUES as readonly string[]).includes(value);
}

/** Select value for a persisted carrier string. Unknown/historical names map to OTHER, never rewritten. */
export function simCarrierSelectValue(carrier: string): "" | SimCarrierKnownValue | typeof SIM_CARRIER_OTHER_SELECT {
  const trimmed = carrier.trim();
  if (!trimmed) return "";
  if (isKnownSimCarrier(trimmed)) return trimmed;
  return SIM_CARRIER_OTHER_SELECT;
}

/** Maps the selector (+ optional custom name) onto the persisted carrier string. Never stores the OTHER token. */
export function simCarrierPersistedValue(selectValue: string, customCarrier: string): string {
  if (!selectValue) return "";
  if (selectValue === SIM_CARRIER_OTHER_SELECT) return customCarrier.trim();
  if (isKnownSimCarrier(selectValue)) return selectValue;
  return customCarrier.trim();
}

export const SIM_CARRIER_SELECT_OPTIONS: ReadonlyArray<{ value: string; labelTh: string; labelEn: string }> = [
  { value: "AIS", labelTh: "AIS", labelEn: "AIS" },
  { value: "True", labelTh: "True", labelEn: "True" },
  { value: "dtac", labelTh: "dtac", labelEn: "dtac" },
  { value: "NT", labelTh: "NT", labelEn: "NT" },
  { value: SIM_CARRIER_OTHER_SELECT, labelTh: "MVNO / อื่น ๆ", labelEn: "MVNO / Other" },
];
