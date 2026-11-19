import { type Page } from "@playwright/test";
import { test, expect } from "./fixtures";

async function expectRemoteVideoLive(page: Page) {
  await expect(page.getByRole("button", { name: "Return to chat" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Waiting for their camera…")).toHaveCount(0);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const remote = [...document.querySelectorAll("video")].find(
            (el) => !el.muted,
          );
          const stream = remote?.srcObject;
          if (!remote || !(stream instanceof MediaStream)) return false;
          const live = stream
            .getVideoTracks()
            .some((track) => track.readyState === "live" && track.enabled);
          return live && remote.videoWidth > 0;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

test("T10 connected participants render remote video", async ({ pair }) => {
  test.setTimeout(90_000);
  await pair.enter();
  await pair.connect();

  await pair.alice.page.getByRole("button", { name: "Video" }).click();
  await expect(
    pair.alice.page.getByText("Waiting for stranger to accept video…"),
  ).toBeVisible();
  await expect(
    pair.bob.page.getByRole("heading", { name: "Start video?" }),
  ).toBeVisible();
  await pair.bob.page.getByRole("button", { name: "Start video" }).click();

  await expectRemoteVideoLive(pair.alice.page);
  await expectRemoteVideoLive(pair.bob.page);
});
