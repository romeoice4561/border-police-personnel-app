/**
 * DrugGeoMapCanvas (Phase DI-8 / DI-8.2B).
 *
 * Leaflet map — loaded via next/dynamic ssr:false.
 *
 * Modes:
 * - POINTS: individual event markers
 * - HOTSPOT: radius-based intelligence hotspots (NOT display clusters)
 * - DENSITY: zoom grid-bucket display clusters (NOT intelligence hotspots)
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, useMap, useMapEvent } from "react-leaflet";
import { divIcon, type LatLngBoundsExpression } from "leaflet";
import { computeDrugGeoClusters } from "@/lib/drug_intelligence/drug_geo_cluster";
import type { DrugMapMarkerView } from "@/lib/drug_intelligence/drug_geo_client";
import type { DrugGeoHotspot, DrugGeoMapMode } from "@/lib/drug_intelligence/drug_geo_hotspot";

const THAILAND_CENTER: [number, number] = [13.7563, 100.5018];
const THAILAND_DEFAULT_ZOOM = 6;
const SINGLE_MARKER_ZOOM = 12;

const MARKER_COLOR = "#f97316";
const MARKER_SELECTED_COLOR = "#2563eb";
const HOTSPOT_COLOR = "#ea580c";
const HOTSPOT_SELECTED_COLOR = "#2563eb";

function FitBoundsController({
  markers,
  hotspots,
  geoMode,
  selectedCaseId,
  selectedHotspotId,
  fitToken,
}: {
  markers: DrugMapMarkerView[];
  hotspots: DrugGeoHotspot[];
  geoMode: DrugGeoMapMode;
  selectedCaseId: string | null;
  selectedHotspotId: string | null;
  fitToken: number;
}) {
  const map = useMap();
  const lastFitToken = useRef<number>(-1);

  useEffect(() => {
    if (fitToken === lastFitToken.current) return;
    lastFitToken.current = fitToken;

    if (geoMode === "HOTSPOT") {
      if (hotspots.length === 0) {
        map.setView(THAILAND_CENTER, THAILAND_DEFAULT_ZOOM);
        return;
      }
      if (hotspots.length === 1) {
        map.setView([hotspots[0]!.centerLatitude, hotspots[0]!.centerLongitude], SINGLE_MARKER_ZOOM);
        return;
      }
      const bounds: LatLngBoundsExpression = hotspots.map(
        (h) => [h.centerLatitude, h.centerLongitude] as [number, number],
      );
      map.fitBounds(bounds, { padding: [40, 40] });
      return;
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken]);

  useEffect(() => {
    if (geoMode === "HOTSPOT") {
      if (!selectedHotspotId) return;
      const hs = hotspots.find((h) => h.hotspotId === selectedHotspotId);
      if (hs) map.setView([hs.centerLatitude, hs.centerLongitude], Math.max(map.getZoom(), 10), { animate: true });
      return;
    }
    if (!selectedCaseId) return;
    const marker = markers.find((m) => m.caseId === selectedCaseId);
    if (marker) map.setView([marker.latitude, marker.longitude], Math.max(map.getZoom(), SINGLE_MARKER_ZOOM), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId, selectedHotspotId, geoMode]);

  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoomChange(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useMapEvent("zoomend", (e) => onZoomChange(e.target.getZoom()));
  return null;
}

function clusterAriaLabel(count: number): string {
  return `กลุ่มแสดงผล ${count.toLocaleString("th-TH")} จุด กดเพื่อขยาย`;
}

function hotspotAriaLabel(count: number): string {
  return `กลุ่มเหตุการณ์ ${count.toLocaleString("th-TH")} เหตุการณ์ กดเพื่อดูสรุป`;
}

function clusterDivIcon(count: number, ariaLabel: string) {
  const size = count >= 10 ? 40 : count >= 5 ? 34 : 28;
  return divIcon({
    html: `<div role="button" tabindex="0" aria-label="${ariaLabel}" style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${MARKER_COLOR};color:#ffffff;font-weight:600;font-size:12px;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.35);cursor:pointer;">${count}</div>`,
    className: "di-geo-cluster-icon",
    iconSize: [size, size],
  });
}

function hotspotDivIcon(count: number, selected: boolean, ariaLabel: string) {
  const size = count >= 10 ? 44 : count >= 5 ? 38 : 32;
  const bg = selected ? HOTSPOT_SELECTED_COLOR : HOTSPOT_COLOR;
  return divIcon({
    html: `<div role="button" tabindex="0" aria-label="${ariaLabel}" style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${bg};color:#ffffff;font-weight:700;font-size:13px;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;">${count}</div>`,
    className: "di-geo-hotspot-icon",
    iconSize: [size, size],
  });
}

export interface DrugGeoMapCanvasProps {
  markers: DrugMapMarkerView[];
  selectedCaseId: string | null;
  onSelectMarker: (caseId: string) => void;
  fitToken: number;
  renderPopup: (marker: DrugMapMarkerView) => React.ReactNode;
  heightClassName?: string;
  /** @deprecated use geoMode — kept for older call sites */
  clusterMode?: boolean;
  geoMode?: DrugGeoMapMode;
  hotspots?: DrugGeoHotspot[];
  selectedHotspotId?: string | null;
  onSelectHotspot?: (hotspotId: string) => void;
}

