"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import Supercluster from "supercluster";
import "mapbox-gl/dist/mapbox-gl.css";
import { initials, logoColor } from "./logo";
import type { LatLng, NearbyPro, Pin } from "./types";

// Mapbox Standard: green parks, blue water, readable streets. Store/restaurant labels are hidden so
// neighbors' pro logos stand out. The canvas is darkened a touch in globals.css (.holler-map).
const STREET_STYLE = "mapbox://styles/mapbox/standard";
const SATELLITE_STYLE = "mapbox://styles/mapbox/standard-satellite";
const BASEMAP = { showPointOfInterestLabels: false, showTransitLabels: false };
// Pins are block-level; stop zooming before they look like they point at a house.
const MAX_ZOOM = 16;

type Props = {
  center: LatLng;
  home: { point: LatLng; initial: string } | null;
  satellite: boolean;
  pins: Pin[];
  pros: NearbyPro[];
  colors: Record<string, string>; // pro id -> their own pin color
  selectedId: string | null;
  onSelect: (proId: string | null) => void;
  recenterKey: number;
};

type PinProps = { proId: string; love: boolean };

// Several homes in the same ~150 m cell would stack exactly; fan them out a little.
function spread(pins: Pin[]) {
  const seen = new Map<string, number>();
  return pins.map((p) => {
    const key = `${p.pin_lat.toFixed(5)},${p.pin_lng.toFixed(5)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n === 0) return { ...p };
    const angle = n * 2.4;
    const r = 0.00025 * Math.sqrt(n);
    return { ...p, pin_lat: p.pin_lat + r * Math.sin(angle), pin_lng: p.pin_lng + r * Math.cos(angle) };
  });
}

export default function MapView(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const homeMarkerRef = useRef<Marker | null>(null);
  const markerCtorRef = useRef<typeof Marker | null>(null);
  const latest = useRef(props);
  latest.current = props;

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
      markerCtorRef.current = mapboxgl.Marker;
      const { center, satellite } = latest.current;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: satellite ? SATELLITE_STYLE : STREET_STYLE,
        config: { basemap: BASEMAP },
        center: [center.lng, center.lat],
        zoom: 14,
        maxZoom: MAX_ZOOM,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      // Keep the middle of the map clear of the laptop sidebar / phone cards
      const pad = () =>
        map.setPadding(window.innerWidth >= 1024 ? { left: 400, right: 0, top: 0, bottom: 0 } : { left: 0, right: 0, top: 180, bottom: 220 });
      pad();
      window.addEventListener("resize", pad);
      map.on("remove", () => window.removeEventListener("resize", pad));
      map.touchZoomRotate.disableRotation();
      map.on("moveend", () => renderMarkers());
      map.on("load", () => renderMarkers());
      map.on("click", (e) => {
        if ((e.originalEvent.target as HTMLElement).closest(".holler-pin")) return;
        latest.current.onSelect(null);
      });
      mapRef.current = map;
      renderHome();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Street / satellite
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(props.satellite ? SATELLITE_STYLE : STREET_STYLE);
    map.once("style.load", () => map.setConfig("basemap", BASEMAP));
  }, [props.satellite]);

  // Center on home button
  useEffect(() => {
    if (!props.recenterKey || !mapRef.current) return;
    const target = props.home?.point ?? props.center;
    mapRef.current.flyTo({ center: [target.lng, target.lat], zoom: 14.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.recenterKey]);

  // Redraw pins when data or selection changes
  const index = useRef<Supercluster<PinProps> | null>(null);
  useEffect(() => {
    const sc = new Supercluster<PinProps>({ radius: 48, maxZoom: MAX_ZOOM - 1 });
    sc.load(
      spread(props.pins).map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.pin_lng, p.pin_lat] },
        properties: { proId: p.pro_id, love: p.reaction === "love" },
      }))
    );
    index.current = sc;
    renderMarkers();
  }, [props.pins, props.pros, props.selectedId, props.colors]);

  useEffect(() => {
    renderHome();
  }, [props.home?.point.lat, props.home?.point.lng]);

  function renderHome() {
    const map = mapRef.current;
    const Marker = markerCtorRef.current;
    const home = latest.current.home;
    homeMarkerRef.current?.remove();
    if (!map || !Marker || !home) return;
    const el = document.createElement("div");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "Your home");
    el.className =
      "flex size-10 items-center justify-center rounded-full border-[3px] border-white bg-ink text-[15px] font-bold text-white";
    el.style.boxShadow = "0 0 0 4px #35E07B, 0 4px 10px rgba(26,29,36,0.25)";
    el.textContent = home.initial;
    homeMarkerRef.current = new Marker({ element: el }).setLngLat([home.point.lng, home.point.lat]).addTo(map);
  }

  function renderMarkers() {
    const map = mapRef.current;
    const Marker = markerCtorRef.current;
    const sc = index.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!map || !Marker || !sc) return;

    const { pros, selectedId, onSelect, colors } = latest.current;
    const byId = new Map(pros.map((p) => [p.id, p]));
    const b = map.getBounds();
    if (!b) return;
    const features = sc.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.floor(map.getZoom()));

    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "holler-pin";

      if ("cluster" in f.properties && f.properties.cluster) {
        const count = f.properties.point_count;
        el.setAttribute("aria-label", `${count} neighbors here. Zoom in.`);
        el.className +=
          " flex size-11 items-center justify-center rounded-full border-[3px] border-white bg-neon text-[15px] font-bold text-on-neon shadow-[0_4px_10px_rgba(26,29,36,0.25)]";
        el.textContent = String(count);
        const clusterId = f.properties.cluster_id;
        el.addEventListener("click", () => {
          map.easeTo({ center: [lng, lat], zoom: Math.min(sc.getClusterExpansionZoom(clusterId), MAX_ZOOM) });
        });
      } else {
        const { proId, love } = f.properties as PinProps;
        const pro = byId.get(proId);
        const name = pro?.name ?? "A pro";
        const on = selectedId === proId;
        const faded = selectedId !== null && !on;
        el.setAttribute("aria-label", `${love ? "A neighbor loves" : "A neighbor uses"} ${name}`);
        el.className +=
          " relative flex size-[42px] items-center justify-center rounded-full border-[3px] border-white p-0 text-sm font-bold text-white transition-opacity";
        el.style.background = pro?.logo_url ? `#fff url("${pro.logo_url}") center/cover` : logoColor(name, colors[proId]);
        el.style.boxShadow = on
          ? "0 0 0 3px #35E07B, 0 4px 10px rgba(26,29,36,0.25)"
          : "0 4px 10px rgba(26,29,36,0.25)";
        el.style.opacity = faded ? "0.3" : "1";
        el.style.zIndex = on ? "3" : "1";
        if (!pro?.logo_url) el.textContent = initials(name);
        if (love) {
          const heart = document.createElement("span");
          heart.className =
            "absolute -right-[9px] -top-[9px] size-6 rounded-full bg-white text-center text-[13px] leading-6 shadow-[0_2px_5px_rgba(26,29,36,0.18)]";
          heart.textContent = "❤️";
          heart.setAttribute("aria-hidden", "true");
          el.appendChild(heart);
        }
        el.addEventListener("click", () => onSelect(on ? null : proId));
      }

      // Mapbox overwrites the marker element's opacity and role, so give it a plain wrapper.
      const wrap = document.createElement("div");
      wrap.appendChild(el);
      const marker = new Marker({ element: wrap }).setLngLat([lng, lat]).addTo(map);
      if (el.style.zIndex) wrap.style.zIndex = el.style.zIndex;
      markersRef.current.push(marker);
    }
  }

  // Mapbox makes its container position: relative, so it needs a sized wrapper.
  return (
    <div className="absolute inset-0 z-0">
      <div ref={containerRef} className="holler-map size-full" />
    </div>
  );
}
