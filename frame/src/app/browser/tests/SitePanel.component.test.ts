import "$styles/global.css";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import type { BlockerStatusView, SitePermissionsView } from "$shared/ipc/bindings";
import { emitNativeEvent } from "$shared/testing/native-events";
import { revision, tabFixture } from "$shared/testing/fixtures";
import { surface } from "$domain/surface";
import { tabs } from "$domain/tabs";
import Shell from "../Shell.svelte";

vi.mock("../WorkWorkspace.svelte", async () => await import("./StageStub.svelte"));

const native = vi.hoisted(() => ({
  list: vi.fn<(origin?: string) => Promise<SitePermissionsView | null>>(),
  set: vi.fn(async (..._args: unknown[]) => true),
  refresh: vi.fn(async () => {}),
  setProtected: vi.fn(async (_protect: boolean) => true),
  status: null as unknown as BlockerStatusView,
  extensions: false,
}));
vi.mock("$domain/permissions", async (original) => ({
  ...(await original<typeof import("$domain/permissions")>()),
  sitePermissions: { list: native.list, set: native.set },
}));
vi.mock("$domain/webext", async (original) => {
  const { webext } = await original<typeof import("$domain/webext")>();
  return { webext: { ...webext, isAvailable: () => native.extensions } };
});
vi.mock("$domain/blocker", async (original) => ({
  ...(await original<typeof import("$domain/blocker")>()),
  blocker: { status: () => native.status, refresh: native.refresh },
  blockerSites: { setProtected: native.setProtected },
}));
vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({
    tabsBootstrap: async () => {},
    pagePermissionCardHost: async () => {},
    runCommand: async () => ({ accepted: true, operation_id: null }),
    blockerStats: async () => ({
      status: "ok" as const,
      data: { today: 42, last7Days: 0, days: [] },
    }),
  });
});

let clock = 100;
const stamp = () => revision((clock += 1));

beforeEach(() => {
  native.extensions = false;
  native.status = {
    protection: "active",
    applied_enabled: true,
    desired_enabled: true,
    can_enable: true,
    preference: "authoritative",
    site: {
      context: { profile: "p", tab: "tab-1", site: "meet.example", revision: "1" },
      paused: false,
      private_session: false,
      ready: true,
      busy: false,
      hides: [],
    },
  } as unknown as BlockerStatusView;
  native.list.mockResolvedValue({
    private: false,
    complete: true,
    kinds: ["camera", "microphone", "geolocation", "popups"],
    entries: [{ origin: "https://meet.example", kind: "camera", decision: "allow" }],
  });
});
afterEach(() => {
  surface.dispose();
  tabs.dispose();
  vi.clearAllMocks();
});

async function shell(over: Parameters<typeof tabFixture>[0] = {}) {
  await surface.init();
  await tabs.init();
  const tab = tabFixture({
    projection_revision: stamp(),
    url: "https://meet.example/room",
    ...over,
  });
  emitNativeEvent("itemsChanged", {
    projection_revision: stamp(),
    profile: { id: "p", name: "Personal", kind: "default" },
    spaces: [],
    active_space_id: null,
    nodes: [],
    tabs: [tab],
    active: tab.id,
    split_group: null,
  });
  return render(Shell);
}

const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

test("the address field has one control, at its end, and no zoom badge", async () => {
  const screen = await shell({ zoom: 125 });
  const field = screen.container.querySelector<HTMLElement>(".address-field")!;
  const input = field.querySelector("input")!;
  const glyph = screen.getByRole("button", { name: "Site information" }).element();
  expect(field.contains(glyph)).toBe(true);
  expect(before(input, glyph)).toBe(true);
  expect(field.querySelectorAll("button")).toHaveLength(1);
  await expect.element(screen.getByRole("button", { name: /Page zoom/u })).not.toBeInTheDocument();
});

