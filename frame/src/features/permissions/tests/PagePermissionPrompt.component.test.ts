import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import "$styles/global.css";
import type { PagePermissionPromptEntryView } from "$shared/ipc/bindings";
import PagePermissionPrompt from "../components/PagePermissionPrompt.svelte";

const native = vi.hoisted(() => ({ respond: vi.fn() }));
vi.mock("$domain/permissions", () => ({
  pagePermissions: { busy: () => false, failure: () => null, respond: native.respond },
}));
afterEach(() => vi.clearAllMocks());

const prompt = (rememberable: boolean): PagePermissionPromptEntryView => ({
  profile_id: "00000000000000000000000901",
  item_id: "00000000000000000000000902",
  request_id: "0000000000000007",
  origin: "https://meet.example",
  kinds: ["camera", "microphone"],
  rememberable,
  processing: false,
});

test("a saved profile offers the three choices and sends each one", async () => {
  const shown = prompt(true);
  const screen = await render(PagePermissionPrompt, { prompt: shown });
  await expect.element(screen.getByText("Use your camera and microphone?")).toBeVisible();
  await expect.element(screen.getByText("https://meet.example")).toBeVisible();
  await expect
    .element(screen.getByText("Zephium will ask again next time."))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Never allow" })).toHaveFocus();
  for (const [name, decision] of [
    ["Allow while visiting the site", "always_allow"],
    ["Allow this time", "allow_once"],
    ["Never allow", "always_deny"],
  ] as const) {
    await screen.getByRole("button", { name }).click();
    expect(native.respond).toHaveBeenLastCalledWith(shown, decision);
  }
});

test("a private profile offers only one-time choices", async () => {
  const shown = prompt(false);
  const screen = await render(PagePermissionPrompt, { prompt: shown });
  await expect.element(screen.getByText("Zephium will ask again next time.")).toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Allow while visiting the site" }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Never allow" })).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Allow this time" }).click();
  expect(native.respond).toHaveBeenLastCalledWith(shown, "allow_once");
  await screen.getByRole("button", { name: "Don't allow" }).click();
  expect(native.respond).toHaveBeenLastCalledWith(shown, "deny_once");
});

test("Escape answers this request only", async () => {
  const shown = prompt(true);
  const screen = await render(PagePermissionPrompt, { prompt: shown });
  await expect.element(screen.getByRole("button", { name: "Never allow" })).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(native.respond).toHaveBeenLastCalledWith(shown, "deny_once");
});

test("a location request names what the site will learn", async () => {
  const shown = { ...prompt(true), kinds: ["geolocation" as const] };
  const screen = await render(PagePermissionPrompt, { prompt: shown });
  await expect.element(screen.getByText("Know your location?")).toBeVisible();
  await expect
    .element(screen.getByText("Granting access lets this site know where you are."))
    .toBeVisible();
  await screen.getByRole("button", { name: "Allow while visiting the site" }).click();
  expect(native.respond).toHaveBeenLastCalledWith(shown, "always_allow");
});
