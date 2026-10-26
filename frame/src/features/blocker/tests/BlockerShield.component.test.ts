import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import "$styles/global.css";
import "$shared/ui/Menu/surface.css";
import type { BlockerStatusView } from "$shared/ipc/bindings";
import BlockerShield from "../components/BlockerShield.svelte";

const native = vi.hoisted(() => ({
  refresh: vi.fn(async () => {}),
  setProtected: vi.fn(async (_protect: boolean) => true),
  setEnabled: vi.fn(async (_enabled: boolean) => ({
    state: "processed",
    disposition: { outcome: "applied" },
  })),
  changeSite: vi.fn(async (..._args: unknown[]) => ({
    state: "processed",
    disposition: { outcome: "applied" },
  })),
  hide: vi.fn(async (..._args: unknown[]) => true),
  today: 12345 as number | null,
  status: null as unknown as BlockerStatusView,
}));
vi.mock("$domain/blocker", async (original) => ({
  ...(await original<typeof import("$domain/blocker")>()),
  blocker: { status: () => native.status, refresh: native.refresh, setEnabled: native.setEnabled },
  blockerSites: { setProtected: native.setProtected, changeSite: native.changeSite },
  hiding: { start: native.hide },
}));
vi.mock("$domain/tabs", () => ({
  tabs: { profile: () => ({ id: "profile", name: "Personal", kind: "default" }) },
}));
vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({
    blockerStats: async () =>
      native.today === null
        ? { status: "error" as const, error: null }
        : { status: "ok" as const, data: { today: native.today, last7Days: 0, days: [] } },
  });
});

const CONTEXT = { profile: "profile", tab: "tab", site: "meet.example", revision: "1" };

function blocking(
  over: Record<string, unknown> = {},
  site: Record<string, unknown> = {},
): BlockerStatusView {
  return {
    protection: "active",
    applied_enabled: true,
    desired_enabled: true,
    can_enable: true,
    preference: "authoritative",
    site: {
      context: CONTEXT,
      paused: false,
      private_session: false,
      ready: true,
      busy: false,
      hides: [],
      ...site,
    },
    ...over,
  } as unknown as BlockerStatusView;
}

beforeEach(() => {
  native.today = 12345;
  native.status = blocking();
});
afterEach(() => vi.clearAllMocks());

const switchOf = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.getByRole("switch", { name: "Ad blocking" });

test("closed, it reads nothing and draws no controls", async () => {
  const screen = await render(BlockerShield, { open: false });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(native.refresh).not.toHaveBeenCalled();
  await expect.element(screen.getByRole("switch")).not.toBeInTheDocument();
});

test("opening reads the standing, and it reads again at every opening", async () => {
  const screen = await render(BlockerShield, { open: true });
  await expect.element(switchOf(screen)).toBeVisible();
  expect(native.refresh).toHaveBeenCalledTimes(1);
  await screen.rerender({ open: false });
  await screen.rerender({ open: true });
  await expect.poll(() => native.refresh.mock.calls.length).toBe(2);
});

test("blocking is one row: the name, the day's count beside it, and the switch", async () => {
  const screen = await render(BlockerShield, { open: true });
  await expect.element(switchOf(screen)).toBeChecked();
  await expect.element(screen.getByText("12,345", { exact: true })).toBeVisible();
  const head = screen.container.querySelector<HTMLElement>(".head")!;
  expect(head.title).toBe("12,345 blocked today");
  expect(screen.container.querySelector(".standing")).toBeNull();
  expect(head.getBoundingClientRect().height).toBe(34);
  await switchOf(screen).click();
  expect(native.setProtected).toHaveBeenCalledExactlyOnceWith(false);
});

test("a paused site is told by its switch, and the switch resumes it", async () => {
  native.status = blocking({}, { paused: true });
  const screen = await render(BlockerShield, { open: true });
  await expect.element(switchOf(screen)).not.toBeChecked();
  expect(screen.container.querySelector<HTMLElement>(".head")!.title).toBe("Paused on this site");
  expect(screen.container.querySelector(".count")).toBeNull();
  await switchOf(screen).click();
  expect(native.setProtected).toHaveBeenCalledExactlyOnceWith(true);
});

test("a count that cannot be read is not shown as zero", async () => {
  native.today = null;
  const screen = await render(BlockerShield, { open: true });
  await expect.element(switchOf(screen)).toBeVisible();
  expect(screen.container.querySelector<HTMLElement>(".head")!.title).toBe("On for this site");
  expect(screen.container.querySelector(".count")).toBeNull();
  expect(screen.container.textContent).not.toContain("blocked today");
});

// The panel's width at the default 240px column, less its own padding.
test("at the default column the name, the count and the switch share one line", async () => {
  const screen = await render(BlockerShield, { open: true });
  screen.container.style.inlineSize = "228px";
  await expect.element(switchOf(screen)).toBeVisible();
  const head = screen.container.querySelector<HTMLElement>(".head")!;
  const title = head.querySelector<HTMLElement>(".title")!;
  const count = head.querySelector<HTMLElement>(".count")!;
  const words = head.querySelector<HTMLElement>(".words")!.getBoundingClientRect();
  expect(head.getBoundingClientRect().height).toBe(34);
  expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
  expect(
    Math.abs(count.getBoundingClientRect().top - title.getBoundingClientRect().top),
  ).toBeLessThan(4);
  expect(count.getBoundingClientRect().bottom).toBeLessThanOrEqual(words.bottom);
});

