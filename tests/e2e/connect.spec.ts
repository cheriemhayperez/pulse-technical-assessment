import { test, expect } from "./fixtures";

test("T5 request and accept a connection", async ({ pair }) => {
  await pair.enter();
  await pair.connect();

  const chatAlice = pair.alice.page.getByRole("region", {
    name: "Conversation with stranger",
  });
  const chatBob = pair.bob.page.getByRole("region", {
    name: "Conversation with stranger",
  });
  await expect(chatAlice.getByText("Connected", { exact: true })).toBeVisible();
  await expect(chatBob.getByText("Connected", { exact: true })).toBeVisible();
});

test("T6 leave conversation stays on the map", async ({ pair }) => {
  await pair.enter();
  await pair.connect();

  const chatAlice = pair.alice.page.getByRole("region", {
    name: "Conversation with stranger",
  });
  await chatAlice.getByRole("button", { name: "Leave conversation" }).click();

  await expect(chatAlice).toBeHidden();
  await expect(pair.bob.page.getByText("Stranger disconnected.")).toBeVisible();
  await expect(pair.alice.page.locator(".pulse-me")).toBeVisible();
  await expect(pair.bob.page.locator(".pulse-me")).toBeVisible();
  await expect(pair.alice.page.locator(".pulse-dot")).toHaveCount(1);
  await expect(pair.bob.page.locator(".pulse-dot")).toHaveCount(1);
});

test("T5b declining a request leaves both on the map", async ({ pair }) => {
  await pair.enter();
  await expect(pair.alice.page.locator(".pulse-dot")).toHaveCount(1, {
    timeout: 15_000,
  });

  await pair.alice.page.locator(".pulse-dot").click();
  await pair.alice.page.getByRole("button", { name: "Connect" }).click();
  await expect(pair.alice.page.getByText("Waiting for them…")).toBeVisible();
  await expect(
    pair.bob.page.getByRole("heading", { name: "A stranger wants to connect" }),
  ).toBeVisible();

  await pair.bob.page.getByRole("button", { name: "Not now" }).click();
  await expect(pair.alice.page.getByText("Request declined.")).toBeVisible();

  await expect(
    pair.alice.page.getByRole("region", { name: "Conversation with stranger" }),
  ).toHaveCount(0);
  await expect(
    pair.bob.page.getByRole("region", { name: "Conversation with stranger" }),
  ).toHaveCount(0);
  await expect(pair.alice.page.locator(".pulse-me")).toBeVisible();
  await expect(pair.bob.page.locator(".pulse-me")).toBeVisible();
  await expect(pair.alice.page.locator(".pulse-dot")).toHaveCount(1);
  await expect(pair.bob.page.locator(".pulse-dot")).toHaveCount(1);

  await expect(pair.alice.page.locator(".pulse-dot")).not.toHaveClass(
    /pulse-dot-busy/,
  );
  await pair.alice.page.locator(".pulse-dot").click();
  await pair.alice.page.getByRole("button", { name: "Connect" }).click();
  await expect(
    pair.bob.page.getByRole("heading", { name: "A stranger wants to connect" }),
  ).toBeVisible();
});

