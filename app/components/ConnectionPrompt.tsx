"use client";

import { useEffect, useRef, useState } from "react";

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.tabIndex !== -1 && !el.hasAttribute("disabled"));
}

export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  timeoutMs,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  timeoutMs?: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onDeclineRef = useRef(onDecline);
  useEffect(() => {
    onDeclineRef.current = onDecline;
  });

  const [remaining, setRemaining] = useState(
    timeoutMs ? Math.ceil(timeoutMs / 1000) : null,
  );

  useEffect(() => {
    if (!timeoutMs) return;
    const started = Date.now();
    const tick = () => {
      const left = Math.max(0, timeoutMs - (Date.now() - started));
      setRemaining(Math.ceil(left / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timeoutMs]);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    root.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDeclineRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusableIn(root);
      if (nodes.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || active === root || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (
        previouslyFocused?.isConnected &&
        !previouslyFocused.closest("[inert]")
      ) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-night/55 p-6 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pulse-prompt-title"
        tabIndex={-1}
        className="ui-enter w-full max-w-sm rounded-3xl border border-line bg-night-elevated/92 p-7 text-center text-fog shadow-[0_24px_80px_rgba(0,0,0,0.55)] focus:outline-none"
      >
        <h2
          id="pulse-prompt-title"
          className="text-xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fog-muted">
            {subtitle}
          </p>
        )}
        {remaining !== null && (
          <p className="mt-3 text-xs font-medium tabular-nums tracking-wide text-accent">
            {remaining > 0 ? `${remaining}s remaining` : "Timed out"}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-fog-muted transition hover:border-fog/30 hover:text-fog focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {declineLabel}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-night transition hover:bg-accent-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
