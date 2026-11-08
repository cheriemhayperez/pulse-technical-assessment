import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export function isSessionToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 64;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function newSessionTokens(): { publicId: string; secret: string } {
  return { publicId: randomUUID(), secret: randomUUID() };
}

export function secretFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.length > 7 && auth.slice(0, 7).toLowerCase() === "bearer ") {
    const token = auth.slice(7).trim();
    return isSessionToken(token) ? token : null;
  }
  const header = request.headers.get("x-pulse-session");
  if (header && isSessionToken(header.trim())) return header.trim();
  return null;
}

export async function presenceFromSecret(secret: string) {
  if (!isSessionToken(secret)) return null;
  return prisma.presence.findUnique({
    where: { secretHash: hashSecret(secret) },
  });
}
