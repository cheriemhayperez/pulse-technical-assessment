import { test, expect } from "@playwright/test";
import { denyLocation } from "./helpers";

test("T1 welcome screen shows Pulse and Enter Pulse", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pulse", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why are you here today?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Help" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter Pulse" })).toBeVisible();
});

test("T2 denied location stays on the welcome screen", async ({ page }) => {
  await denyLocation(page);
  await page.goto("/");
  const enter = page.getByRole("button", { name: "Enter Pulse" });
  await expect(enter).toBeEnabled();
  await enter.click();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({
    timeout: 8_000,
  });
  await expect(
    page.getByText("Location permission is required to place you on the map."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pulse", exact: true })).toBeVisible();
});
