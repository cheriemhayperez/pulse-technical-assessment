"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

const NEAR_BOTTOM_PX = 72;

function Icon({
  children,
  className = "size-4",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  inert = false,
  onSend,
  onStartVideo,
  onEnd,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  inert?: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  function updateStickToBottom() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }

  useEffect(() => {
    if (!stickToBottom.current) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    stickToBottom.current = true;
    onSend(text);
    setDraft("");
  }

  return (
    <section
      aria-label="Conversation with stranger"
      inert={inert}
      className="chat-panel ui-enter absolute z-20 flex flex-col overflow-hidden text-fog inset-x-3 top-auto bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] h-[68vh] max-h-[68vh] rounded-2xl rounded-b-[1.15rem] border border-line bg-night-mid/94 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:inset-x-auto sm:left-auto sm:right-5 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:h-[min(75vh,48rem)] sm:max-h-[min(48rem,calc(100dvh-2rem))] sm:w-[24rem] sm:rounded-2xl"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line/80 px-4 py-3">
        <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight">
              Stranger
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fog-muted">
              <Icon className={`size-3.5 ${connected ? "text-accent" : "text-fog-muted"}`}>
                <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.25" />
              </Icon>
              {connected ? "Connected" : "Connecting…"}
            </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-night transition hover:bg-accent-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:py-1.5"
          >
            <Icon>
              <path d="M15.5 9.5 21 7v10l-5.5-2.5" />
              <rect x="3" y="7" width="12.5" height="10" rx="2.2" />
            </Icon>
            Video
          </button>
          <button
            type="button"
            onClick={onEnd}
            aria-label="Leave conversation"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-medium text-fog-muted transition hover:bg-night/60 hover:text-fog focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-auto sm:w-auto sm:px-2.5 sm:py-1.5"
          >
            <Icon>
              <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h7.4A1.8 1.8 0 0 1 20 5.8v12.4A1.8 1.8 0 0 1 18.2 20h-7.4A1.8 1.8 0 0 1 9 18.2V17" />
              <path d="M4 12h10" />
              <path d="m7 9-3 3 3 3" />
            </Icon>
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        onScroll={updateStickToBottom}
        className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[8rem] flex-col items-center justify-center px-6 text-center">
            <span className="mb-3 flex size-10 items-center justify-center rounded-full border border-line bg-night text-accent">
              <Icon className="size-[18px]">
                <path d="M7 8h10" />
                <path d="M7 12h6" />
                <path d="M5.5 19.5 8 16h9.2A2.8 2.8 0 0 0 20 13.2V7.8A2.8 2.8 0 0 0 17.2 5H6.8A2.8 2.8 0 0 0 4 7.8v9.7Z" />
              </Icon>
            </span>
            <p className="text-sm font-medium tracking-tight text-fog">
              Start the conversation
            </p>
            <p className="mt-1.5 max-w-[16rem] text-xs leading-relaxed text-fog-muted">
              Messages travel peer-to-peer. Nothing is stored when you leave.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`chat-row flex items-end gap-1.5 ${m.mine ? "justify-end" : "justify-start"}`}
              >
                {!m.mine && (
                  <span className="chat-avatar" aria-hidden="true">
                    S
                  </span>
                )}
                <p
                  className={`min-w-0 max-w-[78%] break-words whitespace-pre-wrap px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                    m.mine
                      ? "rounded-2xl rounded-br-md bg-accent text-night"
                      : "rounded-2xl rounded-bl-md border border-line bg-night-elevated/90 text-fog"
                  }`}
                >
                  {m.text}
                </p>
                {m.mine && (
                  <span className="chat-avatar chat-avatar-me" aria-hidden="true">
                    M
                  </span>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={submit}
        className="shrink-0 border-t border-line/80 px-3 py-3"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-night/80 px-2 py-1.5 transition focus-within:border-accent/45 focus-within:ring-1 focus-within:ring-accent/35">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={connected ? "Message" : "Waiting to connect…"}
            disabled={!connected}
            aria-label="Message"
            className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-fog outline-none placeholder:text-fog-muted/70 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!connected || !draft.trim()}
            aria-label="Send message"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-night transition hover:bg-accent-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-night-elevated disabled:text-fog-muted disabled:opacity-70 sm:size-9"
          >
            <Icon className="size-[17px]">
              <path d="m5 12 14-7-4 14-3-5-7-2Z" />
              <path d="m12 14 7-9" />
            </Icon>
          </button>
        </div>
      </form>
    </section>
  );
}
