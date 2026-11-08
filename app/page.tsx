"use client";

import { useEffect, useRef, useState } from "react";
import EntryGate, { AskField, IntentChips } from "./components/EntryGate";
import WorldMap from "./components/WorldMap";
import ConnectionPrompt from "./components/ConnectionPrompt";
import ChatPanel, { type ChatMessage } from "./components/ChatPanel";
import VideoPanel from "./components/VideoPanel";
import { join, leave, poll, sendSignal, setIntent } from "@/lib/api";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { POLL_INTERVAL_MS } from "@/lib/presence";
import { applyPrivacyOffset, distanceKm, formatDistance } from "@/lib/geo";
import { clipAsk, intentBadgeText, publicAsk, type IntentId } from "@/lib/intent";
import { type PeerDot, type SignalMsg, type SignalType } from "@/lib/types";

type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string }
  | { kind: "incoming"; peerId: string }
  | { kind: "connecting"; peerId: string }
  | { kind: "connected"; peerId: string };

type VideoState = "none" | "requesting" | "incoming" | "active";

const REQUEST_TIMEOUT_MS = 30_000;

export default function Home() {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [session, setSession] = useState<{
    publicId: string;
    secret: string;
  } | null>(null);
  const credsRef = useRef<{ publicId: string; secret: string } | null>(null);
  const presenceSaveGen = useRef(0);
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [myIntent, setMyIntent] = useState<IntentId | null>(null);
  const [myAsk, setMyAsk] = useState("");
  const [previewPeerId, setPreviewPeerId] = useState<string | null>(null);
  const [intentOpen, setIntentOpen] = useState(false);

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const msgId = useRef(0);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3500);
  }

  function addMessage(mine: boolean, text: string) {
    setMessages((prev) => [...prev, { id: msgId.current++, mine, text }]);
  }

  function signal(toId: string, type: SignalType, payload?: string) {
    const secret = credsRef.current?.secret;
    if (!secret) return;
    void sendSignal(secret, toId, type, payload).catch(() => {
      if (type === "request" || type === "accept" || type === "end") {
        showNotice("Couldn't reach Pulse. Try again.");
      }
    });
  }

  function teardown(message?: string) {
    if (requestTimer.current) clearTimeout(requestTimer.current);
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMessages([]);
    setPreviewPeerId(null);
    setConn({ kind: "idle" });
    if (message) showNotice(message);
  }

  function startPeer(peerId: string, initiator: boolean) {
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        signal(peerId, type, payload);
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        if (state === "failed") {
          const c = connRef.current;
          if (c.kind === "connecting" || c.kind === "connected") {
            signal(c.peerId, "end");
          }
          teardown("Connection failed (network).");
        }
      },
      onChannelOpen: () => {
        setConn({ kind: "connected", peerId });
      },
    });
    peerRef.current = ps;
  }

  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          ps.startVideo()
            .then((stream) => {
              if (peerRef.current !== ps || videoRef.current !== "requesting") {
                for (const track of stream.getTracks()) track.stop();
                return;
              }
              setLocalStream(stream);
              setVideo("active");
            })
            .catch((err: unknown) => {
              // Intentional cancel: do not send video-end or show an error.
              if (err instanceof Error && err.name === "VideoCancelled") return;
              setVideo("none");
              ps.sendControl("video-end");
              showNotice("Camera unavailable.");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          setVideo("none");
          showNotice("Video declined.");
        }
        break;
      case "video-end":
        ps?.stopVideo();
        setLocalStream(null);
        setRemoteStream(null);
        setVideo("none");
        break;
    }
  }

  function openPreview(peerId: string) {
    if (connRef.current.kind !== "idle") return;
    setPreviewPeerId(peerId);
  }

  function requestConnection(peerId: string) {
    if (connRef.current.kind !== "idle") return;
    setPreviewPeerId(null);
    setConn({ kind: "requesting", peerId });
    signal(peerId, "request");
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        signal(peerId, "end");
        teardown("No answer.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (connRef.current.kind === "requesting") {
      signal(connRef.current.peerId, "end");
    }
    teardown();
  }

  function acceptIncoming() {
    if (connRef.current.kind !== "incoming") return;
    const peerId = connRef.current.peerId;
    startPeer(peerId, false);
    signal(peerId, "accept");
    setConn({ kind: "connecting", peerId });
  }

  function declineIncoming() {
    if (connRef.current.kind !== "incoming") return;
    signal(connRef.current.peerId, "decline");
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if (c.kind === "connecting" || c.kind === "connected") {
      signal(c.peerId, "end");
    }
    teardown();
  }

  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
  }

  function acceptVideo() {
    const ps = peerRef.current;
    if (!ps) return;
    ps.startVideo()
      .then((stream) => {
        if (peerRef.current !== ps || videoRef.current !== "incoming") {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        setLocalStream(stream);
        ps.sendControl("video-accept");
        setVideo("active");
      })
      .catch((err: unknown) => {
        // Intentional cancel: do not send video-decline or show an error.
        if (err instanceof Error && err.name === "VideoCancelled") return;
        ps.sendControl("video-decline");
        setVideo("none");
        showNotice("Camera unavailable.");
      });
  }

  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  function endVideo() {
    const ps = peerRef.current;
    ps?.stopVideo();
    ps?.sendControl("video-end");
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
  }

  function processSignal(sig: SignalMsg) {
    switch (sig.type) {
      case "request": {
        setPreviewPeerId(null);
        if (connRef.current.kind === "idle") {
          setConn({ kind: "incoming", peerId: sig.fromId });
        } else {
          signal(sig.fromId, "decline");
        }
        break;
      }
      case "accept": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          startPeer(sig.fromId, true);
          setConn({ kind: "connecting", peerId: sig.fromId });
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Request declined.");
        }
        break;
      }
      case "offer":
      case "answer":
      case "ice": {
        const c = connRef.current;
        const peerId =
          c.kind === "connecting" || c.kind === "connected" ? c.peerId : null;
        if (peerRef.current && peerId === sig.fromId) {
          void peerRef.current.handleSignal(
            sig.type as DescType,
            sig.payload ?? "",
          );
        }
        break;
      }
      case "end": {
        const c = connRef.current;
        if (
          (c.kind === "incoming" ||
            c.kind === "connecting" ||
            c.kind === "connected") &&
          c.peerId === sig.fromId
        ) {
          if (c.kind === "incoming") setConn({ kind: "idle" });
          else teardown("Stranger disconnected.");
        }
        break;
      }
    }
  }

  const processSignalRef = useRef(processSignal);
  useEffect(() => {
    processSignalRef.current = processSignal;
  });

  useEffect(() => {
    if (phase !== "live" || !session) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await poll(session.secret);
        if (!active) return;
        setPeers(data.peers);
        for (const s of data.signals) processSignalRef.current(s);
      } catch {}
      if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, session]);

  useEffect(() => {
    if (!session || phase !== "live") return;
    const secret = session.secret;
    const onLeave = () => leave(secret);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [session, phase]);

  async function handleReady(
    lat: number,
    lng: number,
    intent: IntentId | null,
    ask: string | null,
  ) {
    const offset = applyPrivacyOffset(lat, lng);
    setMyLocation(offset);
    setMyIntent(intent);
    setMyAsk(ask ?? "");
    const creds = await join(offset.lat, offset.lng, intent, ask);
    credsRef.current = creds;
    setSession(creds);
    setPhase("live");
  }

  async function savePresence(nextIntent: IntentId | null, nextAsk: string) {
    const secret = credsRef.current?.secret;
    if (!secret) return;
    const ask = nextAsk.trim() ? clipAsk(nextAsk.trim()) : null;
    const prevIntent = myIntent;
    const prevAsk = myAsk;
    const gen = ++presenceSaveGen.current;
    setMyIntent(nextIntent);
    setMyAsk(ask ?? "");
    try {
      await setIntent(secret, nextIntent, ask);
    } catch {
      if (gen !== presenceSaveGen.current) return;
      setMyIntent(prevIntent);
      setMyAsk(prevAsk);
      showNotice("Couldn't update that. Try again.");
    }
  }

  const previewPeer = previewPeerId
    ? peers.find((p) => p.id === previewPeerId)
    : undefined;

  function previewSubtitle(peer: PeerDot | undefined): string {
    const lines: string[] = [];
    const badge = intentBadgeText(peer?.intent);
    if (badge) lines.push(badge);
    const ask = publicAsk(peer?.ask);
    if (ask) lines.push(`“${ask}”`);
    if (peer && myLocation) {
      const dist = formatDistance(
        distanceKm(myLocation, { lat: peer.lat, lng: peer.lng }),
      );
      if (dist) lines.push(`📍 ${dist} away`);
    }
    lines.push(
      "Connect for a private, peer-to-peer chat. They won’t see your exact location.",
    );
    return lines.join("\n");
  }

  const inChat = conn.kind === "connecting" || conn.kind === "connected";

  if (phase === "gate") {
    return <EntryGate onReady={handleReady} />;
  }

  return (
    <main className="fixed inset-0 overflow-hidden">
      <WorldMap
        peers={peers}
        me={myLocation}
        meIntent={myIntent}
        meAsk={myAsk || null}
        onPeerClick={openPreview}
        canConnect={conn.kind === "idle"}
      />

      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-5">
        <button
          type="button"
          aria-expanded={intentOpen}
          aria-label="Change why you are here"
          onClick={() => setIntentOpen((open) => !open)}
          className="rounded-full border border-line bg-night-elevated/90 px-3 py-1.5 text-xs font-medium text-fog shadow-lg backdrop-blur-md transition hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {intentBadgeText(myIntent) ?? "Why are you here?"}
        </button>
        {intentOpen && (
          <div className="absolute right-0 mt-2 w-[min(calc(100vw-1.5rem),20rem)] rounded-2xl border border-line bg-night-elevated/95 p-3 shadow-xl backdrop-blur-md">
            <p className="px-1 text-xs text-fog-muted">
              Optional. Tap again to clear.
            </p>
            <IntentChips
              value={myIntent}
              onChange={(next) => {
                void savePresence(next, myAsk);
              }}
            />
            <AskField
              value={myAsk}
              onChange={setMyAsk}
              onCommit={(next) => {
                void savePresence(myIntent, next);
              }}
            />
          </div>
        )}
      </div>

      {notice && (
        <div className="ui-enter pointer-events-none absolute left-1/2 top-4 z-30 w-[min(calc(100%-2rem),24rem)] -translate-x-1/2 rounded-full border border-line bg-night-elevated/92 px-4 py-2 text-center text-sm text-fog shadow-lg backdrop-blur-md sm:top-5">
          {notice}
        </div>
      )}

      {previewPeerId && conn.kind === "idle" && (
        <ConnectionPrompt
          title="Connect?"
          subtitle={previewSubtitle(previewPeer)}
          acceptLabel="Connect"
          declineLabel="Not now"
          onAccept={() => {
            const id = previewPeerId;
            setPreviewPeerId(null);
            if (id) requestConnection(id);
          }}
          onDecline={() => setPreviewPeerId(null)}
        />
      )}

      {conn.kind === "requesting" && (
        <RequestingBanner
          onCancel={cancelRequest}
          timeoutMs={REQUEST_TIMEOUT_MS}
        />
      )}

      {conn.kind === "incoming" && (
        <ConnectionPrompt
          title="A stranger wants to connect"
          subtitle="Accept to open a private, peer-to-peer chat. They won’t see your exact location."
          acceptLabel="Accept"
          declineLabel="Not now"
          timeoutMs={REQUEST_TIMEOUT_MS}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      {inChat && (
        <ChatPanel
          messages={messages}
          connected={conn.kind === "connected"}
          videoBusy={video !== "none"}
          inert={video === "active"}
          onSend={(text) => {
            peerRef.current?.sendChat(text);
            addMessage(true, text);
          }}
          onStartVideo={startVideoRequest}
          onEnd={endConnection}
        />
      )}

      {video === "requesting" && (
        <div className="ui-enter absolute left-1/2 z-30 w-[min(calc(100%-2rem),24rem)] -translate-x-1/2 rounded-full border border-line bg-night-elevated/92 px-4 py-2 text-center text-sm text-fog shadow-lg backdrop-blur-md bottom-[calc(68vh+1.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-8 sm:w-auto">
          Waiting for stranger to accept video…
        </div>
      )}

      {video === "incoming" && (
        <ConnectionPrompt
          title="Start video?"
          subtitle="They’d like to turn on camera and microphone. You can return to chat anytime."
          acceptLabel="Start video"
          declineLabel="Stay in chat"
          onAccept={acceptVideo}
          onDecline={declineVideo}
        />
      )}

      {video === "active" && (
        <VideoPanel
          localStream={localStream}
          remoteStream={remoteStream}
          onEnd={endVideo}
        />
      )}
    </main>
  );
}

function RequestingBanner({
  onCancel,
  timeoutMs,
}: {
  onCancel: () => void;
  timeoutMs: number;
}) {
  const [seconds, setSeconds] = useState(() => Math.ceil(timeoutMs / 1000));

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((timeoutMs - (Date.now() - started)) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timeoutMs]);

  return (
    <div className="ui-enter absolute left-1/2 top-[4.75rem] z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-night-elevated/92 px-4 py-2 text-sm text-fog shadow-lg backdrop-blur-md">
      <span className="size-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
      <span>
        Waiting for them…{" "}
        <span className="tabular-nums text-fog-muted">{seconds}s</span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full px-2.5 py-1 text-xs text-fog-muted transition hover:text-fog focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Cancel
      </button>
    </div>
  );
}
