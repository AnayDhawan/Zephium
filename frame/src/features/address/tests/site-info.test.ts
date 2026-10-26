import { expect, test } from "vitest";
import type { SitePermissionKindView } from "$shared/ipc/bindings";
import { choiceOf, decisionOf, kindsInUse, permissionChoices, shownKinds } from "../lib/site-info";

test("pop-ups can only be allowed or blocked; everything else can also ask", () => {
  expect(permissionChoices("popups")).toEqual(["allow", "block"]);
  expect(permissionChoices("camera")).toEqual(["allow", "block", "ask"]);
});

test("a choice saves a decision, and asking or blocking pop-ups forgets one", () => {
  expect(decisionOf("camera", "allow")).toBe("allow");
  expect(decisionOf("camera", "block")).toBe("block");
  expect(decisionOf("camera", "ask")).toBeNull();
  expect(decisionOf("popups", "allow")).toBe("allow");
  expect(decisionOf("popups", "block")).toBeNull();
});

test("no saved decision reads as Ask", () => {
  expect(choiceOf(undefined)).toBe("ask");
  expect(choiceOf("allow")).toBe("allow");
  expect(choiceOf("block")).toBe("block");
});

test("only a device the page is using counts as in use", () => {
  expect(kindsInUse(null)).toEqual(new Set());
  expect(kindsInUse({ camera: "none", microphone: "none" })).toEqual(new Set());
  expect(kindsInUse({ camera: "active", microphone: "muted" })).toEqual(
    new Set(["camera", "microphone"]),
  );
  expect(kindsInUse({ camera: "none", microphone: "active" })).toEqual(new Set(["microphone"]));
});

test("rows are the platform's kinds that were decided, used or changed, in its order", () => {
  const kinds = ["camera", "microphone", "geolocation", "popups"] as const;
  const some = (...of: SitePermissionKindView[]) => new Set(of);
  expect(shownKinds(kinds, some())).toEqual([]);
  expect(shownKinds(kinds, some("popups"), some("camera"), some("geolocation"))).toEqual([
    "camera",
    "geolocation",
    "popups",
  ]);
  expect(shownKinds(kinds, some("notifications"))).toEqual([]);
});
