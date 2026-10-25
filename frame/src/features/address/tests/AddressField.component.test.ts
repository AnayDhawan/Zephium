import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { emitNativeEvent } from "$shared/testing/native-events";
import { revision, tabFixture } from "$shared/testing/fixtures";
import { tabs } from "$domain/tabs";
import { preferences } from "$domain/preferences";
import AddressField from "../components/AddressField.svelte";

const native = vi.hoisted(() => ({ defaultZoom: "100" }));

vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({
    tabsBootstrap: async () => {},
    runCommand: async () => ({ accepted: true, operation_id: null }),
    settingGet: async (key: string) => (key === "zoom.default" ? native.defaultZoom : null),
  });
});

afterEach(() => {
  tabs.dispose();
  preferences.dispose();
  native.defaultZoom = "100";
});

async function field() {
  await tabs.init();
  const tab = tabFixture({ url: "https://www.wikipedia.org/wiki/Premium" });
  emitNativeEvent("itemsChanged", {
    projection_revision: revision(Date.now()),
    profile: null,
    spaces: [],
    active_space_id: null,
    nodes: [],
    tabs: [tab],
    active: tab.id,
    split_group: null,
  });
  const screen = await render(AddressField);
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
    projection_revision: revision(Date.now() + 1),
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
    projection_revision: revision(Date.now() + 1),
    page_request: { kind: "external_app", site: "zoom.us", scheme: "zoommtg", app: "zoom.us" },
  });
  const card = screen.getByRole("alertdialog");
  await expect.element(card).toHaveTextContent("Open zoom.us?");
  await expect.element(card.getByRole("checkbox")).not.toBeChecked();
  await expect.element(card.getByRole("button", { name: "Cancel" })).toBeVisible();
});

async function zoomed(zoom: number | undefined) {
  const { screen } = await field();
  const tab = tabs.activeTab()!;
  emitNativeEvent("tabChanged", { ...tab, projection_revision: revision(Date.now() + 1), zoom });
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
    projection_revision: revision(Date.now() + 2),
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
    projection_revision: revision(Date.now() + 3),
    zoom: 100,
  });
  await expect.element(screen.getByRole("button", { name: "Page zoom, 100%" })).toBeVisible();
});

test("the zoom badge leaves the not-secure glyph and the address alone", async () => {
  const { screen, input } = await field();
  const tab = tabs.activeTab()!;
  emitNativeEvent("tabChanged", {
    ...tab,
    projection_revision: revision(Date.now() + 1),
    url: "http://example.com/",
    zoom: 90,
  });
  await expect
    .element(screen.getByRole("img", { name: "Connection is not encrypted" }))
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Page zoom, 90%" })).toBeVisible();
  expect(input.value).toBe("example.com");
});
