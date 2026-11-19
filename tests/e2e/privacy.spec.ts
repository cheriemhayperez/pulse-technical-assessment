import { test, expect } from "./fixtures";
import { GPS_A } from "./helpers";

function haversineMeters(
  original: { latitude: number; longitude: number },
  published: { lat: number; lng: number },
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(published.lat - original.latitude);
  const dLng = toRad(published.lng - original.longitude);
  const lat1 = toRad(original.latitude);
  const lat2 = toRad(published.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

test("T9 public presence is offset 1–3 km from the true location", async ({
  pair,
}) => {
  const joinRequest = pair.alice.page.waitForRequest(
    (req) => req.url().includes("/api/join") && req.method() === "POST",
  );
  const bobJoined = pair.bob.page.waitForResponse(
    (res) => res.url().includes("/api/join") && res.ok(),
  );
  await pair.enter();

  const posted = JSON.parse((await joinRequest).postData() || "{}") as {
    lat?: number;
    lng?: number;
  };
  expect(typeof posted.lat).toBe("number");
  expect(typeof posted.lng).toBe("number");
  expect(posted.lat).not.toBe(GPS_A.latitude);
  expect(posted.lng).not.toBe(GPS_A.longitude);

  const bob = (await (await bobJoined).json()) as { secret: string };
  const pollRes = await pair.bob.context.request.get("/api/poll", {
    headers: { Authorization: `Bearer ${bob.secret}` },
  });
  expect(pollRes.status()).toBe(200);
  const pollBody = (await pollRes.json()) as {
    peers: { id: string; lat: number; lng: number }[];
  };
  expect(pollBody.peers).toHaveLength(1);
  const published = pollBody.peers[0];
  expect(published.lat).toBe(posted.lat);
  expect(published.lng).toBe(posted.lng);

  const meters = haversineMeters(GPS_A, published);
  expect(meters).toBeGreaterThanOrEqual(1_000);
  expect(meters).toBeLessThanOrEqual(3_000);

  const publicJson = JSON.stringify(pollBody);
  expect(publicJson).not.toContain(String(GPS_A.latitude));
  expect(publicJson).not.toContain(String(GPS_A.longitude));

  await expect(pair.bob.page.locator(".pulse-dot")).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(pair.alice.page.locator(".pulse-me")).toBeVisible();
});
