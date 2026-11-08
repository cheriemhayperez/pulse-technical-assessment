import type { PollResponse, SignalType } from "@/lib/types";

export async function join(
  lat: number,
  lng: number,
): Promise<{ publicId: string; secret: string }> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  return res.json() as Promise<{ publicId: string; secret: string }>;
}

export async function poll(secret: string): Promise<PollResponse> {
  const res = await fetch("/api/poll", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  secret: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/signal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ toId, type, payload }),
    });
  } catch {
    throw new Error("signal failed: network error");
  }
  if (!res.ok) throw new Error(`signal failed: ${res.status}`);
}

export function leave(secret: string): void {
  const body = JSON.stringify({ secret });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
