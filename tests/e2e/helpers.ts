import { expect, type Page } from "@playwright/test";

export const GPS_A = { latitude: 14.5995, longitude: 120.9842 };
export const GPS_B = { latitude: 14.5547, longitude: 121.0244 };

export async function denyLocation(page: Page) {
  await page.addInitScript(`
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: function (_ok, error) {
          queueMicrotask(function () {
            if (typeof error === "function") {
              error({
                code: 1,
                message: "User denied Geolocation",
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3
              });
            }
          });
        },
        watchPosition: function () { return 0; },
        clearWatch: function () {}
      }
    });
  `);
}

export async function enterPulse(page: Page, gps: { latitude: number; longitude: number }) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation(gps);
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Pulse" }).click();
  await expect(page.locator(".pulse-me")).toBeVisible({ timeout: 20_000 });
}
