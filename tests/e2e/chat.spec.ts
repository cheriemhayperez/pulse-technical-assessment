import { test, expect } from "./fixtures";

test("T7 connected participants exchange chat messages", async ({ pair }) => {
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

  const fromAlice = "Hello from Pulse E2E";
  await chatAlice.getByRole("textbox", { name: "Message" }).fill(fromAlice);
  await chatAlice.getByRole("button", { name: "Send message" }).click();
  await expect(chatAlice.getByText(fromAlice, { exact: true })).toBeVisible();
  await expect(
    chatBob
      .locator(".chat-row")
      .filter({ hasText: fromAlice })
      .locator(".chat-avatar:not(.chat-avatar-me)"),
  ).toBeVisible();

  const fromBob = "Reply from Pulse E2E";
  await chatBob.getByRole("textbox", { name: "Message" }).fill(fromBob);
  await chatBob.getByRole("button", { name: "Send message" }).click();
  await expect(chatBob.getByText(fromBob, { exact: true })).toBeVisible();
  await expect(
    chatAlice
      .locator(".chat-row")
      .filter({ hasText: fromBob })
      .locator(".chat-avatar:not(.chat-avatar-me)"),
  ).toBeVisible();
});
