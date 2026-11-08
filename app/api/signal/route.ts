import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SignalType } from "@/lib/types";
import {
  isSessionToken,
  presenceFromSecret,
  secretFromRequest,
} from "@/lib/session";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { MAX_BODY_BYTES, bodyTooLarge, payloadTooLarge } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 64 * 1024;

export async function POST(request: NextRequest) {
  if (!rateLimit(`signal:${clientIp(request)}`, 120, 60_000)) {
    return tooManyRequests();
  }
  if (bodyTooLarge(request)) return payloadTooLarge();

  const secret = secretFromRequest(request);
  if (!secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const me = await presenceFromSecret(secret);
  if (!me) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return payloadTooLarge();
    body = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { toId, type, payload } = (body ?? {}) as Record<string, unknown>;

  if (!isSessionToken(toId) || toId === me.id) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }
  if (
    payload !== undefined &&
    payload !== null &&
    (typeof payload !== "string" || payload.length > MAX_PAYLOAD)
  ) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  const signalType = type as SignalType;
  const payloadStr = typeof payload === "string" ? payload : null;
  const fromId = me.id;

  const target = await prisma.presence.findUnique({ where: { id: toId } });

  if (signalType === "request") {
    if (!target) {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }
    if (me.busy || me.pendingWith || target.busy || target.pendingWith) {
      await sendDecline(toId, fromId);
      return Response.json({ ok: true, autoDeclined: true });
    }
    await prisma.presence.update({
      where: { id: fromId },
      data: { pendingWith: toId },
    });
    await prisma.presence.update({
      where: { id: toId },
      data: { pendingWith: fromId },
    });
  } else if (signalType === "accept") {
    if (!target || !paired(me, target) || me.busy) {
      return Response.json({ error: "invalid session" }, { status: 409 });
    }
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: true },
    });
  } else if (signalType === "decline" || signalType === "end") {
    if (!target || !paired(me, target)) {
      return Response.json({ ok: true });
    }
    await prisma.presence.updateMany({
      where: { id: { in: [fromId, toId] } },
      data: { busy: false, pendingWith: null },
    });
  } else if (
    signalType === "offer" ||
    signalType === "answer" ||
    signalType === "ice"
  ) {
    if (!target || !paired(me, target) || !me.busy || !target.busy) {
      return Response.json({ error: "invalid session" }, { status: 409 });
    }
  }

  await prisma.signal.create({
    data: { fromId, toId, type: signalType, payload: payloadStr },
  });

  return Response.json({ ok: true });
}

function paired(
  a: { id: string; pendingWith: string | null },
  b: { id: string; pendingWith: string | null },
): boolean {
  return a.pendingWith === b.id && b.pendingWith === a.id;
}

async function sendDecline(targetId: string, initiatorId: string) {
  await prisma.signal.create({
    data: {
      fromId: targetId,
      toId: initiatorId,
      type: "decline",
      payload: null,
    },
  });
}