test("one panel, top to bottom: the site, blocking, its permissions, zoom, and its data", async () => {
  const screen = await shell({ zoom: 125 });
  await screen.getByRole("button", { name: "Site information" }).click();
  const panel = screen.getByRole("group", { name: "Site information" });

  const host = panel.getByText("meet.example");
  const secure = panel.getByRole("img", { name: "Secure" });
  const blocking = panel.getByRole("switch", { name: "Ad blocking" });
  const camera = panel.getByRole("radiogroup", { name: "Camera" });
  const zoom = panel.getByRole("group", { name: "Page zoom" });
  const clear = panel.getByRole("button", { name: "Clear data for this site…" });
  await expect.element(host).toBeVisible();
  await expect.element(secure).toBeVisible();
  await expect.element(blocking).toBeChecked();
  await expect.element(panel.getByText("42", { exact: true })).toBeVisible();
  await expect.element(camera.getByRole("radio", { name: "Allow" })).toBeChecked();
  await expect.element(zoom.getByRole("status")).toHaveTextContent("125%");
  await expect.element(clear).toBeVisible();

  const order = [host, blocking, camera, zoom, clear].map((locator) => locator.element());
  for (let at = 1; at < order.length; at++) expect(before(order[at - 1]!, order[at]!)).toBe(true);

  expect(panel.element().textContent).not.toContain("Site settings");
});

test("a page at its default zoom with no decisions has just the site, blocking and its data", async () => {
  native.list.mockResolvedValue({
    private: false,
    complete: true,
    kinds: ["camera"],
    entries: [],
  });
  const screen = await shell();
  await screen.getByRole("button", { name: "Site information" }).click();
  const panel = screen.getByRole("group", { name: "Site information" });
  await expect.element(panel.getByRole("switch", { name: "Ad blocking" })).toBeVisible();
  await expect.poll(() => native.list.mock.calls.length).toBe(1);
  await expect.element(panel.getByRole("radiogroup")).not.toBeInTheDocument();
  await expect.element(panel.getByRole("group", { name: "Page zoom" })).not.toBeInTheDocument();
  await expect.element(panel.getByText("Permissions")).not.toBeInTheDocument();
  await expect
    .element(panel.getByRole("button", { name: "Clear data for this site…" }))
    .toBeVisible();
});

test("the panel is as wide as the field, with groups divided and every row on one line", async () => {
  const screen = await shell({ zoom: 125 });
  await screen.getByRole("button", { name: "Site information" }).click();
  const panel = screen.getByRole("group", { name: "Site information" });
  await expect.element(panel.getByRole("switch", { name: "Ad blocking" })).toBeVisible();
  await expect.element(panel.getByRole("group", { name: "Page zoom" })).toBeVisible();

  const field = screen.container
    .querySelector<HTMLElement>(".address-field")!
    .getBoundingClientRect();
  // Opening scales the panel up from a hair under, so wait for it to settle.
  await expect
    .poll(() => Math.abs(panel.element().getBoundingClientRect().left - field.left))
    .toBeLessThanOrEqual(1);
  expect(Math.abs(panel.element().getBoundingClientRect().right - field.right)).toBeLessThanOrEqual(
    1,
  );

  const body = panel.element().querySelector<HTMLElement>("[data-tray-body]")!;
  const line = (row: Element) => (row as HTMLElement).offsetHeight;
  expect(line(body.querySelector("header")!)).toBeLessThanOrEqual(36);
  expect(line(body.querySelector(".protection .head")!)).toBe(34);
  expect(line(panel.getByRole("group", { name: "Page zoom" }).element())).toBe(34);
  expect(line(panel.getByRole("button", { name: "Clear data for this site…" }).element())).toBe(34);

  // Three groups, so two dividers: the site, what acts on the page, what the
  // site has; and the extensions would share the second group's.
  const dividers = [...body.children].filter(
    (child) => parseFloat(getComputedStyle(child).borderTopWidth) > 0,
  );
  expect(dividers).toHaveLength(2);
});

