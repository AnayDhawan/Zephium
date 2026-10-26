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

test("a secure page is its host on one line, with a shield that says it is secure", async () => {
  const screen = await render(SiteHead, { page: pageOf() });
  await expect.element(screen.getByText("meet.example")).toBeVisible();
  const shield = screen.getByRole("img", { name: "Secure" });
  await expect.element(shield).toHaveAttribute("title", "Secure");
  expect(screen.container.textContent).not.toContain("Secure");
  const header = screen.container.querySelector("header")!;
  expect(header.getBoundingClientRect().height).toBeLessThanOrEqual(36);
  expect(screen.container.querySelectorAll("p")).toHaveLength(0);
});

test("an unencrypted page is not secure, with the port it was reached on", async () => {
  const screen = await render(SiteHead, {
    page: pageOf({ url: "http://meet.example:8080/", security: "insecure" }),
  });
  await expect.element(screen.getByText("meet.example:8080")).toBeVisible();
  await expect.element(screen.getByText("Not secure")).toBeVisible();
  await expect.element(screen.getByRole("img", { name: "Not secure" })).toBeVisible();
  expect(screen.container.textContent).not.toContain("Secure");
});

test("a certificate the person continued past is named, never secure", async () => {
  const screen = await render(SiteHead, { page: pageOf({ security: "untrusted" }) });
  await expect.element(screen.getByText("Certificate not trusted")).toBeVisible();
  await expect.element(screen.getByRole("img", { name: "Certificate not trusted" })).toBeVisible();
  expect(screen.container.textContent).not.toContain("Secure");
});

test("a page with no site has no head", async () => {
  const screen = await render(SiteHead, { page: null });
  expect(screen.container.querySelector("header")).toBeNull();
});

test("a host too long for the column is cut with an ellipsis and named in full", async () => {
  const host = `${"long-subdomain-".repeat(6)}example.com`;
  const screen = await render(SiteHead, { page: pageOf({ url: `https://${host}/` }) });
  screen.container.style.inlineSize = "200px";
  const name = screen.getByText(host);
  await expect.element(name).toHaveAttribute("title", host);
  const element = name.element() as HTMLElement;
  expect(element.scrollWidth).toBeGreaterThan(element.clientWidth);
  expect(getComputedStyle(element).textOverflow).toBe("ellipsis");
});
