import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import "$styles/global.css";
import "$shared/ui/Menu/surface.css";
import ExtensionsSection from "../components/ExtensionsSection.svelte";

type Action = {
  runtime: { install_id: string; generation: string };
  revision: string;
  label: string;
  badge: string;
  unread_badge: boolean;
  enabled: boolean;
  presents_popup: boolean;
  icon_rgba_base64: string | null;
};

const native = vi.hoisted(() => ({
  available: true,
  actions: [] as unknown[],
  shortcut: null as null | {
    runtime: { install_id: string; generation: string };
    action_revision: string;
    projection_revision: string;
  },
  invoke: vi.fn(async (..._args: unknown[]) => {}),
  consume: vi.fn((_revision: string) => true),
  open: vi.fn(async (_page: string) => {}),
}));
vi.mock("$domain/webext", () => ({ webext: { isAvailable: () => native.available } }));
vi.mock("$domain/surface", () => ({ surface: { open: native.open } }));
vi.mock("$domain/tabs", () => ({
  tabs: { profile: () => ({ id: "profile" }), activeId: () => "tab" },
}));
vi.mock("$domain/extensions", () => ({
  extensions: {
    activeActions: () => native.actions,
    failureReason: () => null,
    isInvoking: () => false,
    actionShortcut: () => native.shortcut,
    consumeActionShortcut: native.consume,
    invoke: native.invoke,
  },
}));

const action = (id: string, over: Partial<Action> = {}): Action => ({
  runtime: { install_id: id, generation: "g" },
  revision: "r1",
  label: `Extension ${id}`,
  badge: "",
  unread_badge: false,
  enabled: true,
  presents_popup: true,
  icon_rgba_base64: null,
  ...over,
});

beforeEach(() => {
  native.available = true;
  native.actions = [];
  native.shortcut = null;
});
afterEach(() => vi.clearAllMocks());

test("without extensions there is nothing to draw, not even a hairline's worth", async () => {
  native.available = false;
  const screen = await render(ExtensionsSection);
  expect(screen.container.querySelector(".extensions")).toBeNull();
  await expect
    .element(screen.getByRole("button", { name: "Manage extensions" }))
    .not.toBeInTheDocument();
});

test("each extension's action is a button named for it, beside the way to manage them", async () => {
  native.actions = [action("a"), action("b", { enabled: false })];
  const screen = await render(ExtensionsSection);
  await expect.element(screen.getByRole("button", { name: "Extension a" })).toBeEnabled();
  await expect.element(screen.getByRole("button", { name: "Extension b" })).toBeDisabled();
  await expect.element(screen.getByRole("button", { name: "Manage extensions" })).toBeVisible();
});

test("with no actions the way to manage them stays", async () => {
  const screen = await render(ExtensionsSection);
  await expect.element(screen.getByRole("button", { name: "Manage extensions" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: /^Extension / })).not.toBeInTheDocument();
});

test("pressing an action opens it from the page's tab, and leaves the panel", async () => {
  native.actions = [action("a")];
  const screen = await render(ExtensionsSection);
  const tile = screen.getByRole("button", { name: "Extension a" });
  await expect.element(tile).toHaveAttribute("data-dismiss");
  await tile.click();
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith(
    "profile",
    "tab",
    native.actions[0],
    expect.any(DOMRect),
  );
});

test("an extension's key opens its action without the panel ever being opened", async () => {
  native.actions = [action("a")];
  native.shortcut = {
    runtime: { install_id: "a", generation: "g" },
    action_revision: "r1",
    projection_revision: "p1",
  };
  await render(ExtensionsSection);
  await expect.poll(() => native.invoke.mock.calls.length).toBe(1);
  expect(native.consume).toHaveBeenCalledWith("p1");
});

test("Manage extensions opens the extensions page and leaves the panel", async () => {
  const screen = await render(ExtensionsSection);
  const manage = screen.getByRole("button", { name: "Manage extensions" });
  await expect.element(manage).toHaveAttribute("data-dismiss");
  await manage.click();
  expect(native.open).toHaveBeenCalledExactlyOnceWith("extensions");
});

// The panel's width at the default 240px column, less its own padding.
const panelWidth = "228px";