test("with extensions, the blocking and the extensions are one group between two dividers", async () => {
  native.extensions = true;
  const screen = await shell({ zoom: 125 });
  await screen.getByRole("button", { name: "Site information" }).click();
  const panel = screen.getByRole("group", { name: "Site information" });
  await expect.element(panel.getByRole("button", { name: "Manage extensions" })).toBeVisible();
  await expect.element(panel.getByRole("button", { name: "Hide elements…" })).toBeVisible();

  const body = panel.element().querySelector<HTMLElement>("[data-tray-body]")!;
  const sections = [...body.children];
  const ruled = sections.filter((child) => parseFloat(getComputedStyle(child).borderTopWidth) > 0);
  expect(ruled.map((child) => child.className.replace(/\s*svelte-\w+/gu, ""))).toEqual([
    "protection",
    "details",
  ]);
  const row = body.querySelector<HTMLElement>(".extensions .row")!;
  expect(row.offsetHeight).toBe(34);
  expect(
    [...body.querySelectorAll<HTMLElement>(".ui-menu-icon")].every(
      (icon) =>
        Math.round(icon.getBoundingClientRect().left - body.getBoundingClientRect().left) === 8,
    ),
  ).toBe(true);
});

test("an unencrypted page keeps the warning in view, and the panel says why", async () => {
  const screen = await shell({ url: "http://meet.example/" });
  const glyph = screen.getByRole("button", {
    name: "Site information, Connection is not encrypted",
  });
  await expect.element(glyph).toHaveAttribute("title", "Connection is not encrypted");
  expect(getComputedStyle(glyph.element()).opacity).toBe("1");
  await glyph.click();
  const panel = screen.getByRole("group", {
    name: "Site information, Connection is not encrypted",
  });
  await expect.element(panel.getByText("Not secure")).toBeVisible();
  expect(panel.element().textContent).not.toContain("Secure");
});

test("a certificate the person continued past is not secure either", async () => {
  const screen = await shell({ certificate_exception: true });
  await expect
    .element(
      screen.getByRole("button", {
        name: "Site information, Certificate not trusted. You chose to continue to this site.",
      }),
    )
    .toBeVisible();
});

test("a new tab has the panel too, for blocking and extensions, without a site", async () => {
  const screen = await shell({ url: null });
  await screen.getByRole("button", { name: "Utilities" }).click();
  const panel = screen.getByRole("group", { name: "Utilities" });
  await expect.element(panel.getByText("42", { exact: true })).toBeVisible();
  await expect
    .element(panel.getByRole("button", { name: "Clear data for this site…" }))
    .not.toBeInTheDocument();
  expect(native.list).not.toHaveBeenCalled();
});

test("Escape closes the panel and returns to the glyph", async () => {
  const screen = await shell();
  const glyph = screen.getByRole("button", { name: "Site information" });
  await glyph.click();
  await expect.element(glyph).toHaveAttribute("aria-expanded", "true");
  await userEvent.keyboard("{Escape}");
  await expect.element(glyph).toHaveAttribute("aria-expanded", "false");
  await expect.element(glyph).toHaveFocus();
});

test("nothing is read until the panel is opened", async () => {
  const screen = await shell();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(native.list).not.toHaveBeenCalled();
  expect(native.refresh).not.toHaveBeenCalled();
  await screen.getByRole("button", { name: "Site information" }).click();
  await expect.poll(() => native.list.mock.calls.length).toBe(1);
  expect(native.refresh).toHaveBeenCalled();
});

test("Work has no address field, so no panel", async () => {
  const screen = await shell();
  await expect.element(screen.getByRole("button", { name: "Site information" })).toBeVisible();
  emitNativeEvent("uiCommand", "browser.work");
  await expect.poll(() => screen.container.querySelector("[data-work-stage-stub]")).not.toBeNull();
  await expect
    .element(screen.getByRole("button", { name: /Site information|Utilities/u }))
    .not.toBeInTheDocument();
});
