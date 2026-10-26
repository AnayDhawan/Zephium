import type { ComponentProps } from "svelte";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page, userEvent } from "vitest/browser";
import "$styles/global.css";
import type { SitePermissionsView } from "$shared/ipc/bindings";
import SiteInfo from "../components/SiteInfo.svelte";

const native = vi.hoisted(() => ({
  list: vi.fn<(origin?: string) => Promise<SitePermissionsView | null>>(),
  set: vi.fn(async (..._args: unknown[]) => true),
}));
vi.mock("$domain/permissions", () => ({
  sitePermissions: { list: native.list, set: native.set },
}));
vi.mock("$domain/blocker", async (original) => ({
  ...(await original<typeof import("$domain/blocker")>()),
  blocker: {
    status: () => ({ protection: "unavailable", applied_enabled: null, site: null }),
    refresh: async () => {},
  },
  blockerSites: { setProtected: async () => true },
}));
vi.mock("$domain/tabs", () => ({ tabs: { profile: () => null } }));
vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({});
});

const SAVED: SitePermissionsView = {
  private: false,
  complete: true,
  kinds: ["camera", "microphone", "geolocation", "popups"],
  entries: [{ origin: "https://meet.example", kind: "camera", decision: "allow" }],
};

beforeEach(() => {
  native.list.mockResolvedValue(SAVED);
});
afterEach(() => vi.clearAllMocks());

function glyph(props: Partial<ComponentProps<typeof SiteInfo>> = {}) {
  return render(SiteInfo, { url: "https://meet.example/room", security: "secure", ...props });
}

test("the glyph is named for the site, and for the problem when there is one", async () => {
  const secure = await glyph();
  await expect.element(secure.getByRole("button", { name: "Site information" })).toBeVisible();
  secure.unmount();

  const http = await glyph({ url: "http://meet.example/", security: "insecure" });
  await expect
    .element(http.getByRole("button", { name: "Site information, Connection is not encrypted" }))
    .toHaveAttribute("title", "Connection is not encrypted");
  http.unmount();

  const exception = await glyph({ security: "untrusted" });
  await expect
    .element(exception.getByRole("button", { name: /^Site information, Certificate not trusted/u }))
    .toBeVisible();
});

test("closed, it reads nothing", async () => {
  await glyph();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(native.list).not.toHaveBeenCalled();
});

test("a press opens the panel and loads it then", async () => {
  const screen = await glyph();
  const button = screen.getByRole("button", { name: "Site information" });
  expect(button.element().getAttribute("aria-expanded")).toBe("false");
  await button.click();
  expect(button.element().getAttribute("aria-expanded")).toBe("true");
  const panel = screen.getByRole("group", { name: "Site information" });
  await expect.element(panel.getByText("meet.example")).toBeVisible();
  await expect.element(panel.getByText("Connection is secure")).toBeVisible();
  await expect.poll(() => native.list.mock.calls.length).toBe(1);
  expect(native.list).toHaveBeenCalledWith("https://meet.example");
  await expect.element(panel.getByRole("button", { name: "Camera" })).toHaveTextContent("Allow");
});

test("the keyboard opens it, hands it the keys, and Escape closes it and returns to the glyph", async () => {
  const screen = await glyph();
  const button = screen.getByRole("button", { name: "Site information" });
  // WebKit only tabs to buttons under the system's full keyboard access.
  button.element().focus();
  await expect.element(button).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(button).toHaveAttribute("aria-expanded", "true");
  const panel = screen.getByRole("group", { name: "Site information" });
  await expect.element(panel.getByText("Connection is secure")).toBeVisible();
  await expect.element(panel.getByRole("button", { name: "Camera" })).toBeVisible();
  await expect.poll(() => panel.element().contains(document.activeElement)).toBe(true);

  await userEvent.keyboard("{Escape}");
  await expect.element(button).toHaveAttribute("aria-expanded", "false");
  await expect.element(button).toHaveFocus();
});

test("Space opens it too, and a second press closes it", async () => {
  const screen = await glyph();
  const button = screen.getByRole("button", { name: "Site information" });
  button.element().focus();
  await userEvent.keyboard(" ");
  await expect.element(button).toHaveAttribute("aria-expanded", "true");
  await button.click();
  await expect.element(button).toHaveAttribute("aria-expanded", "false");
});

test("choosing from a row leaves the panel open", async () => {
  const screen = await glyph();
  const button = screen.getByRole("button", { name: "Site information" });
  await button.click();
  const camera = screen.getByRole("button", { name: "Camera" });
  await expect.element(camera).toBeVisible();
  await camera.click();
  await page.getByRole("menuitem", { name: "Block" }).click();
  expect(native.set).toHaveBeenCalledWith("https://meet.example", "camera", "block");
  await expect.element(button).toHaveAttribute("aria-expanded", "true");
  await expect.element(screen.getByRole("button", { name: "Reset permissions" })).toBeVisible();
});

test("a row's menu is chosen from with the arrows, and Escape closes only that menu", async () => {
  const screen = await glyph();
  const button = screen.getByRole("button", { name: "Site information" });
  await button.click();
  const camera = screen.getByRole("button", { name: "Camera" });
  await expect.element(camera).toBeVisible();
  camera.element().focus();
  await userEvent.keyboard("{Enter}");
  const menu = screen.getByRole("menu", { name: "Camera" });
  await expect.element(menu.getByRole("menuitem", { name: "Allow" })).toHaveFocus();

  await userEvent.keyboard("{Escape}");
  await expect.element(camera).toHaveAttribute("aria-expanded", "false");
  await expect.element(button).toHaveAttribute("aria-expanded", "true");
  await expect.element(camera).toHaveFocus();

  await userEvent.keyboard("{Enter}");
  await userEvent.keyboard("{ArrowDown}");
  await expect.element(menu.getByRole("menuitem", { name: "Block" })).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  expect(native.set).toHaveBeenCalledWith("https://meet.example", "camera", "block");
  await expect.element(button).toHaveAttribute("aria-expanded", "true");
});

test("pressing a row's control again closes its menu", async () => {
  const screen = await glyph();
  await screen.getByRole("button", { name: "Site information" }).click();
  const camera = screen.getByRole("button", { name: "Camera" });
  await camera.click();
  await expect.element(camera).toHaveAttribute("aria-expanded", "true");
  await camera.click();
  await expect.element(camera).toHaveAttribute("aria-expanded", "false");
});

test("a press outside closes it", async () => {
  const screen = await glyph();
  const button = screen.getByRole("button", { name: "Site information" });
  await button.click();
  await expect.element(button).toHaveAttribute("aria-expanded", "true");
  document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  await expect.element(button).toHaveAttribute("aria-expanded", "false");
});

test("Site settings closes the panel it was chosen in", async () => {
  const onSiteSettings = vi.fn();
  const screen = await glyph({ onSiteSettings });
  const button = screen.getByRole("button", { name: "Site information" });
  await button.click();
  await screen.getByRole("button", { name: "Site settings" }).click();
  expect(onSiteSettings).toHaveBeenCalledOnce();
  await expect.element(button).toHaveAttribute("aria-expanded", "false");
});
