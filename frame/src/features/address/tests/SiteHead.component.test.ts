import { expect, test } from "vitest";
import { render } from "vitest-browser-svelte";
import "$styles/global.css";
import SiteHead from "../components/SiteHead.svelte";
import type { SitePage } from "../lib/address-model";

function pageOf(over: Partial<SitePage> = {}): SitePage {
  return {
    url: "https://meet.example/room",
    security: "secure",
    warning: null,
    capture: null,
    privateWindow: false,
    zoom: null,
    standardZoom: 100,
    ...over,
  };
}

test("a secure page says its host and that it is secure, in one line each", async () => {
  const screen = await render(SiteHead, { page: pageOf() });
  await expect.element(screen.getByText("meet.example")).toBeVisible();
  await expect.element(screen.getByText("Secure", { exact: true })).toBeVisible();
  expect(screen.container.querySelectorAll("p")).toHaveLength(0);
});

test("an unencrypted page is not secure, with the port it was reached on", async () => {
  const screen = await render(SiteHead, {
    page: pageOf({ url: "http://meet.example:8080/", security: "insecure" }),
  });
  await expect.element(screen.getByText("meet.example:8080")).toBeVisible();
  await expect.element(screen.getByText("Not secure")).toBeVisible();
  expect(screen.container.textContent).not.toContain("Secure");
});

test("a certificate the person continued past is named, never secure", async () => {
  const screen = await render(SiteHead, { page: pageOf({ security: "untrusted" }) });
  await expect.element(screen.getByText("Certificate not trusted")).toBeVisible();
  expect(screen.container.textContent).not.toContain("Secure");
});

test("a page with no site has no head", async () => {
  const screen = await render(SiteHead, { page: null });
  expect(screen.container.querySelector("header")).toBeNull();
});
