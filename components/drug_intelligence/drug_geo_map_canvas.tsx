/**
 * DrugGeoMapCanvas (Phase DI-8, Section 4/15/16/27/28).
 *
 * The actual Leaflet map — isolated in its own "use client" file and always
 * loaded via next/dynamic with ssr:false (see drug_geo_map.tsx), since
 * Leaflet touches `window`/`document` at import time and cannot run during
 * Next.js's server render. OpenStreetMap tiles, no API key.
 *
 * Marker design (Section 15): plain circle markers, neutral project accent
 * color — never risk/severity-colored. The selected marker gets a visible
 * emphasis ring, never a "danger" color scheme.
 *
 * Clustering (Phase DI-8.2, Section 8/13): an opt-in "ความหนาแน่น" view
 * mode groups nearby markers into a grid-bucket cluster bubble
 * (lib/drug_intelligence/drug_geo_cluster.ts) — deliberately NOT a
 * react-leaflet-cluster/leaflet.markercluster dependency (unconfirmed
 * compatibility with react-leaflet@5/React 19), and deliberately NOT a
 * heatmap (no interpolation/guessed density — every cluster's position is
 * the exact centroid of its real, stored-coordinate members).
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, useMapEvent } from "react-leaflet";
import { divIcon, type LatLngBoundsExpression } from "leaflet";
import { computeDrugGeoClusters } from "@/lib/drug_intelligence/drug_geo_cluster";
import type { DrugGeoCaseMarkerView } from "@/lib/drug_intelligence/drug_geo_client";

// Thailand-wide default view (Section 28) — a sensible national center/zoom,
// never a precise operational location.
const THAILAND_CENTER: [number, number] = [13.7563, 100.5018];
const THAILAND_DEFAULT_ZOOM = 6;
const SINGLE_MARKER_ZOOM = 12;

const MARKER_COLOR = "#f97316"; // neutral/orange project accent — never risk-red
const MARKER_SELECTED_COLOR = "#2563eb"; // accent-blue selection emphasis, not a severity color

function FitBoundsController({ markers, selectedCaseId, fitToken }: { markers: DrugGeoCaseMarkerView[]; selectedCaseId: string | null; fitToken: number }) {
  const map = useMap();
  const lastFitToken = useRef<number>(-1);

  useEffect(() => {
    // Only re-fit when the caller explicitly asks (fitToken changes) — never
    // fight the user's manual pan/zoom after every minor interaction
    // (Section 27's explicit instruction).
    if (fitToken === lastFitToken.current) return;
    lastFitToken.current = fitToken;

    if (markers.length === 0) {
      map.setView(THAILAND_CENTER, THAILAND_DEFAULT_ZOOM);
      return;
    }
    if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], SINGLE_MARKER_ZOOM);
      return;
    }
    const bounds: LatLngBoundsExpression = markers.map((m) => [m.latitude, m.longitude] as [number, number]);
    map.fitBounds(bounds, { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fitToken is the deliberate re-fit trigger; markers/map are read, not depended on, to avoid re-fitting on every marker array identity change
  }, [fitToken]);

  useEffect(() => {
    if (!selectedCaseId) return;
    const marker = markers.find((m) => m.caseId === selectedCaseId);
    if (marker) map.setView([marker.latitude, marker.longitude], Math.max(map.getZoom(), SINGLE_MARKER_ZOOM), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately reacts only to selectedCaseId changing, not marker array identity
  }, [selectedCaseId]);

  return null;
}

/** Tracks the current zoom level into React state so cluster bucket size can react to zoom/pan without prop-drilling a Leaflet map instance. */
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoomChange(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report the initial zoom once on mount; subsequent changes come from the zoomend event below
  }, []);
  useMapEvent("zoomend", (e) => onZoomChange(e.target.getZoom()));
  return null;
}

/** Thai-only, matching this file's existing convention of hardcoding Thai text locally rather than importing useT() into a Leaflet-internals-heavy client canvas (same pattern as drug_geo_marker_popup.tsx's own date formatter). */
function clusterAriaLabel(count: number): string {
  return `กลุ่มคดี ${count.toLocaleString("th-TH")} คดี กดเพื่อขยาย`;
}

function clusterDivIcon(count: number, ariaLabel: string) {
  const size = count >= 10 ? 40 : count >= 5 ? 34 : 28;
  return divIcon({
    html: `<div role="button" tabindex="0" aria-label="${ariaLabel}" style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${MARKER_COLOR};color:#ffffff;font-weight:600;font-size:12px;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.35);cursor:pointer;">${count}</div>`,
    className: "di-geo-cluster-icon",
    iconSize: [size, size],
  });
}

export interface DrugGeoMapCanvasProps {
  markers: DrugGeoCaseMarkerView[];
  selectedCaseId: string | null;
  onSelectMarker: (caseId: string) => void;
  fitToken: number;
  renderPopup: (marker: DrugGeoCaseMarkerView) => React.ReactNode;
  heightClassName?: string;
  /** Section 8/13 (DI-8.2): opt-in "ความหนาแน่น" view — grid-bucket clustering, off by default so the original point view is unchanged when omitted. */
  clusterMode?: boolean;
}

