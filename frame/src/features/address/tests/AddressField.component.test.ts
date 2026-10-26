import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { emitNativeEvent } from "$shared/testing/native-events";
import { revision, tabFixture } from "$shared/testing/fixtures";
import { tabs } from "$domain/tabs";
import { preferences } from "$domain/preferences";
import AddressField from "../components/AddressField.svelte";

const native = vi.hoisted(() => ({ defaultZoom: "100", page: null as string | null }));

vi.mock("$domain/surface", () => ({ surface: { currentPage: () => native.page } }));
vi.mock("$domain/permissions", () => ({
  sitePermissions: { list: async () => null, set: async () => true },
}));
vi.mock("$domain/blocker", async (original) => ({
  ...(await original<typeof import("$domain/blocker")>()),
  blocker: {
    status: () => ({ protection: "unavailable", applied_enabled: null, site: null }),
    refresh: async () => {},
  },
}));

vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({
    tabsBootstrap: async () => {},
    runCommand: async () => ({ accepted: true, operation_id: null }),
    settingGet: async (key: string) => (key === "zoom.default" ? native.defaultZoom : null),
  });
});

// The store keeps the newest projection it admitted across tests, so a stamp
// that follows the clock can land behind the last test's when tests run fast.
let clock = Date.now();
const stamp = () => revision((clock += 1));

afterEach(() => {
  tabs.dispose();
  preferences.dispose();
  native.defaultZoom = "100";
  native.page = null;
});

async function field(props: { compact?: boolean } = {}) {
  await tabs.init();
  const tab = tabFixture({
    projection_revision: stamp(),
    url: "https://www.wikipedia.org/wiki/Premium",
  });
  emitNativeEvent("itemsChanged", {
    projection_revision: stamp(),
    profile: null,
    spaces: [],
    active_space_id: null,
    nodes: [],
    tabs: [tab],
    active: tab.id,
    split_group: null,
  });
  const screen = await render(AddressField, props);
  const input = screen.container.querySelector<HTMLInputElement>("[data-zephium-address]")!;
  return { screen, input };
}

test("editing shows the whole address and rests on the host", async () => {
  const { input } = await field();
  expect(input.value).toBe("www.wikipedia.org");
  input.focus();
  await expect.poll(() => input.value).toBe("https://www.wikipedia.org/wiki/Premium");
  input.blur();
  await expect.poll(() => input.value).toBe("www.wikipedia.org");
});

test("a press anywhere else in the chrome ends editing", async () => {
  const { input } = await field();
  const elsewhere = document.createElement("div");
  elsewhere.style.cssText = "width:40px;height:40px";
  document.body.append(elsewhere);

  input.focus();
  expect(document.activeElement).toBe(input);
  elsewhere.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(document.activeElement).not.toBe(input);
  await expect.poll(() => input.value).toBe("www.wikipedia.org");
  elsewhere.remove();
});

test("the page taking focus from the chrome ends editing", async () => {
  const { input } = await field();
  input.focus();
  window.dispatchEvent(new Event("blur"));
  expect(document.activeElement).not.toBe(input);
});

test("a native blocked-popup projection is visible without changing the address", async () => {
  const { screen, input } = await field();
  const tab = tabs.activeTab()!;
  emitNativeEvent("tabChanged", {
    ...tab,
    projection_revision: stamp(),
    page_request: { kind: "popup", host: "example.com", site: null },
  });
  const card = screen.getByRole("alertdialog");
  await expect.element(card).toHaveTextContent("Pop-up blocked");
  await expect.element(card).toHaveTextContent("example.com");
  await expect.element(card.getByRole("button", { name: "Open" })).toBeVisible();
  expect(input.value).toBe("www.wikipedia.org");
});

test("a page's link for another app asks before it opens", async () => {
  const { screen } = await field();
  const tab = tabs.activeTab()!;
  emitNativeEvent("tabChanged", {
    ...tab,
    projection_revision: stamp(),
    page_request: { kind: "external_app", site: "zoom.us", scheme: "zoommtg", app: "zoom.us" },
  });
  const card = screen.getByRole("alertdialog");
  await expect.element(card).toHaveTextContent("Open zoom.us?");
  await expect.element(card.getByRole("checkbox")).not.toBeChecked();
  await expect.element(card.getByRole("button", { name: "Cancel" })).toBeVisible();
});

