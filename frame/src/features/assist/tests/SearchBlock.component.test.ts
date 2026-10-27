import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import "$styles/global.css";
import SearchBlock from "../components/blocks/SearchBlock.svelte";

test("the exact search and destination are shown before any approval", async () => {
  const query = "Confidential “client” budget <script>71329</script> euros";
  const ondecide = vi.fn();
  render(SearchBlock, {
    destination: "search.example",
    query,
    state: "confirm",
    inert: false,
    ondecide,
  });
  await expect.element(page.getByRole("heading", { name: "Search search.example?" })).toBeVisible();
  await expect.element(page.getByText(query, { exact: true })).toBeVisible();
  expect(ondecide).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  expect(ondecide).toHaveBeenCalledExactlyOnceWith("approve");
  await expect.element(page.getByRole("button", { name: "Search", exact: true })).toBeDisabled();
});

test("restored or stopped search proposals cannot be approved", async () => {
  const ondecide = vi.fn();
  render(SearchBlock, {
    destination: "search.example",
    query: "private marker",
    state: "confirm",
    inert: true,
    ondecide,
  });
  await expect.element(page.getByText("private marker", { exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Search", exact: true }))
    .not.toBeInTheDocument();
  expect(ondecide).not.toHaveBeenCalled();
});
