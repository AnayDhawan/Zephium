import type { ComponentProps } from "svelte";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import "$styles/global.css";
import type {
  BlockerStatusView,
  SitePermissionKindView,
  SitePermissionsView,
} from "$shared/ipc/bindings";
import { clearRequest } from "$domain/site-data";
import SiteInfoPanel from "../components/SiteInfoPanel.svelte";

const native = vi.hoisted(() => ({
  list: vi.fn<(origin?: string) => Promise<SitePermissionsView | null>>(),
  set: vi.fn(async (..._args: unknown[]) => true),
  setProtected: vi.fn(async (_protect: boolean) => true),
  refresh: vi.fn(async () => {}),
  commands: [] as string[],
  today: 12345 as number | null,
  status: null as unknown as BlockerStatusView,
}));
vi.mock("$domain/permissions", () => ({
  sitePermissions: { list: native.list, set: native.set },
}));
vi.mock("$domain/blocker", async (original) => ({
  ...(await original<typeof import("$domain/blocker")>()),
  blocker: { status: () => native.status, refresh: native.refresh },
  blockerSites: { setProtected: native.setProtected },
}));
vi.mock("$domain/tabs", () => ({
  tabs: { profile: () => ({ id: "profile", name: "Personal", kind: "default" }) },
}));
vi.mock("$shared/ipc/bindings", async () => {
  const { mockBindings } = await import("$shared/testing/bindings");
  return mockBindings({
    runCommand: async (id: string) => {
      native.commands.push(id);
      return { accepted: true, operation_id: null };
    },
    blockerStats: async () =>
      native.today === null
        ? { status: "error" as const, error: null }
        : { status: "ok" as const, data: { today: native.today, last7Days: 0, days: [] } },
  });
});

const KINDS: SitePermissionKindView[] = ["camera", "microphone", "geolocation", "popups"];
const MEET = "https://meet.example/room";

function view(
  entries: SitePermissionsView["entries"] = [],
  over: Partial<SitePermissionsView> = {},
): SitePermissionsView {
  return { private: false, complete: true, kinds: KINDS, entries, ...over };
}

function blocking(over: Record<string, unknown> = {}, paused = false): BlockerStatusView {
  return {
    protection: "active",
    applied_enabled: true,
    site: {
      context: { profile: "profile", tab: "tab", site: "meet.example", revision: "1" },
      paused,
      private_session: false,
      ready: true,
      busy: false,
      hides: [],
    },
    ...over,
  } as unknown as BlockerStatusView;
}

beforeEach(() => {
  native.today = 12345;
  native.commands = [];
  native.status = blocking();
  native.list.mockResolvedValue(view());
});
afterEach(() => {
  vi.clearAllMocks();
  clearRequest.dismiss();
});

function panel(props: Partial<ComponentProps<typeof SiteInfoPanel>> = {}) {
  return render(SiteInfoPanel, { url: MEET, security: "secure", open: true, ...props });
}

test("a secure page says so beside its host", async () => {
  const screen = await panel();
  await expect.element(screen.getByText("meet.example")).toBeVisible();
  await expect.element(screen.getByText("Connection is secure")).toBeVisible();
  expect(screen.container.textContent).not.toContain("Not secure");
});

test("an unencrypted page is not secure, and says who could see", async () => {
  const screen = await panel({ url: "http://meet.example:8080/", security: "insecure" });
  await expect.element(screen.getByText("meet.example:8080")).toBeVisible();
  await expect.element(screen.getByText("Not secure")).toBeVisible();
  await expect.element(screen.getByText(/Others on the network/u)).toBeVisible();
  expect(screen.container.textContent).not.toContain("Connection is secure");
});

test("a certificate the person continued past is named, never secure", async () => {
  const screen = await panel({ security: "untrusted" });
  await expect
    .element(screen.getByText("Certificate not trusted, you chose to continue"))
    .toBeVisible();
  expect(screen.container.textContent).not.toContain("Connection is secure");
});

test("nothing is read until the panel is open, and it reads again each time it opens", async () => {
  const screen = await panel({ open: false });
  expect(native.list).not.toHaveBeenCalled();
  expect(native.refresh).not.toHaveBeenCalled();
  await screen.rerender({ url: MEET, security: "secure", open: true });
  await expect.poll(() => native.list.mock.calls.length).toBe(1);
  expect(native.list).toHaveBeenCalledWith("https://meet.example");
  expect(native.refresh).toHaveBeenCalledTimes(1);
  await screen.rerender({ url: MEET, security: "secure", open: false });
  await screen.rerender({ url: MEET, security: "secure", open: true });
  await expect.poll(() => native.list.mock.calls.length).toBe(2);
});

