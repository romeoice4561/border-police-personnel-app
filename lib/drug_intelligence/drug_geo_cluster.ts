/**
 * Grid-bucket marker clustering (Phase DI-8.2, Section 8/13).
 *
 * A deliberately simple, dependency-free clustering strategy — no
 * react-leaflet-cluster/leaflet.markercluster added (unconfirmed
 * compatibility with react-leaflet@5/React 19 at the time of this phase,
 * and the phase's own instruction: "do not add a large or abandoned
 * dependency casually... if risky or incompatible, implement a simpler
 * safe clustering strategy"). This buckets markers onto a lat/lng grid
 * whose cell size shrinks as zoom increases (fewer, bigger clusters when
 * zoomed out; individual points once zoomed in far enough that clusters
 * would be misleading) — a standard, well-understood clustering shape,
 * not a heatmap/interpolation (Section 13 explicitly forbids an
 * "inaccurate heatmap based on arbitrary interpolation").
 *
 * Pure — no I/O, no React, no Leaflet import (keeps this testable without a
 * DOM/browser).
 */

export interface DrugGeoClusterableMarker {
  caseId: string;
  latitude: number;
  longitude: number;
}

export interface DrugGeoCluster<T extends DrugGeoClusterableMarker> {
  /** Stable cell id — same input markers at the same zoom always produce the same id, so React keys stay stable across re-renders. */
  clusterId: string;
  /** Centroid of the member markers — the average of the raw coordinates, not a fabricated/guessed location. */
  latitude: number;
  longitude: number;
  markers: T[];
}

/**
 * Grid cell size in degrees, halving roughly every 2 zoom levels — tuned so
 * markers within easy visual "overlap" distance at a given zoom collapse
 * into one cluster, and by zoom 12 (the single-marker/close-up zoom this
 * map already uses elsewhere) cells are small enough that clustering
 * effectively stops mattering.
 */
export function drugGeoClusterCellSizeForZoom(zoom: number): number {
  const clamped = Math.max(3, Math.min(zoom, 18));
  return 20 / Math.pow(2, clamped / 2);
}

/**
 * Below this zoom, cell size would exceed 1 (clusters of continental
 * scale) — callers should treat clustering as "always on" below the map's
 * own default zoom, and it naturally becomes a no-op (one marker per
 * cluster) once zoomed in close, so there is no separate "cluster mode"
 * flag needed beyond the zoom-derived cell size itself.
 */
export function shouldClusterAtZoom(zoom: number): boolean {
  return zoom < 12;
}

/** Groups markers into clusters for the given zoom. A cell with exactly one marker is still returned as a "cluster" of size 1 — callers render size-1 clusters as a normal point marker. */
export function computeDrugGeoClusters<T extends DrugGeoClusterableMarker>(markers: T[], zoom: number): DrugGeoCluster<T>[] {
  const cellSize = drugGeoClusterCellSizeForZoom(zoom);
  const cells = new Map<string, T[]>();

  for (const marker of markers) {
    const cellLat = Math.floor(marker.latitude / cellSize);
    const cellLng = Math.floor(marker.longitude / cellSize);
    const key = `${cellLat}:${cellLng}`;
    const existing = cells.get(key);
    if (existing) existing.push(marker);
    else cells.set(key, [marker]);
  }

  return [...cells.entries()].map(([key, members]) => {
    const latitude = members.reduce((sum, m) => sum + m.latitude, 0) / members.length;
    const longitude = members.reduce((sum, m) => sum + m.longitude, 0) / members.length;
    return { clusterId: key, latitude, longitude, markers: members };
  });
}
