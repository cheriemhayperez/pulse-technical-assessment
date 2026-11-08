"use client";

import { useState } from "react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => Promise<void>;
}) {
  const [status, setStatus] = useState<
    "idle" | "locating" | "joining" | "error"
  >("idle");
  const [error, setError] = useState<string>("");

  const busy = status === "locating" || status === "joining";

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("joining");
        void onReady(pos.coords.latitude, pos.coords.longitude).catch(() => {
          setStatus("error");
          setError("Couldn't reach Pulse. Check your connection and try again.");
        });
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const cta =
    status === "locating"
      ? "Finding you…"
      : status === "joining"
        ? "Dropping you in…"
        : "Enter Pulse";

  return (
    <div className="entry-sky relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-fog">
      <div className="entry-orbit" aria-hidden="true" />
      <div className="entry-glow" aria-hidden="true" />

      <div className="ui-enter relative z-10 flex max-w-md flex-col items-center text-center">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Pulse
        </h1>
        <p className="mt-5 max-w-[16.5rem] text-[1.05rem] font-normal leading-snug text-fog-muted sm:max-w-sm sm:text-lg sm:leading-relaxed">
          Meet someone new. See where the moment takes you.
        </p>

        <button
          type="button"
          onClick={enter}
          disabled={busy}
          className="mt-10 min-w-[12.5rem] rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-night shadow-[0_0_32px_rgba(94,234,212,0.18)] transition hover:bg-accent-dim hover:shadow-[0_0_40px_rgba(94,234,212,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
        >
          {cta}
        </button>

        {status === "error" && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="max-w-sm text-sm text-danger">{error}</p>
            <button
              type="button"
              onClick={enter}
              className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-fog transition hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Try again
            </button>
          </div>
        )}

        <p className="mt-8 max-w-sm text-center text-xs leading-relaxed text-fog-muted/90">
          No sign-up. Your dot sits 1–3&nbsp;km from your real location.
          Closing the tab ends everything.
        </p>
      </div>
    </div>
  );
}
