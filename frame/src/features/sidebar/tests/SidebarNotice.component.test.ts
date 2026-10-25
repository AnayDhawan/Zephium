import { expect, test } from "vitest";
import { render } from "vitest-browser-svelte";
import * as notices from "$session/notice.svelte";
import SidebarNotice from "../components/SidebarNotice.svelte";

const HINT = "Right-click a field and choose AutoFill to use your saved passwords";

test("the AutoFill hint stays until it can be read, a copied link goes sooner", async () => {
  const screen = await render(SidebarNotice);

  notices.show("Link copied");
  await expect.element(screen.getByRole("status")).toHaveTextContent("Link copied");
  await expect.poll(() => notices.notice(), { timeout: 3000 }).toBeNull();

  notices.show(HINT, "autofill");
  await expect.element(screen.getByRole("status")).toHaveTextContent(HINT);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  expect(notices.notice()?.kind).toBe("autofill");
  await expect.poll(() => notices.notice(), { timeout: 5000 }).toBeNull();
});