export function DrugGeoMapCanvas({ markers, selectedCaseId, onSelectMarker, fitToken, renderPopup, heightClassName, clusterMode = false }: DrugGeoMapCanvasProps) {
  const initialCenter = useMemo<[number, number]>(() => {
    if (markers.length === 1) return [markers[0].latitude, markers[0].longitude];
    return THAILAND_CENTER;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial mount value only; FitBoundsController owns subsequent view changes

  const [zoom, setZoom] = useState(THAILAND_DEFAULT_ZOOM);
  const clusters = useMemo(() => (clusterMode ? computeDrugGeoClusters(markers, zoom) : []), [clusterMode, markers, zoom]);

  return (
    <div className={heightClassName ?? "h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <MapContainer center={initialCenter} zoom={THAILAND_DEFAULT_ZOOM} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsController markers={markers} selectedCaseId={selectedCaseId} fitToken={fitToken} />
        {clusterMode ? <ZoomTracker onZoomChange={setZoom} /> : null}
        {clusterMode
          ? clusters.map((cluster) =>
              cluster.markers.length === 1 ? (
                <ClusterSingleMarker key={cluster.clusterId} marker={cluster.markers[0]} selectedCaseId={selectedCaseId} onSelectMarker={onSelectMarker} renderPopup={renderPopup} />
              ) : (
                <ClusterBubbleMarker
                  key={cluster.clusterId}
                  latitude={cluster.latitude}
                  longitude={cluster.longitude}
                  count={cluster.markers.length}
                  ariaLabel={clusterAriaLabel(cluster.markers.length)}
                />
              )
            )
          : markers.map((marker) => (
              <CircleMarker
                key={marker.caseId}
                center={[marker.latitude, marker.longitude]}
                radius={marker.caseId === selectedCaseId ? 11 : 8}
                pathOptions={{
                  color: marker.caseId === selectedCaseId ? MARKER_SELECTED_COLOR : MARKER_COLOR,
                  fillColor: marker.caseId === selectedCaseId ? MARKER_SELECTED_COLOR : MARKER_COLOR,
                  fillOpacity: 0.85,
                  weight: marker.caseId === selectedCaseId ? 3 : 2,
                }}
                eventHandlers={{ click: () => onSelectMarker(marker.caseId) }}
              >
                <Popup className="di-geo-popup">{renderPopup(marker)}</Popup>
              </CircleMarker>
            ))}
      </MapContainer>
    </div>
  );
}

/** A cluster bubble — clicking OR pressing Enter/Space zooms in on its centroid so the underlying points separate out (Section 8: "click/zoom: expand into underlying points"; Section 21: keyboard-accessible, not click-only). Uses useMap() rather than reaching into Leaflet's Marker event target for the map instance. */
function ClusterBubbleMarker({ latitude, longitude, count, ariaLabel }: { latitude: number; longitude: number; count: number; ariaLabel: string }) {
  const map = useMap();
  const expand = () => map.setView([latitude, longitude], Math.min(map.getZoom() + 2, 18), { animate: true });
  return (
    <Marker
      position={[latitude, longitude]}
      icon={clusterDivIcon(count, ariaLabel)}
      eventHandlers={{
        click: expand,
        add: (e) => {
          const el = e.target.getElement();
          el?.addEventListener("keydown", (ke: KeyboardEvent) => {
            if (ke.key === "Enter" || ke.key === " ") {
              ke.preventDefault();
              expand();
            }
          });
        },
      }}
    />
  );
}

/** A cluster bucket that happens to contain exactly one marker renders as a normal point marker (same visual language as the non-cluster view), not a size-1 cluster bubble. */
function ClusterSingleMarker({
  marker,
  selectedCaseId,
  onSelectMarker,
  renderPopup,
}: {
  marker: DrugGeoCaseMarkerView;
  selectedCaseId: string | null;
  onSelectMarker: (caseId: string) => void;
  renderPopup: (marker: DrugGeoCaseMarkerView) => React.ReactNode;
}) {
  return (
    <CircleMarker
      center={[marker.latitude, marker.longitude]}
      radius={marker.caseId === selectedCaseId ? 11 : 8}
      pathOptions={{
        color: marker.caseId === selectedCaseId ? MARKER_SELECTED_COLOR : MARKER_COLOR,
        fillColor: marker.caseId === selectedCaseId ? MARKER_SELECTED_COLOR : MARKER_COLOR,
        fillOpacity: 0.85,
        weight: marker.caseId === selectedCaseId ? 3 : 2,
      }}
      eventHandlers={{ click: () => onSelectMarker(marker.caseId) }}
    >
      <Popup className="di-geo-popup">{renderPopup(marker)}</Popup>
    </CircleMarker>
  );
}
