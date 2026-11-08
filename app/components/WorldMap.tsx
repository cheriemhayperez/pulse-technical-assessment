"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";
import { intentBadgeText, isIntentId, publicAsk } from "@/lib/intent";
import { distanceKm, formatDistance } from "@/lib/geo";
import { peekPlaceName, placeName } from "@/lib/place";

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

const PIN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>`;

function syncBadge(
  host: HTMLElement,
  opts: {
    intent: string | null;
    ask: string | null;
    distance: string | null;
    place: string | null;
    isMe: boolean;
  },
) {
  let badge = host.querySelector<HTMLElement>(".pulse-badge");
  const title = isIntentId(opts.intent) ? intentBadgeText(opts.intent) : null;
  const ask = publicAsk(opts.ask);
  const meta = opts.isMe
    ? ["You", opts.place].filter(Boolean).join(" · ")
    : [opts.place, opts.distance ? `${opts.distance} away` : null]
        .filter(Boolean)
        .join(" · ");
  if (!title && !ask && !meta) {
    badge?.remove();
    return;
  }
  const sig = `${title ?? ""}\0${ask ?? ""}\0${meta}\0${opts.isMe ? "1" : "0"}`;
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "pulse-badge";
    host.append(badge);
  } else if (badge.dataset.sig === sig) {
    return;
  }
  badge.dataset.sig = sig;
  badge.replaceChildren();
  if (title) {
    const heading = document.createElement("span");
    heading.className = "pulse-badge-title";
    heading.textContent = title;
    badge.append(heading);
  }
  if (ask) {
    const note = document.createElement("span");
    note.className = "pulse-badge-ask";
    note.textContent = ask;
    badge.append(note);
  }
  if (meta) {
    const row = document.createElement("span");
    row.className = "pulse-badge-meta";
    if (!opts.isMe) row.insertAdjacentHTML("beforeend", PIN_SVG);
    const text = document.createElement("span");
    text.textContent = meta;
    row.append(text);
    badge.append(row);
  }
}

function peerSignature(peers: PeerDot[]): string {
  return peers
    .map(
      (peer) =>
        `${peer.id}|${peer.lat}|${peer.lng}|${Number(peer.busy)}|${peer.intent ?? ""}|${peer.ask ?? ""}`,
    )
    .join(";");
}

export default function WorldMap({
  peers,
  me,
  meIntent,
  meAsk,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  meIntent: string | null;
  meAsk: string | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const peersRef = useRef(peers);
  const [ready, setReady] = useState(false);
  const peerSig = peerSignature(peers);

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  const meRef = useRef(me);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
    meRef.current = me;
    peersRef.current = peers;
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

    const paintMe = (place: string | null) => {
      const marker = meMarkerRef.current;
      if (!marker) return;
      syncBadge(marker.getElement(), {
        intent: meIntent,
        ask: meAsk,
        distance: null,
        place,
        isMe: true,
      });
    };

    const refreshBadge = () => {
      const knownPlace = peekPlaceName(me.lat, me.lng);
      paintMe(knownPlace ?? null);
      if (TOKEN && knownPlace === undefined) {
        void placeName(me.lat, me.lng, TOKEN).then((place) => {
          if (cancelled) return;
          paintMe(place);
        });
      }
    };

    if (meMarkerRef.current) {
      meMarkerRef.current.setLngLat([me.lng, me.lat]);
      refreshBadge();
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || meMarkerRef.current) {
        refreshBadge();
        return;
      }
      const el = document.createElement("div");
      el.className = "pulse-me";
      el.title = "You are here";
      const core = document.createElement("span");
      core.className = "pulse-me-core";
      core.setAttribute("aria-hidden", "true");
      el.append(core);
      meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([me.lng, me.lat])
        .addTo(map);
      refreshBadge();
    })();

    return () => {
      cancelled = true;
    };
  }, [me, meIntent, meAsk, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const markers = markersRef.current;
      const peers = peersRef.current;
      const seen = new Set<string>();
      let mapboxgl: (typeof import("mapbox-gl"))["default"] | null = null;

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          mapboxgl = mapboxgl ?? (await import("mapbox-gl")).default;
          if (cancelled) return;
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
        } else {
          marker.setLngLat([peer.lng, peer.lat]);
        }
        const el = marker.getElement();
        el.classList.toggle("pulse-dot-busy", peer.busy);
        const here = meRef.current;
        const dist =
          here && Number.isFinite(peer.lat) && Number.isFinite(peer.lng)
            ? formatDistance(distanceKm(here, { lat: peer.lat, lng: peer.lng }))
            : "";
        const knownPlace =
          Number.isFinite(peer.lat) && Number.isFinite(peer.lng)
            ? peekPlaceName(peer.lat, peer.lng)
            : null;
        const paintBadge = (place: string | null) => {
          const live = markers.get(peer.id);
          if (!live) return;
          syncBadge(live.getElement(), {
            intent: peer.intent,
            ask: peer.ask,
            distance: dist || null,
            place,
            isMe: false,
          });
        };
        paintBadge(knownPlace ?? null);
        if (
          TOKEN &&
          knownPlace === undefined &&
          Number.isFinite(peer.lat) &&
          Number.isFinite(peer.lng)
        ) {
          void placeName(peer.lat, peer.lng, TOKEN).then((place) => {
            if (cancelled) return;
            paintBadge(place);
          });
        }
        const intent = isIntentId(peer.intent)
          ? intentBadgeText(peer.intent)
          : null;
        const tip = peer.busy
          ? "In a conversation"
          : canConnectRef.current
            ? [
                intent,
                publicAsk(peer.ask),
                dist ? `${dist} away` : null,
                "Tap to preview",
              ]
                .filter(Boolean)
                .join(" · ")
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
  }, [peerSig, ready]);

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
