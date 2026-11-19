import { GPS_A, enterPulse } from "./helpers";
import { test, expect } from "./fixtures";

test("T3 join shows my pin on the map", async ({ page }) => {
  await enterPulse(page, GPS_A);
  await expect(page.locator(".pulse-me")).toBeVisible();
  await expect(
    page.getByText("You're the only pulse on the globe right now."),
  ).toBeVisible();
});

test("T4 two sessions see each other", async ({ pair }) => {
  await pair.enter();
  await expect(pair.alice.page.locator(".pulse-dot")).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(pair.bob.page.locator(".pulse-dot")).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(pair.alice.page.locator(".pulse-me")).toBeVisible();
  await expect(pair.bob.page.locator(".pulse-me")).toBeVisible();
});
