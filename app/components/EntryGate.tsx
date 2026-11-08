"use client";

import { useId, useState } from "react";
import { ASK_MAX, clipAsk, INTENTS, type IntentId } from "@/lib/intent";

export default function EntryGate({
  onReady,
}: {
  onReady: (
    lat: number,
    lng: number,
    intent: IntentId | null,
    ask: string | null,
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<
    "idle" | "locating" | "joining" | "error"
  >("idle");
  const [error, setError] = useState<string>("");
  const [intent, setIntent] = useState<IntentId | null>(null);
  const [ask, setAsk] = useState("");

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
        void onReady(
          pos.coords.latitude,
          pos.coords.longitude,
          intent,
          ask.trim() ? clipAsk(ask.trim()) : null,
        ).catch(() => {
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

      <div className="ui-enter relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          Pulse
        </h1>
        <p className="mt-5 max-w-[16.5rem] text-[1.05rem] font-normal leading-snug text-fog-muted sm:max-w-sm sm:text-lg sm:leading-relaxed">
          Meet someone new. See where the moment takes you.
        </p>

        <h2 className="mt-10 text-base font-semibold tracking-tight sm:text-lg">
          Why are you here today?
        </h2>
        <p className="mt-1.5 text-sm text-fog-muted">
          Choose what brings you to Pulse.
        </p>

        <IntentChips value={intent} onChange={setIntent} disabled={busy} />
        <AskField value={ask} onChange={setAsk} disabled={busy} />

        <button
          type="button"
          onClick={enter}
          disabled={busy}
          className="mt-8 min-w-[12.5rem] rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-night shadow-[0_0_32px_rgba(94,234,212,0.18)] transition hover:bg-accent-dim hover:shadow-[0_0_40px_rgba(94,234,212,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
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

        <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-fog-muted/90">
          Your choice is optional. You can change it anytime.
        </p>
        <p className="mt-2 text-center text-[11px] tracking-wide text-fog-muted/80">
          Anonymous · No accounts · Just connections
        </p>
      </div>
    </div>
  );
}

export function IntentChips({
  value,
  onChange,
  disabled = false,
  allowClear = true,
}: {
  value: IntentId | null;
  onChange: (next: IntentId | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  return (
    <div className="mt-5 grid w-full grid-cols-2 gap-2 text-left">
      {INTENTS.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() =>
              onChange(allowClear && selected ? null : item.id)
            }
            className={`flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60 ${
              selected
                ? "border-accent bg-accent/10 text-fog"
                : "border-line bg-night-elevated/70 text-fog-muted hover:border-accent/35 hover:text-fog"
            }`}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <span className="min-w-0 leading-snug">{item.label}</span>
            {selected && (
              <span className="ml-auto size-1.5 shrink-0 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function AskField({
  value,
  onChange,
  disabled = false,
  onCommit,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  onCommit?: (next: string) => void;
}) {
  const count = Array.from(value).length;
  const countId = useId();
  return (
    <label className="mt-3 flex w-full flex-col gap-1.5 text-left">
      <span className="px-0.5 text-xs text-fog-muted">
        Ask something{" "}
        <span className="text-fog-muted/80">(optional)</span>
      </span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        maxLength={ASK_MAX}
        placeholder="Need a vet?"
        aria-describedby={countId}
        onChange={(e) => onChange(clipAsk(e.target.value))}
        onBlur={() => onCommit?.(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit?.(value);
          }
        }}
        className="w-full rounded-2xl border border-line bg-night-elevated/70 px-3 py-2.5 text-sm text-fog placeholder:text-fog-muted/55 outline-none transition focus:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      />
      <span
        id={countId}
        className={`self-end text-[11px] tabular-nums ${
          count >= ASK_MAX ? "text-accent" : "text-fog-muted/80"
        }`}
      >
        {count}/{ASK_MAX}
      </span>
    </label>
  );
}