test("the name keeps its whole line at the narrowest column", async () => {
  const screen = await render(BlockerShield, { open: true });
  // 180px, less the panel's own padding.
  screen.container.style.inlineSize = "168px";
  await expect.element(switchOf(screen)).toBeVisible();
  const title = screen.container.querySelector<HTMLElement>(".head .title")!;
  expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
});

test("a count with no room gives way before the name does", async () => {
  const screen = await render(BlockerShield, { open: true });
  screen.container.style.inlineSize = "190px";
  await expect.element(switchOf(screen)).toBeVisible();
  const head = screen.container.querySelector<HTMLElement>(".head")!;
  const title = head.querySelector<HTMLElement>(".title")!;
  const count = head.querySelector<HTMLElement>(".count")!;
  const words = head.querySelector<HTMLElement>(".words")!.getBoundingClientRect();
  expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
  expect(head.getBoundingClientRect().height).toBe(34);
  expect(count.getBoundingClientRect().top).toBeGreaterThanOrEqual(words.bottom);
});

test("a switch that did not go through says so", async () => {
  native.setProtected.mockResolvedValueOnce(false);
  const screen = await render(BlockerShield, { open: true });
  await switchOf(screen).click();
  await expect.element(screen.getByRole("status")).toHaveTextContent("Couldn't change blocking.");
});

test("blocking that is off has no switch, and offers to turn it on", async () => {
  native.status = blocking({
    protection: "disabled",
    applied_enabled: false,
    desired_enabled: false,
  });
  const screen = await render(BlockerShield, { open: true });
  await expect.element(screen.getByText("Turned off in Settings")).toBeVisible();
  await expect.element(screen.getByRole("switch")).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Turn on blocking" }).click();
  expect(native.setEnabled).toHaveBeenCalledExactlyOnceWith(true);
});

test("absent blocking has no section at all", async () => {
  native.status = blocking({ protection: "unavailable", applied_enabled: null });
  const screen = await render(BlockerShield, { open: true });
  await expect.element(screen.getByText("Ad blocking")).not.toBeInTheDocument();
  expect(screen.container.querySelector("section")).toBeNull();
});

test("a page with no site still shows the day's count, with nothing to hide", async () => {
  native.status = blocking({ site: null });
  const screen = await render(BlockerShield, { open: true });
  await expect.element(screen.getByText("12,345", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("switch")).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Hide elements…" }))
    .not.toBeInTheDocument();
});

test("Hide elements starts the picker for this page and leaves the panel", async () => {
  const screen = await render(BlockerShield, { open: true });
  const hide = screen.getByRole("button", { name: "Hide elements…" });
  await expect.element(hide).toHaveAttribute("data-dismiss");
  await hide.click();
  expect(native.hide).toHaveBeenCalledExactlyOnceWith(CONTEXT);
});

test("every row leads with an icon, and a row the keyboard is on has a ring", async () => {
  native.status = blocking({}, { hides: [{ id: "a", label: "Cookie banner" }] });
  const screen = await render(BlockerShield, { open: true });
  await expect.element(switchOf(screen)).toBeVisible();
  const rows = [...screen.container.querySelectorAll<HTMLElement>(".head, button.row")];
  expect(rows).toHaveLength(3);
  for (const row of rows) expect(row.querySelector(".ui-menu-icon svg")).not.toBeNull();

  const hide = screen.getByRole("button", { name: "Hide elements…" });
  hide.element().focus({ focusVisible: true } as FocusOptions);
  await expect.element(hide).toHaveFocus();
  expect(hide.element().matches(":focus-visible")).toBe(true);
  expect(getComputedStyle(hide.element()).outlineStyle).toBe("solid");
});

test("what was hidden is counted, listed on request, and shown again one by one or all", async () => {
  native.status = blocking(
    {},
    {
      hides: [
        { id: "a", label: "Cookie banner" },
        { id: "b", label: "Newsletter" },
      ],
    },
  );
  const screen = await render(BlockerShield, { open: true });
  const hidden = screen.getByRole("button", { name: /Hidden on this site/u });
  await expect.element(hidden).toHaveTextContent("2");
  await expect.element(screen.getByText("Cookie banner")).not.toBeInTheDocument();

  await hidden.click();
  await expect.element(screen.getByText("Cookie banner")).toBeVisible();
  await screen.getByRole("button", { name: "Show Cookie banner again" }).click();
  expect(native.changeSite).toHaveBeenLastCalledWith(CONTEXT, { kind: "remove_hide", id: "a" });

  await screen.getByRole("button", { name: "Show all" }).click();
  expect(native.changeSite).toHaveBeenCalledWith(CONTEXT, { kind: "remove_hide", id: "a" });
  expect(native.changeSite).toHaveBeenLastCalledWith(CONTEXT, { kind: "remove_hide", id: "b" });
});

test("a page whose controls are not ready offers to retry them", async () => {
  native.status = blocking({}, { ready: false });
  const screen = await render(BlockerShield, { open: true });
  await expect.element(screen.getByRole("switch")).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Retry site controls" }).click();
  expect(native.changeSite).toHaveBeenCalledExactlyOnceWith(CONTEXT, { kind: "retry" });
});
