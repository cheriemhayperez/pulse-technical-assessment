"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "pk.eyJ1IjoicHVsc2UtbWFwIiwiYSI6ImNrMDBkZW1vMDAwMDAwMDAifQ.AAAAAAAAAAAAAAAAAAAAAA";

function dotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

/** Nudge dark-v11 so land, water, borders, and labels read more clearly. */
function applyNightGlobeStyle(map: MapboxMap) {
  type PaintProp = Parameters<MapboxMap["setPaintProperty"]>[1];
  type PaintValue = Parameters<MapboxMap["setPaintProperty"]>[2];
  const setPaint = (id: string, prop: PaintProp, value: PaintValue) => {
    if (!map.getLayer(id)) return;
    try {
      map.setPaintProperty(id, prop, value);
    } catch {
      // Layer exists but does not accept this paint property.
    }
  };

  setPaint("background", "background-color", "#1a2740");
  setPaint("national-park", "fill-color", "#22314c");
  setPaint("landuse", "fill-color", "#243450");
  setPaint("land-structure-polygon", "fill-color", "#2a3b58");
  setPaint("building", "fill-color", "#2c3e5c");
  setPaint("water", "fill-color", "#0c1a32");
  setPaint("waterway", "line-color", "#1e4a72");

  setPaint("admin-0-boundary", "line-color", "#8eb0d4");
  setPaint("admin-0-boundary", "line-opacity", 0.75);
  setPaint("admin-0-boundary-bg", "line-color", "#0b1220");
  setPaint("admin-1-boundary", "line-color", "#6d8fb3");
  setPaint("admin-1-boundary", "line-opacity", 0.55);

  const labelIds = [
    "country-label",
    "state-label",
    "settlement-major-label",
    "settlement-minor-label",
    "settlement-subdivision-label",
    "continent-label",
    "water-point-label",
    "water-line-label",
    "waterway-label",
    "natural-point-label",
    "airport-label",
    "poi-label",
  ];
  for (const id of labelIds) {
    setPaint(id, "text-color", "#e4eef8");
    setPaint(id, "text-halo-color", "rgba(8, 14, 26, 0.92)");
    setPaint(id, "text-halo-width", 1.15);
  }

  try {
    map.setFog({
      color: "rgb(10, 16, 28)",
      "high-color": "rgb(18, 28, 48)",
      "horizon-blend": 0.06,
      "space-color": "rgb(5, 8, 16)",
      "star-intensity": 0,
    });
  } catch {
    // Fog is optional; older styles may not support it.
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function moveMap(
  map: MapboxMap,
  opts: { center: [number, number]; zoom?: number },
) {
  if (prefersReducedMotion()) {
    map.jumpTo(opts);
    return;
  }
  map.flyTo({ ...opts, essential: false });
}

function controlButton(label: string, inner: string, onClick: () => void) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = inner;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function attachViewButtons(map: MapboxMap, getMe: () => { lat: number; lng: number } | null) {
  const group = map
    .getContainer()
    .querySelector(".mapboxgl-ctrl-top-left .mapboxgl-ctrl-group");
  if (!group) return;

  group.append(
    controlButton(
      "Back to my location",
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>`,
      () => {
        const here = getMe();
        if (!here) return;
        moveMap(map, { center: [here.lng, here.lat] });
      },
    ),
    controlButton(
      "Show the world",
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>`,
      () => {
            moveMap(map, { center: [0, 20], zoom: 1.55 });
      },
    ),
  );
}

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  const meRef = useRef(me);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
    meRef.current = me;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 3.2 : 1.5,
        attributionControl: false,
      });
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }),
        "top-left",
      );
      map.addControl(new mapboxgl.AttributionControl(), "bottom-right");
      attachViewButtons(map, () => meRef.current);
      map.on("load", () => {
        if (cancelled) return;
        applyNightGlobeStyle(map);
        setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // `me` is only read for the initial center; we don't want to re-init on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show / move the user's own "you are here" pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title = "You are here";
        const core = document.createElement("span");
        core.className = "pulse-me-core";
        core.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.className = "pulse-me-label";
        label.textContent = "You";
        el.append(core, label);
        meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.style.setProperty("--dot-color", dotColor(peer.id));
          el.setAttribute("data-tip", "Stranger · Tap to connect");
          el.setAttribute("aria-label", "Stranger · Tap to connect");
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!canConnectRef.current) return;
            if (el.classList.contains("pulse-dot-busy")) return;
            onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        }
        const el = marker.getElement();
        el.classList.toggle("pulse-dot-busy", peer.busy);
        const tip = peer.busy
          ? "In a conversation"
          : canConnectRef.current
            ? "Stranger · Tap to connect"
            : "You're already in a conversation";
        el.setAttribute("data-tip", tip);
        el.setAttribute("aria-label", tip);
        el.removeAttribute("title");
        el.style.opacity = peer.busy ? "0.4" : "1";
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-night" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md rounded-lg border border-line bg-night-elevated p-4 text-sm text-fog">
            Set{" "}
            <code className="text-accent">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the map.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-4 sm:top-[4.75rem]">
        {peers.length === 0 ? (
          <div className="pointer-events-auto max-w-sm rounded-full border border-line bg-night-elevated/88 px-4 py-2 text-center text-xs leading-relaxed text-fog-muted shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
            You&apos;re the only pulse on the globe right now. Stay — others
            appear as they join.
          </div>
        ) : null}
      </div>
    </div>
  );
}
