import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidLatLng } from "@/lib/geo";
import { hashSecret, newSessionTokens } from "@/lib/session";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { MAX_BODY_BYTES, bodyTooLarge, payloadTooLarge } from "@/lib/http";
import { readAsk, readIntent } from "@/lib/intent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { lat, lng } (already privacy-offset).
// Issues a public map id plus a private session secret. Does not upsert.
export async function POST(request: NextRequest) {
  if (!rateLimit(`join:${clientIp(request)}`, 20, 60_000)) {
    return tooManyRequests();
  }
  if (bodyTooLarge(request)) return payloadTooLarge();

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return payloadTooLarge();
    body = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const {
    lat,
    lng,
    intent: rawIntent,
    ask: rawAsk,
  } = (body ?? {}) as Record<string, unknown>;
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }
  const intent = readIntent(rawIntent);
  if (intent === "invalid") {
    return Response.json({ error: "invalid intent" }, { status: 400 });
  }
  const ask = readAsk(rawAsk === undefined ? null : rawAsk);
  if (ask === "invalid") {
    return Response.json({ error: "invalid ask" }, { status: 400 });
  }

  const { publicId, secret } = newSessionTokens();

  await prisma.presence.create({
    data: {
      id: publicId,
      secretHash: hashSecret(secret),
      lat: lat as number,
      lng: lng as number,
      busy: false,
      pendingWith: null,
      intent,
      ask,
      lastSeen: new Date(),
    },
  });

  return Response.json({ publicId, secret });
}
