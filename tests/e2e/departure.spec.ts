import { test, expect } from "./fixtures";

test("T8 clean departure removes the other pin", async ({ pair }) => {
  await pair.enter();
  await expect(pair.alice.page.locator(".pulse-dot")).toHaveCount(1, {
    timeout: 15_000,
  });

  let reportLeave: (payload: string) => void = () => {};
  const leaveSeen = new Promise<string>((resolve) => {
    reportLeave = resolve;
  });
  await pair.bob.page.exposeFunction("__pulseReportLeave", (payload: string) => {
    reportLeave(payload);
  });
  await pair.bob.page.evaluate(() => {
    const orig = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      const body = typeof data === "string" ? data : "";
      void (
        window as Window & { __pulseReportLeave: (s: string) => Promise<void> }
      ).__pulseReportLeave(`${String(url)}\n${body}`);
      return orig(url, data);
    };
  });

  await pair.bob.page.goto("about:blank");
  const payload = await leaveSeen;
  expect(payload).toContain("/api/leave");
  expect(payload).toContain("secret");

  await expect(pair.alice.page.locator(".pulse-dot")).toHaveCount(0, {
    timeout: 8_000,
  });
  await expect(
    pair.alice.page.getByText("You're the only pulse on the globe right now."),
  ).toBeVisible();
});

test("T8 stale presence expires after polling stops", async ({ pair }) => {
  await pair.enter();
  await expect(pair.alice.page.locator(".pulse-dot")).toHaveCount(1, {
    timeout: 15_000,
  });

  await pair.bob.page.route("**/api/poll", (route) => route.abort());

  await expect(pair.alice.page.locator(".pulse-dot")).toHaveCount(0, {
    timeout: 30_000,
  });
});
