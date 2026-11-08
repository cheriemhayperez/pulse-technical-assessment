// Reverse-geocode the privacy-offset pin only. Uses the same public Mapbox
// token already required for the map. Asks for city/locality names, never
// streets or addresses.

const FAIL_RETRY_MS = 60_000;

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
const retryAfter = new Map<string, number>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function featureText(feature: unknown): string | null {
  if (!feature || typeof feature !== "object") return null;
  const text = (feature as { text?: unknown }).text;
  if (typeof text !== "string") return null;
  const name = text.trim();
  return name.length > 0 && name.length <= 48 ? name : null;
}

function featureTypes(feature: unknown): string[] {
  if (!feature || typeof feature !== "object") return [];
  const types = (feature as { place_type?: unknown }).place_type;
  return Array.isArray(types)
    ? types.filter((item): item is string => typeof item === "string")
    : [];
}

async function lookup(
  lat: number,
  lng: number,
  token: string,
  type: "place" | "locality",
): Promise<string | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("types", type);
  url.searchParams.set("limit", "1");
  const res = await fetch(url);
  if (!res.ok) return null;
  return readPlace(await res.json());
}

function readPlace(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const place =
    features.find((feature) => featureTypes(feature).includes("place")) ??
    features.find((feature) => featureTypes(feature).includes("locality")) ??
    features[0];
  return featureText(place);
}

export function peekPlaceName(lat: number, lng: number): string | null | undefined {
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key);
  const wait = retryAfter.get(key);
  if (wait && wait > Date.now()) return null;
  return undefined;
}

export async function placeName(
  lat: number,
  lng: number,
  token: string,
): Promise<string | null> {
  if (!token || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key) ?? null;
  const wait = retryAfter.get(key);
  if (wait && wait > Date.now()) return null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const name =
        (await lookup(lat, lng, token, "place")) ??
        (await lookup(lat, lng, token, "locality"));
      cache.set(key, name);
      retryAfter.delete(key);
      return name;
    } catch {
      retryAfter.set(key, Date.now() + FAIL_RETRY_MS);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}