test("one row at the default column: the name, each extension's button, and the way on", async () => {
  native.actions = [action("a"), action("b"), action("c")];
  const screen = await render(ExtensionsSection);
  screen.container.style.inlineSize = panelWidth;
  const row = screen.container.querySelector<HTMLElement>(".row")!;
  const name = screen.getByText("Extensions", { exact: true });
  await expect.element(name).toBeVisible();
  expect(row.offsetHeight).toBe(34);

  const rect = (element: Element) => element.getBoundingClientRect();
  const tiles = [...row.querySelectorAll<HTMLElement>("button[data-extension-install]")];
  expect(tiles).toHaveLength(3);
  const chevron = row.querySelector(".chevron")!;
  expect(row.querySelector(".ui-menu-icon svg")).not.toBeNull();
  // Name, then the buttons, then the chevron, left to right on one line.
  expect(rect(name.element()).right).toBeLessThanOrEqual(rect(tiles[0]!).left);
  expect(rect(tiles[2]!).right).toBeLessThanOrEqual(rect(chevron).left);
  for (const tile of tiles) {
    expect(Math.abs(rect(tile).top - rect(tiles[0]!).top)).toBeLessThan(1);
    expect(rect(tile).bottom).toBeLessThanOrEqual(rect(row).bottom);
  }
});

test("the rest of the row, name and chevron included, opens the manager", async () => {
  native.actions = [action("a")];
  const screen = await render(ExtensionsSection);
  screen.container.style.inlineSize = panelWidth;
  const manage = screen.getByRole("button", { name: "Manage extensions" });
  await expect.element(manage).toBeVisible();
  const row = screen.container.querySelector<HTMLElement>(".row")!;
  const button = manage.element();
  const centre = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2] as const;
  };
  for (const part of [".name", ".chevron", ".ui-menu-icon"]) {
    const [x, y] = centre(row.querySelector(part)!);
    expect(document.elementFromPoint(x, y)).toBe(button);
  }
  // Only the extension's own button keeps the pointer.
  const tile = row.querySelector("button[data-extension-install]")!;
  const [x, y] = centre(tile);
  expect(tile.contains(document.elementFromPoint(x, y))).toBe(true);
  const rect = button.getBoundingClientRect();
  await manage.click({ position: { x: 20, y: rect.height / 2 } });
  expect(native.open).toHaveBeenCalledExactlyOnceWith("extensions");
});

test("many extensions wrap beside the name instead of leaving the row", async () => {
  native.actions = Array.from({ length: 9 }, (_, index) => action(`x${index}`));
  const screen = await render(ExtensionsSection);
  screen.container.style.inlineSize = panelWidth;
  const row = screen.container.querySelector<HTMLElement>(".row")!;
  await expect.element(screen.getByRole("button", { name: "Extension x8" })).toBeVisible();
  expect(row.offsetHeight).toBeGreaterThan(34);
  expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  const box = row.getBoundingClientRect();
  for (const tile of row.querySelectorAll("button[data-extension-install]")) {
    const rect = tile.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(box.left);
    expect(rect.right).toBeLessThanOrEqual(box.right);
    expect(rect.top).toBeGreaterThanOrEqual(box.top);
    expect(rect.bottom).toBeLessThanOrEqual(box.bottom);
  }
  expect(screen.container.querySelector(".name")!.scrollWidth).toBeLessThanOrEqual(
    screen.container.querySelector(".name")!.clientWidth,
  );
});

test("the keyboard reaches the manager and then each extension, each with a ring", async () => {
  native.actions = [action("a")];
  const screen = await render(ExtensionsSection);
  const manage = screen.getByRole("button", { name: "Manage extensions" });
  manage.element().focus({ focusVisible: true } as FocusOptions);
  await expect.element(manage).toHaveFocus();
  expect(getComputedStyle(manage.element()).outlineStyle).toBe("solid");
  const tile = screen.getByRole("button", { name: "Extension a" });
  tile.element().focus({ focusVisible: true } as FocusOptions);
  await expect.element(tile).toHaveFocus();
  expect(getComputedStyle(tile.element()).outlineStyle).toBe("solid");
});
