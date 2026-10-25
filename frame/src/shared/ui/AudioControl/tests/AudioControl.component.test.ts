import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import AudioControl from "../AudioControl.svelte";

test("a playing tab offers mute and asks for the opposite of what it shows", async () => {
  const onToggle = vi.fn();
  const screen = await render(AudioControl, {
    audio: { muted: false, can_mute: true },
    onToggle,
  });
  const button = screen.getByRole("button", { name: "Mute tab" });
  await expect.element(button).toHaveAttribute("title", "Playing audio");
  await expect.element(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  expect(onToggle).toHaveBeenCalledWith(true);
});

test("a muted tab says so and offers unmute", async () => {
  const onToggle = vi.fn();
  const screen = await render(AudioControl, {
    audio: { muted: true, can_mute: true },
    onToggle,
  });
  const button = screen.getByRole("button", { name: "Unmute tab" });
  await expect.element(button).toHaveAttribute("title", "Tab muted");
  await expect.element(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  expect(onToggle).toHaveBeenCalledWith(false);
});

test("without engine mute the speaker only informs", async () => {
  const screen = await render(AudioControl, {
    audio: { muted: false, can_mute: false },
    onToggle: () => {},
  });
  await expect.element(screen.getByRole("img", { name: "Playing audio" })).toBeInTheDocument();
  expect(screen.container.querySelector("button")).toBeNull();
});