export function DrugGeoMapCanvas({
  markers,
  selectedCaseId,
  onSelectMarker,
  fitToken,
  renderPopup,
  heightClassName,
  clusterMode = false,
  geoMode: geoModeProp,
  hotspots = [],
  selectedHotspotId = null,
  onSelectHotspot,
}: DrugGeoMapCanvasProps) {
  const geoMode: DrugGeoMapMode = geoModeProp ?? (clusterMode ? "DENSITY" : "POINTS");

  const initialCenter = useMemo<[number, number]>(() => {
    if (markers.length === 1) return [markers[0].latitude, markers[0].longitude];
    return THAILAND_CENTER;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [zoom, setZoom] = useState(THAILAND_DEFAULT_ZOOM);
  const clusters = useMemo(
    () => (geoMode === "DENSITY" ? computeDrugGeoClusters(markers, zoom) : []),
    [geoMode, markers, zoom],
  );

  return (
    <div className={heightClassName ?? "h-[70vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <MapContainer center={initialCenter} zoom={THAILAND_DEFAULT_ZOOM} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsController
          markers={markers}
          hotspots={hotspots}
          geoMode={geoMode}
          selectedCaseId={selectedCaseId}
          selectedHotspotId={selectedHotspotId}
          fitToken={fitToken}
        />
        {geoMode === "DENSITY" ? <ZoomTracker onZoomChange={setZoom} /> : null}

        {geoMode === "HOTSPOT"
          ? hotspots.map((hs) => (
              <HotspotMarker
                key={hs.hotspotId}
                hotspot={hs}
                selected={hs.hotspotId === selectedHotspotId}
                onSelect={() => onSelectHotspot?.(hs.hotspotId)}
              />
            ))
          : null}

        {geoMode === "DENSITY"
          ? clusters.map((cluster) =>
              cluster.markers.length === 1 ? (
                <ClusterSingleMarker
                  key={cluster.clusterId}
                  marker={cluster.markers[0]}
                  selectedCaseId={selectedCaseId}
                  onSelectMarker={onSelectMarker}
                  renderPopup={renderPopup}
                />
              ) : (
                <ClusterBubbleMarker
                  key={cluster.clusterId}
                  latitude={cluster.latitude}
                  longitude={cluster.longitude}
                  count={cluster.markers.length}
                  ariaLabel={clusterAriaLabel(cluster.markers.length)}
                />
              ),
            )
          : null}

        {geoMode === "POINTS"
          ? markers.map((marker) => (
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
            ))
          : null}
      </MapContainer>
    </div>
  );
}

function HotspotMarker({
  hotspot,
  selected,
  onSelect,
}: {
  hotspot: DrugGeoHotspot;
  selected: boolean;
  onSelect: () => void;
}) {
  const radiusMeters = hotspot.radiusKm * 1000;
  return (
    <>
      <Circle
        center={[hotspot.centerLatitude, hotspot.centerLongitude]}
        radius={radiusMeters}
        pathOptions={{
          color: selected ? HOTSPOT_SELECTED_COLOR : HOTSPOT_COLOR,
          fillColor: selected ? HOTSPOT_SELECTED_COLOR : HOTSPOT_COLOR,
          fillOpacity: selected ? 0.18 : 0.1,
          weight: selected ? 2 : 1,
        }}
        eventHandlers={{ click: onSelect }}
      />
      <Marker
        position={[hotspot.centerLatitude, hotspot.centerLongitude]}
        icon={hotspotDivIcon(hotspot.eventCount, selected, hotspotAriaLabel(hotspot.eventCount))}
        eventHandlers={{
          click: onSelect,
          add: (e) => {
            const el = e.target.getElement();
            el?.addEventListener("keydown", (ke: KeyboardEvent) => {
              if (ke.key === "Enter" || ke.key === " ") {
                ke.preventDefault();
                onSelect();
              }
            });
          },
        }}
      />
    </>
  );
}

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

function ClusterSingleMarker({
  marker,
  selectedCaseId,
  onSelectMarker,
  renderPopup,
}: {
  marker: DrugMapMarkerView;
  selectedCaseId: string | null;
  onSelectMarker: (caseId: string) => void;
  renderPopup: (marker: DrugMapMarkerView) => React.ReactNode;
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
