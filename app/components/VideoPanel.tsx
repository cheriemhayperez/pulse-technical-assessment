"use client";

import { useEffect, useRef } from "react";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.srcObject = localStream;
    return () => {
      el.srcObject = null;
    };
  }, [localStream]);

  useEffect(() => {
    const el = remoteRef.current;
    if (!el) return;
    el.srcObject = remoteStream;
    return () => {
      el.srcObject = null;
    };
  }, [remoteStream]);

  return (
    <div className="ui-enter absolute inset-0 z-30 flex flex-col bg-night">
      <div className="relative min-h-0 flex-1">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="h-full w-full bg-night-mid object-cover"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-fog-muted">
            <span className="size-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
            <p className="text-sm">Waiting for their camera…</p>
          </div>
        )}
        <p className="absolute left-4 top-4 rounded-full border border-line bg-night/70 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-fog-muted backdrop-blur">
          Stranger
        </p>
        <div className="absolute bottom-4 left-4 overflow-hidden rounded-xl border border-line bg-night-elevated shadow-[0_12px_32px_rgba(0,0,0,0.45)] sm:bottom-5 sm:left-5">
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className="h-28 w-20 object-cover sm:h-36 sm:w-24"
          />
          <span className="absolute left-2 top-2 rounded-full bg-night/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fog">
            You
          </span>
        </div>
      </div>
      <div className="flex shrink-0 justify-center border-t border-line bg-night/90 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur">
        <button
          type="button"
          onClick={onEnd}
          className="rounded-full border border-line bg-night-elevated px-8 py-2.5 text-sm font-semibold text-fog transition hover:border-danger/50 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Return to chat
        </button>
      </div>
    </div>
  );
}
