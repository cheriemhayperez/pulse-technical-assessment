import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { GPS_A, GPS_B, enterPulse } from "./helpers";

export type Participant = {
  context: BrowserContext;
  page: Page;
};

export type Pair = {
  alice: Participant;
  bob: Participant;
  enter(): Promise<void>;
  connect(): Promise<void>;
};

async function enterAndReadSecret(
  page: Page,
  gps: { latitude: number; longitude: number },
  storeSecret: (secret: string) => void,
): Promise<void> {
  const joined = page.waitForResponse(
    (res) => res.url().includes("/api/join") && res.ok(),
  );
  const entered = enterPulse(page, gps);
  const body = (await (await joined).json()) as { secret?: string };
  if (!body.secret) throw new Error("join did not return a session secret");
  storeSecret(body.secret);
  await entered;
}

async function leaveSession(request: APIRequestContext, secret: string | undefined) {
  if (!secret) return;
  await request
    .post("/api/leave", {
      data: { secret },
      headers: { "Content-Type": "application/json" },
    })
    .catch(() => {});
}

export const test = base.extend<{ pair: Pair }>({
  pair: async ({ browser }, use) => {
    const aliceContext = await browser.newContext({
      geolocation: GPS_A,
      permissions: ["geolocation", "camera", "microphone"],
    });
    let bobContext: BrowserContext | undefined;
    let aliceSecret: string | undefined;
    let bobSecret: string | undefined;
    try {
      bobContext = await browser.newContext({
        geolocation: GPS_B,
        permissions: ["geolocation", "camera", "microphone"],
      });
      const alicePage = await aliceContext.newPage();
      const bobPage = await bobContext.newPage();

      const pair: Pair = {
        alice: { context: aliceContext, page: alicePage },
        bob: { context: bobContext, page: bobPage },
        async enter() {
          await enterAndReadSecret(alicePage, GPS_A, (secret) => {
            aliceSecret = secret;
          });
          await enterAndReadSecret(bobPage, GPS_B, (secret) => {
            bobSecret = secret;
          });
        },
        async connect() {
          await expect(alicePage.locator(".pulse-dot")).toHaveCount(1, {
            timeout: 15_000,
          });
          await alicePage.locator(".pulse-dot").click();
          await alicePage.getByRole("button", { name: "Connect" }).click();
          await expect(alicePage.getByText("Waiting for them…")).toBeVisible();
          await expect(
            bobPage.getByRole("heading", { name: "A stranger wants to connect" }),
          ).toBeVisible();
          await bobPage.getByRole("button", { name: "Accept" }).click();
          const chatAlice = alicePage.getByRole("region", {
            name: "Conversation with stranger",
          });
          const chatBob = bobPage.getByRole("region", {
            name: "Conversation with stranger",
          });
          await expect(chatAlice.getByText("Connected", { exact: true })).toBeVisible({
            timeout: 30_000,
          });
          await expect(chatBob.getByText("Connected", { exact: true })).toBeVisible({
            timeout: 30_000,
          });
        },
      };

      await use(pair);
    } finally {
      await leaveSession(aliceContext.request, aliceSecret);
      if (bobContext) await leaveSession(bobContext.request, bobSecret);
      await aliceContext.close();
      await bobContext?.close();
    }
  },
});

export { expect } from "@playwright/test";