test("a site with no decision says it will ask, and lists nothing to change", async () => {
  const screen = await panel();
  await expect
    .element(screen.getByText("No permissions set. This site will ask if it needs one."))
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Reset permissions" }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("list")).not.toBeInTheDocument();
});

test("each decision is a row whose choice is written through, and the list is read again", async () => {
  native.list.mockResolvedValue(
    view([
      { origin: "https://meet.example", kind: "camera", decision: "allow" },
      { origin: "https://meet.example", kind: "geolocation", decision: "block" },
    ]),
  );
  const screen = await panel();
  const camera = screen.getByRole("button", { name: "Camera" });
  await expect.element(camera).toHaveTextContent("Allow");
  expect(native.set).not.toHaveBeenCalled();
  await expect.element(screen.getByRole("button", { name: "Location" })).toHaveTextContent("Block");
  await expect.element(screen.getByRole("button", { name: "Microphone" })).not.toBeInTheDocument();

  await camera.click();
  await page.getByRole("menu", { name: "Camera" }).getByRole("menuitem", { name: "Block" }).click();
  expect(native.set).toHaveBeenLastCalledWith("https://meet.example", "camera", "block");
  await expect.poll(() => native.list.mock.calls.length).toBe(2);

  await screen.getByRole("button", { name: "Location" }).click();
  await page.getByRole("menu", { name: "Location" }).getByRole("menuitem", { name: "Ask" }).click();
  expect(native.set).toHaveBeenLastCalledWith("https://meet.example", "geolocation", null);
  // A row set back to Ask stays, so it does not vanish under the pointer.
  await expect.element(screen.getByRole("button", { name: "Location" })).toBeVisible();
});

test("pop-ups offer Allow and Block only, and a block forgets the allowance", async () => {
  native.list.mockResolvedValue(
    view([{ origin: "https://meet.example", kind: "popups", decision: "allow" }]),
  );
  const screen = await panel();
  await screen.getByRole("button", { name: "Pop-ups & redirects" }).click();
  await expect.element(page.getByRole("menuitem", { name: "Ask" })).not.toBeInTheDocument();
  await page.getByRole("menuitem", { name: "Block" }).click();
  expect(native.set).toHaveBeenLastCalledWith("https://meet.example", "popups", null);
});

