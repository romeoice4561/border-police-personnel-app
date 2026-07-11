/**
 * Shirt size options (Phase 26B Part 5 Part G/L — Personal Information).
 *
 * A Combobox suggestion list (Part G explicitly allows "Custom") — never a
 * forced closed set, same convention as Rank/Position/Unit.
 *
 * Pure data — no I/O, no React.
 */

export const SHIRT_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const;
export type ShirtSize = (typeof SHIRT_SIZE_OPTIONS)[number];
