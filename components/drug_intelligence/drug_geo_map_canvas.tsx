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
 * emphasis ring, never a "danger" color scheme. No clustering in this first
 * version (Section 16) — the QA-scale dataset does not need it yet; documented
 * as deferred, not silently skipped.
 */
"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
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

export interface DrugGeoMapCanvasProps {
  markers: DrugGeoCaseMarkerView[];
  selectedCaseId: string | null;
  onSelectMarker: (caseId: string) => void;
  fitToken: number;
  renderPopup: (marker: DrugGeoCaseMarkerView) => React.ReactNode;
  heightClassName?: string;
}

export function DrugGeoMapCanvas({ markers, selectedCaseId, onSelectMarker, fitToken, renderPopup, heightClassName }: DrugGeoMapCanvasProps) {
  const initialCenter = useMemo<[number, number]>(() => {
    if (markers.length === 1) return [markers[0].latitude, markers[0].longitude];
    return THAILAND_CENTER;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial mount value only; FitBoundsController owns subsequent view changes

  return (
    <div className={heightClassName ?? "h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <MapContainer center={initialCenter} zoom={THAILAND_DEFAULT_ZOOM} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsController markers={markers} selectedCaseId={selectedCaseId} fitToken={fitToken} />
        {markers.map((marker) => (
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
            <Popup>{renderPopup(marker)}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
