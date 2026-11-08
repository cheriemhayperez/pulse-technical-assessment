import type { NextRequest } from "next/server";

type Bucket = { remaining: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Returns false when the caller should receive 429. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { remaining: limit - 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [id, bucket] of buckets) {
        if (now >= bucket.resetAt) buckets.delete(id);
      }
    }
    return true;
  }
  if (current.remaining <= 0) return false;
  current.remaining -= 1;
  return true;
}

export function tooManyRequests() {
  return Response.json({ error: "rate limited" }, { status: 429 });
}
