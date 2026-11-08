import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { presenceFromSecret, secretFromRequest } from "@/lib/session";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { MAX_BODY_BYTES, bodyTooLarge, payloadTooLarge } from "@/lib/http";
import { readAsk, readIntent } from "@/lib/intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/intent — Authorization: Bearer <secret>
// Body { intent, ask }. Omitted fields stay as they are; null clears.
export async function POST(request: NextRequest) {
  if (!rateLimit(`intent:${clientIp(request)}`, 30, 60_000)) {
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

  const payload = (body as Record<string, unknown> | null) ?? {};
  const intent = Object.prototype.hasOwnProperty.call(payload, "intent")
    ? readIntent(payload.intent)
    : undefined;
  const ask = Object.prototype.hasOwnProperty.call(payload, "ask")
    ? readAsk(payload.ask)
    : undefined;
  if (intent === "invalid") {
    return Response.json({ error: "invalid intent" }, { status: 400 });
  }
  if (ask === "invalid") {
    return Response.json({ error: "invalid ask" }, { status: 400 });
  }

  const data: { intent?: string | null; ask?: string | null } = {};
  if (intent !== undefined) data.intent = intent;
  if (ask !== undefined) data.ask = ask;

  if (Object.keys(data).length > 0) {
    await prisma.presence.update({
      where: { id: me.id },
      data,
    });
  }

  return Response.json({
    ok: true,
    intent: intent === undefined ? me.intent : intent,
    ask: ask === undefined ? me.ask : ask,
  });
}
