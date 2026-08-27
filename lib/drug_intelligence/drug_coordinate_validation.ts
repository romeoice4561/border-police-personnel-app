/**
 * Coordinate-pair validation (Phase DI-8, Section 8).
 *
 * ONE shared rule, reused everywhere a case/location coordinate pair is
 * accepted (Create Case's top-level DrugCase.latitude/longitude, each
 * location row's DrugLocation.latitude/longitude, and any future edit
 * path) — never re-implemented per call site.
 *
 * Rule: store BOTH latitude and longitude, or NEITHER. A lone
 * latitude-without-longitude (or vice versa) is rejected rather than
 * silently persisted as a half-coordinate that could never resolve to a
 * map marker anyway (Section 7: never combine one coordinate from one
 * source with the other from a different source — this schema-level rule
 * is what keeps a single row internally consistent in the first place).
 *
 * Range: latitude -90..90, longitude -180..180 — the universal WGS84
 * bounds, not a Thailand-specific bounding box (an arrest recorded near a
 * border crossing, or a data-entry/testing coordinate outside Thailand,
 * must not be silently rejected by an overly narrow rule).
 *
 * Pure — no I/O.
 */

import { z } from "zod";

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

const nullableLatitude = z.coerce.number().min(LATITUDE_MIN).max(LATITUDE_MAX).nullable().optional().transform((v) => v ?? null);
const nullableLongitude = z.coerce.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX).nullable().optional().transform((v) => v ?? null);

/**
 * Adds latitude/longitude fields (each individually range-validated) to an
 * existing zod object shape, then enforces the both-or-neither rule via
 * superRefine. Usage: `coordinatePairSchema(z.object({ ...otherFields }))`.
 */
export function withCoordinatePair<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({
      ...shape,
      latitude: nullableLatitude,
      longitude: nullableLongitude,
    })
    .superRefine((val, ctx) => {
      const coords = val as { latitude: number | null; longitude: number | null };
      const hasLat = coords.latitude !== null;
      const hasLng = coords.longitude !== null;
      if (hasLat !== hasLng) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [hasLat ? "longitude" : "latitude"],
          message: "latitude and longitude must both be provided, or both omitted — a single coordinate cannot be stored alone",
        });
      }
    });
}

export { nullableLatitude, nullableLongitude, LATITUDE_MIN, LATITUDE_MAX, LONGITUDE_MIN, LONGITUDE_MAX };
