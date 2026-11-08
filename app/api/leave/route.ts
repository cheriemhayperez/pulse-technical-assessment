import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSessionToken, presenceFromSecret } from "@/lib/session";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { MAX_BODY_BYTES, bodyTooLarge, payloadTooLarge } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { secret }. sendBeacon cannot set headers.
export async function POST(request: NextRequest) {
  if (!rateLimit(`leave:${clientIp(request)}`, 30, 60_000)) {
    return tooManyRequests();
  }
  if (bodyTooLarge(request)) return payloadTooLarge();

  let secret: string | undefined;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return payloadTooLarge();
    secret = text ? (JSON.parse(text)?.secret as string | undefined) : undefined;
  } catch {
    secret = undefined;
  }

  if (!isSessionToken(secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const me = await presenceFromSecret(secret);
  if (!me) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (me.pendingWith) {
    await prisma.presence.updateMany({
      where: { id: me.pendingWith },
      data: { busy: false, pendingWith: null },
    });
  }

  await prisma.signal.deleteMany({
    where: { OR: [{ toId: me.id }, { fromId: me.id }] },
  });
  await prisma.presence.deleteMany({ where: { id: me.id } });

  return Response.json({ ok: true });
}
