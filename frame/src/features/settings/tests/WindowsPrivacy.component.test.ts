import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import WindowsPrivacy from "../components/WindowsPrivacy.svelte";

const native = vi.hoisted(() => ({ diagnostics: vi.fn(), set: vi.fn() }));
vi.mock("$domain/preferences", () => ({
  preferences: { value: () => "true", saving: () => false, set: native.set },
}));
vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({ windowsDiagnosticsSettings: native.diagnostics });
});
afterEach(() => vi.clearAllMocks());

test("SmartScreen defaults on, explains disclosure and restart, and writes its own preference", async () => {
  const screen = await render(WindowsPrivacy);
  const toggle = page.getByRole("switch", { name: "Microsoft Defender SmartScreen" });
  await expect.element(toggle).toBeChecked();
  expect(screen.container.textContent).toContain("website addresses and download information");
  expect(screen.container.textContent).toContain("Restart Zephium to apply changes");
  expect(screen.container.textContent).toContain("required diagnostic data");
  expect(screen.container.textContent).toContain("even when optional diagnostics are off");
  await toggle.click();
  expect(native.set).toHaveBeenCalledWith("privacy.smartscreen", "false");
});

test("Windows diagnostic settings reports a failed launch and permits retry", async () => {
  native.diagnostics.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await render(WindowsPrivacy);
  const button = page.getByRole("button", { name: "Windows diagnostic settings" });
  await button.click();
  await expect
    .element(page.getByRole("status"))
    .toHaveTextContent("Could not open Windows Settings");
  await button.click();
  await expect.element(page.getByRole("status")).not.toBeInTheDocument();
  expect(native.diagnostics).toHaveBeenCalledTimes(2);
});