test("a page that stopped responding offers to wait or reload", async () => {
  const { screen } = await field();
  const tab = tabs.activeTab()!;
  emitNativeEvent("tabChanged", {
    ...tab,
    projection_revision: stamp(),
    page_request: { kind: "unresponsive" },
  });
  const card = screen.getByRole("alertdialog");
  await expect.element(card).toHaveTextContent("This page isn't responding");
  await expect.element(card.getByRole("button", { name: "Wait" })).toBeVisible();
  await expect.element(card.getByRole("button", { name: "Reload" })).toBeVisible();
  emitNativeEvent("tabChanged", {
    ...tab,
    projection_revision: stamp(),
    page_request: null,
  });
  await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
});

async function zoomed(zoom: number | undefined) {
  const { screen } = await field();
  const tab = tabs.activeTab()!;
  emitNativeEvent("tabChanged", { ...tab, projection_revision: stamp(), zoom });
  return screen;
}

test("a page zoomed away from the default shows its level beside the address", async () => {
  const screen = await zoomed(125);
  const badge = screen.getByRole("button", { name: "Page zoom, 125%" });
  await expect.element(badge).toBeVisible();
  await expect.element(badge).toHaveTextContent("125%");
});

test("a page at the default shows no zoom, and none arrives before a page exists", async () => {
  const screen = await zoomed(100);
  await expect.element(screen.getByRole("button", { name: /Page zoom/u })).not.toBeInTheDocument();
  emitNativeEvent("tabChanged", {
    ...tabs.activeTab()!,
    projection_revision: stamp(),
    zoom: undefined,
  });
  await expect.element(screen.getByRole("button", { name: /Page zoom/u })).not.toBeInTheDocument();
});

test("the default zoom is what the badge measures against", async () => {
  native.defaultZoom = "125";
  await preferences.init();
  const screen = await zoomed(125);
  await expect.element(screen.getByRole("button", { name: /Page zoom/u })).not.toBeInTheDocument();
  emitNativeEvent("tabChanged", {
    ...tabs.activeTab()!,
    projection_revision: stamp(),
    zoom: 100,
  });
  await expect.element(screen.getByRole("button", { name: "Page zoom, 100%" })).toBeVisible();
});

test("the zoom badge leaves the not-secure glyph and the address alone", async () => {
  const { screen, input } = await field();
  const tab = tabs.activeTab()!;
  emitNativeEvent("tabChanged", {
    ...tab,
    projection_revision: stamp(),
    url: "http://example.com/",
    zoom: 90,
  });
  await expect
    .element(screen.getByRole("button", { name: "Site information, Connection is not encrypted" }))
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Page zoom, 90%" })).toBeVisible();
  expect(input.value).toBe("example.com");
});

test("a secure page has a quiet site-information glyph at the start of the field", async () => {
  const { screen, input } = await field();
  const glyph = screen.getByRole("button", { name: "Site information" });
  await expect.element(glyph).toBeVisible();
  expect(
    glyph.element().compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(input.value).toBe("www.wikipedia.org");
});

async function pageWithout(change: Record<string, unknown>) {
  const { screen, input } = await field();
  emitNativeEvent("tabChanged", {
    ...tabs.activeTab()!,
    projection_revision: stamp(),
    ...change,
  });
  await expect.poll(() => input.value).toBe("");
  return screen;
}

test("a new tab, an internal page and a blank page have no site information", async () => {
  const blank = await pageWithout({ url: null });
  await expect
    .element(blank.getByRole("button", { name: /Site information/u }))
    .not.toBeInTheDocument();
  blank.unmount();

  const internal = await pageWithout({ url: null, content: "settings" });
  await expect
    .element(internal.getByRole("button", { name: /Site information/u }))
    .not.toBeInTheDocument();
  internal.unmount();

  const about = await pageWithout({ url: "about:blank" });
  await expect
    .element(about.getByRole("button", { name: /Site information/u }))
    .not.toBeInTheDocument();
});

test("a page behind Settings and the rail have none either", async () => {
  native.page = "settings";
  const behind = await field();
  await expect
    .element(behind.screen.getByRole("button", { name: /Site information/u }))
    .not.toBeInTheDocument();
  behind.screen.unmount();

  native.page = null;
  const rail = await field({ compact: true });
  await expect
    .element(rail.screen.getByRole("button", { name: /Site information/u }))
    .not.toBeInTheDocument();
});

test("pressing the glyph while typing ends the edit and opens the panel", async () => {
  const { screen, input } = await field();
  input.focus();
  await expect.poll(() => input.value).toBe("https://www.wikipedia.org/wiki/Premium");
  const glyph = screen.getByRole("button", { name: "Site information" });
  glyph.element().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  expect(document.activeElement).not.toBe(input);
  await glyph.click();
  await expect.element(glyph).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => input.value).toBe("www.wikipedia.org");
});
