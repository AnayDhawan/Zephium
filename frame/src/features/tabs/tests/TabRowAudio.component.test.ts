import { beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { tabFixture } from "$shared/testing/fixtures";
import TabRow from "../components/TabRow.svelte";

const native = vi.hoisted(() => ({ mute: vi.fn(), settle: vi.fn() }));
vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({ tabSetMuted: native.mute });
});
vi.mock("$domain/operations", async (original) => ({
  ...(await original<typeof import("$domain/operations")>()),
  settle: native.settle,
}));

beforeEach(() => {
  vi.clearAllMocks();
  native.mute.mockResolvedValue({ accepted: true, operation_id: "mute" });
  native.settle.mockResolvedValue({ outcome: "applied", disposition: null });
});

function row(tab: ReturnType<typeof tabFixture>, onSelect = vi.fn()) {
  return render(TabRow, {
    tab,
    active: false,
    splitCandidate: false,
    onSelect,
    onClose: vi.fn(),
    onContextMenu: vi.fn(),
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
  });
}

test("a quiet tab shows no speaker", async () => {
  const screen = await row(tabFixture());
  expect(screen.container.querySelector("[data-zephium-audio-control]")).toBeNull();
});

test("the speaker mutes its own tab without selecting it", async () => {
  const tab = tabFixture({ audio: { muted: false, can_mute: true } });
  const onSelect = vi.fn();
  const screen = await row(tab, onSelect);
  await screen.getByRole("button", { name: "Mute tab" }).click();
  await expect.poll(() => native.mute.mock.calls).toEqual([[tab.id, true]]);
  expect(onSelect).not.toHaveBeenCalled();
});

test("a muted tab keeps its speaker and unmutes", async () => {
  const tab = tabFixture({ audio: { muted: true, can_mute: true } });
  const screen = await row(tab);
  await screen.getByRole("button", { name: "Unmute tab" }).click();
  await expect.poll(() => native.mute.mock.calls).toEqual([[tab.id, false]]);
});
