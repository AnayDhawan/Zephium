import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import "$styles/global.css";
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
