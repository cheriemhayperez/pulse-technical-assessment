import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { GPS_A, GPS_B } from "./helpers";

const UNAUTHORIZED = { error: "unauthorized" };

function bearer(secret: string) {
  return { Authorization: `Bearer ${secret}` };
}

async function join(
  request: APIRequestContext,
  gps: { latitude: number; longitude: number },
) {
  const res = await request.post("/api/join", {
    data: { lat: gps.latitude, lng: gps.longitude },
  });
  expect(res.status()).toBe(200);
  return res.json() as Promise<{ publicId: string; secret: string }>;
}

async function leaveOwned(request: APIRequestContext, secret: string | undefined) {
  if (!secret) return;
  await request.post("/api/leave", { data: { secret } });
}

test("O1 poll, signal, and leave reject missing, invalid, or unknown secrets", async ({
  request,
}) => {
  const invalid = "x";
  const unknown = randomUUID();

  const pollMissing = await request.get("/api/poll");
  expect(pollMissing.status()).toBe(401);
  expect(await pollMissing.json()).toEqual(UNAUTHORIZED);

  const pollInvalid = await request.get("/api/poll", {
    headers: bearer(invalid),
  });
  expect(pollInvalid.status()).toBe(401);
  expect(await pollInvalid.json()).toEqual(UNAUTHORIZED);

  const pollUnknown = await request.get("/api/poll", {
    headers: bearer(unknown),
  });
  expect(pollUnknown.status()).toBe(401);
  expect(await pollUnknown.json()).toEqual(UNAUTHORIZED);

  const signalMissing = await request.post("/api/signal", {
    data: { toId: randomUUID(), type: "request" },
  });
  expect(signalMissing.status()).toBe(401);
  expect(await signalMissing.json()).toEqual(UNAUTHORIZED);

  const signalInvalid = await request.post("/api/signal", {
    headers: bearer(invalid),
    data: { toId: randomUUID(), type: "request" },
  });
  expect(signalInvalid.status()).toBe(401);
  expect(await signalInvalid.json()).toEqual(UNAUTHORIZED);

  const signalUnknown = await request.post("/api/signal", {
    headers: bearer(unknown),
    data: { toId: randomUUID(), type: "request" },
  });
  expect(signalUnknown.status()).toBe(401);
  expect(await signalUnknown.json()).toEqual(UNAUTHORIZED);

  // Leave authenticates from JSON { secret }, not Bearer.
  const leaveMissing = await request.post("/api/leave", { data: {} });
  expect(leaveMissing.status()).toBe(401);
  expect(await leaveMissing.json()).toEqual(UNAUTHORIZED);

  const leaveInvalid = await request.post("/api/leave", {
    data: { secret: invalid },
  });
  expect(leaveInvalid.status()).toBe(401);
  expect(await leaveInvalid.json()).toEqual(UNAUTHORIZED);

  const leaveUnknown = await request.post("/api/leave", {
    data: { secret: unknown },
  });
  expect(leaveUnknown.status()).toBe(401);
  expect(await leaveUnknown.json()).toEqual(UNAUTHORIZED);
});

test("O2 a session secret only authenticates its own presence", async ({
  request,
}) => {
  let alice: { publicId: string; secret: string } | undefined;
  let bob: { publicId: string; secret: string } | undefined;
  try {
    alice = await join(request, GPS_A);
    bob = await join(request, GPS_B);
    expect(alice.publicId).not.toBe(bob.publicId);
    expect(alice.secret).not.toBe(bob.secret);

    const bobPoll = await request.get("/api/poll", {
      headers: bearer(bob.secret),
    });
    expect(bobPoll.status()).toBe(200);
    const bobBody = (await bobPoll.json()) as {
      peers: { id: string }[];
      signals: { fromId: string; toId: string; type: string }[];
      secret?: unknown;
      publicId?: unknown;
    };
    expect(bobBody.secret).toBeUndefined();
    expect(JSON.stringify(bobBody)).not.toContain(alice.secret);
    expect(JSON.stringify(bobBody)).not.toContain(bob.secret);
    expect(bobBody.peers.map((p) => p.id)).toContain(alice.publicId);
    expect(bobBody.peers.map((p) => p.id)).not.toContain(bob.publicId);
    expect(bobBody.signals).toEqual([]);

    const signal = await request.post("/api/signal", {
      headers: bearer(alice.secret),
      data: {
        toId: bob.publicId,
        type: "request",
        fromId: bob.publicId,
      },
    });
    expect(signal.status()).toBe(200);

    const bobInbox = await request.get("/api/poll", {
      headers: bearer(bob.secret),
    });
    expect(bobInbox.status()).toBe(200);
    const inbox = (await bobInbox.json()) as {
      signals: { fromId: string; toId: string; type: string }[];
    };
    expect(inbox.signals).toHaveLength(1);
    expect(inbox.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: alice.publicId,
          toId: bob.publicId,
          type: "request",
        }),
      ]),
    );

    const alicePoll = await request.get("/api/poll", {
      headers: bearer(alice.secret),
    });
    expect(alicePoll.status()).toBe(200);
    const aliceInbox = (await alicePoll.json()) as {
      signals: { toId: string }[];
    };
    expect(aliceInbox.signals).toEqual([]);

    const bobLeave = await request.post("/api/leave", {
      data: { secret: bob.secret },
    });
    expect(bobLeave.status()).toBe(200);

    const aliceAfter = await request.get("/api/poll", {
      headers: bearer(alice.secret),
    });
    expect(aliceAfter.status()).toBe(200);
    const aliceAfterBody = (await aliceAfter.json()) as {
      peers: { id: string }[];
    };
    expect(aliceAfterBody.peers.map((p) => p.id)).not.toContain(bob.publicId);

    const bobAfter = await request.get("/api/poll", {
      headers: bearer(bob.secret),
    });
    expect(bobAfter.status()).toBe(401);
    expect(await bobAfter.json()).toEqual(UNAUTHORIZED);
  } finally {
    await leaveOwned(request, alice?.secret);
    await leaveOwned(request, bob?.secret);
  }
});
