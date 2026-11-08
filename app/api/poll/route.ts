import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import type { PollResponse } from "@/lib/types";
import { presenceFromSecret, secretFromRequest } from "@/lib/session";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/poll — Authorization: Bearer <secret>
export async function GET(request: NextRequest) {
  if (!rateLimit(`poll:${clientIp(request)}`, 90, 60_000)) {
    return tooManyRequests();
  }

  const secret = secretFromRequest(request);
  if (!secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const me = await presenceFromSecret(secret);
  if (!me) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  await prisma.presence.updateMany({
    where: { id: me.id },
    data: { lastSeen: new Date(now) },
  });

  await prisma.presence.deleteMany({ where: { lastSeen: { lt: staleCutoff } } });
  await prisma.signal.deleteMany({ where: { createdAt: { lt: signalCutoff } } });

  const peers = await prisma.presence.findMany({
    where: {
      id: { not: me.id },
      lastSeen: { gte: staleCutoff },
    },
    select: { id: true, lat: true, lng: true, busy: true },
  });

  const inbox = await prisma.signal.findMany({
    where: { toId: me.id },
    orderBy: { createdAt: "asc" },
  });
  if (inbox.length > 0) {
    await prisma.signal.deleteMany({
      where: { id: { in: inbox.map((s) => s.id) } },
    });
  }

  const response: PollResponse = {
    peers: peers.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      busy: p.busy,
    })),
    signals: inbox.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      toId: s.toId,
      type: s.type as PollResponse["signals"][number]["type"],
      payload: s.payload,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return Response.json(response);
}
