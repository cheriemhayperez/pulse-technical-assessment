import type { NextRequest } from "next/server";

export const MAX_BODY_BYTES = 70 * 1024;

export function bodyTooLarge(request: NextRequest): boolean {
  const header = request.headers.get("content-length");
  if (!header) return false;
  const size = Number(header);
  return Number.isFinite(size) && size > MAX_BODY_BYTES;
}

export function payloadTooLarge() {
  return Response.json({ error: "payload too large" }, { status: 413 });
}