test("a camera or microphone in use has a row, marked, with no decision saved", async () => {
  const screen = await panel({ capture: { camera: "active", microphone: "none" } });
  await expect.element(screen.getByRole("button", { name: "Camera" })).toHaveTextContent("Ask");
  await expect.element(screen.getByText("In use")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Microphone" })).not.toBeInTheDocument();
});

test("a change that did not go through says so and shows what is saved", async () => {
  native.list.mockResolvedValue(
    view([{ origin: "https://meet.example", kind: "camera", decision: "allow" }]),
  );
  native.set.mockResolvedValueOnce(false);
  const screen = await panel();
  await screen.getByRole("button", { name: "Camera" }).click();
  await page.getByRole("menuitem", { name: "Block" }).click();
  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent("Couldn't change this site's permission.");
  await expect.element(screen.getByRole("button", { name: "Camera" })).toHaveTextContent("Allow");
});

test("Reset permissions forgets every decision of this site and lists none", async () => {
  native.list
    .mockResolvedValueOnce(
      view([
        { origin: "https://meet.example", kind: "camera", decision: "allow" },
        { origin: "https://meet.example", kind: "popups", decision: "allow" },
      ]),
    )
    .mockResolvedValue(view());
  const screen = await panel();
  await screen.getByRole("button", { name: "Reset permissions" }).click();
  await expect.poll(() => native.set.mock.calls.length).toBe(2);
  expect(native.set).toHaveBeenCalledWith("https://meet.example", "camera", null);
  expect(native.set).toHaveBeenCalledWith("https://meet.example", "popups", null);
  await expect.element(screen.getByText(/No permissions set/u)).toBeVisible();
  // The pressed button is gone; the keyboard stays in the panel.
  await expect.element(screen.getByRole("region", { name: "Permissions" })).toHaveFocus();
  await expect
    .element(screen.getByRole("button", { name: "Reset permissions" }))
    .not.toBeInTheDocument();
});

test("permissions that cannot be read are not shown as empty", async () => {
  native.list.mockResolvedValue(null);
  const screen = await panel();
  await expect.element(screen.getByText("Site settings are unavailable right now.")).toBeVisible();
  expect(screen.container.textContent).not.toContain("No permissions set");
});

test("a partly unreadable list keeps its rows and says so", async () => {
  native.list.mockResolvedValue(
    view([{ origin: "https://meet.example", kind: "popups", decision: "allow" }], {
      complete: false,
    }),
  );
  const screen = await panel();
  await expect.element(screen.getByRole("button", { name: "Pop-ups & redirects" })).toBeVisible();
  await expect
    .element(screen.getByText("Some permissions couldn't be read right now."))
    .toBeVisible();
});

test("a private window says its permissions are one-time, and offers nothing to change", async () => {
  const onSiteSettings = vi.fn();
  const screen = await panel({ privateWindow: true, onSiteSettings });
  await expect.element(screen.getByText(/one-time only/u)).toBeVisible();
  expect(native.list).not.toHaveBeenCalled();
  await expect
    .element(screen.getByRole("button", { name: "Reset permissions" }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("list")).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Clear data for this site…" }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("button", { name: "Site settings" }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByText("Connection is secure")).toBeVisible();
  await expect
    .element(screen.getByRole("switch", { name: "Block ads and trackers" }))
    .toBeVisible();
});

test("blocking shows the day's count and pauses the site from the switch", async () => {
  const screen = await panel();
  const toggle = screen.getByRole("switch", { name: "Block ads and trackers" });
  await expect.element(toggle).toBeChecked();
  await expect
    .element(screen.getByText(/blocked today/u))
    .toHaveTextContent("12,345 blocked today");
  await toggle.click();
  expect(native.setProtected).toHaveBeenCalledExactlyOnceWith(false);
});

test("a paused site says so and the switch resumes it", async () => {
  native.status = blocking({}, true);
  const screen = await panel();
  await expect.element(screen.getByText("Paused on this site")).toBeVisible();
  const toggle = screen.getByRole("switch", { name: "Block ads and trackers" });
  await expect.element(toggle).not.toBeChecked();
  await toggle.click();
  expect(native.setProtected).toHaveBeenCalledExactlyOnceWith(true);
});

test("a count that cannot be read is not shown as zero", async () => {
  native.today = null;
  const screen = await panel();
  await expect.element(screen.getByText("On for this site")).toBeVisible();
  expect(screen.container.textContent).not.toContain("blocked today");
});

test("blocking that is off has no switch, and absent blocking has no section", async () => {
  native.status = blocking({ protection: "disabled", applied_enabled: false });
  const off = await panel();
  await expect.element(off.getByText("Turned off in Settings")).toBeVisible();
  await expect.element(off.getByRole("switch")).not.toBeInTheDocument();
  off.unmount();

  native.status = blocking({ protection: "unavailable", applied_enabled: null });
  const none = await panel();
  await expect.element(none.getByText("Block ads and trackers")).not.toBeInTheDocument();
});

test("a switch that did not go through says so", async () => {
  native.setProtected.mockResolvedValueOnce(false);
  const screen = await panel();
  await screen.getByRole("switch", { name: "Block ads and trackers" }).click();
  await expect.element(screen.getByRole("alert")).toHaveTextContent("Couldn't change blocking.");
});

test("zoom shows only away from the default, and Reset puts it back", async () => {
  const screen = await panel({ zoom: 125, standardZoom: 100 });
  await expect.element(screen.getByText("Page zoom")).toBeVisible();
  await expect.element(screen.getByRole("status")).toHaveTextContent("125%");
  await screen.getByRole("button", { name: "Reset", exact: true }).click();
  expect(native.commands).toEqual(["zoom.reset"]);
  await screen.rerender({
    url: MEET,
    security: "secure",
    open: true,
    zoom: 100,
    standardZoom: 100,
  });
  await expect.element(screen.getByText("Page zoom")).not.toBeInTheDocument();
});

test("a page at the default zoom, or with none yet, shows no zoom", async () => {
  const at = await panel({ zoom: 100, standardZoom: 100 });
  await expect.element(at.getByText("Page zoom")).not.toBeInTheDocument();
  at.unmount();
  const none = await panel({ zoom: null });
  await expect.element(none.getByText("Page zoom")).not.toBeInTheDocument();
});

test("Clear data asks the existing confirmation for this site", async () => {
  const screen = await panel();
  await screen.getByRole("button", { name: "Clear data for this site…" }).click();
  expect(clearRequest.pending()).toEqual({ url: MEET, host: "meet.example" });
});

test("Site settings goes to the list of decisions", async () => {
  const onSiteSettings = vi.fn();
  const screen = await panel({ onSiteSettings });
  await screen.getByRole("button", { name: "Site settings" }).click();
  expect(onSiteSettings).toHaveBeenCalledOnce();
});
