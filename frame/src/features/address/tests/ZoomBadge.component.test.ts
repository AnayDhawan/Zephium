import { beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import ZoomBadge from "../components/ZoomBadge.svelte";

const native = vi.hoisted(() => ({ commands: [] as string[] }));

vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({
    runCommand: async (id: string) => {
      native.commands.push(id);
      return { accepted: true, operation_id: null };
    },
  });
});

beforeEach(() => {
  native.commands = [];
});

test("names the page's zoom on the glass", async () => {
  const screen = await render(ZoomBadge, { percent: 125, standard: 100 });
  const badge = screen.getByRole("button", { name: "Page zoom, 125%" });
  await expect.element(badge).toBeVisible();
  await expect.element(badge).toHaveTextContent("125%");
});

test("opens a compact panel whose controls act on the page", async () => {
  const screen = await render(ZoomBadge, { percent: 80, standard: 100 });
  const badge = screen.getByRole("button", { name: "Page zoom, 80%" });
  expect(badge.element().getAttribute("aria-expanded")).toBe("false");
  await badge.click();
  expect(badge.element().getAttribute("aria-expanded")).toBe("true");

  await screen.getByRole("button", { name: "Zoom out" }).click();
  await screen.getByRole("button", { name: "Zoom in" }).click();
  await screen.getByRole("button", { name: "Reset" }).click();
  expect(native.commands).toEqual(["zoom.out", "zoom.in", "zoom.reset"]);
});

test("the level in the panel follows the page", async () => {
  const screen = await render(ZoomBadge, { percent: 80, standard: 100 });
  await screen.getByRole("button", { name: "Page zoom, 80%" }).click();
  const level = screen.getByRole("status");
  await expect.element(level).toHaveTextContent("80%");
  await screen.rerender({ percent: 90, standard: 100 });
  await expect.element(level).toHaveTextContent("90%");
});

test("Escape closes the panel and returns to the badge", async () => {
  const screen = await render(ZoomBadge, { percent: 150, standard: 100 });
  const badge = screen.getByRole("button", { name: "Page zoom, 150%" });
  await badge.click();
  expect(badge.element().getAttribute("aria-expanded")).toBe("true");
  badge.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await expect.poll(() => badge.element().getAttribute("aria-expanded")).toBe("false");
});
