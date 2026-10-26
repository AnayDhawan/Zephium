<script lang="ts">
  import { untrack } from "svelte";
  import * as m from "$shared/i18n/messages";
  import type {
    SitePermissionDecisionView,
    SitePermissionKindView,
    SitePermissionsView,
  } from "$shared/ipc/bindings";
  import { sitePermissions } from "$domain/permissions";
  import Button from "$shared/ui/Button";
  import ChoiceMenu from "./ChoiceMenu.svelte";
  import {
    choiceOf,
    decisionOf,
    kindsInUse,
    permissionChoices,
    shownKinds,
    type PermissionChoice,
  } from "../lib/site-info";

  /** `origin` is the site's canonical origin. It reads its decisions each time
   *  `open` turns true, and never while closed. */
  let {
    origin,
    open,
    capture = null,
    privateWindow = false,
  }: {
    origin: string;
    open: boolean;
    capture?: { camera: string; microphone: string } | null;
    privateWindow?: boolean;
  } = $props();

  const labels: Record<SitePermissionKindView, () => string> = {
    camera: m.pref_privacy_camera,
    microphone: m.pref_privacy_microphone,
    geolocation: m.pref_privacy_location,
    notifications: m.pref_privacy_notifications,
    clipboard_read: m.permission_clipboard,
    midi: m.site_permission_midi,
    sensors: m.site_permission_sensors,
    local_fonts: m.site_permission_local_fonts,
    automatic_downloads: m.permission_automatic_downloads,
    popups: m.permission_popups,
  };
  const choiceLabels: Record<PermissionChoice, () => string> = {
    allow: m.permission_allow,
    block: m.permission_block,
    ask: m.permission_ask,
  };

  let view = $state.raw<SitePermissionsView | null>(null);
  let loaded = $state(false);
  let busy = $state(false);
  let failed = $state(false);
  let decided = $state.raw<Partial<Record<SitePermissionKindView, SitePermissionDecisionView>>>({});
  let touched = $state.raw(new Set<SitePermissionKindView>());
  // What was just picked, shown until it is saved; a change that did not go
  // through puts the select back to what is.
  let choosing = $state.raw<Partial<Record<SitePermissionKindView, PermissionChoice>>>({});
  let section = $state<HTMLElement>();
  let latest = 0;

  let inUse = $derived(kindsInUse(capture));
  let shown = $derived(
    shownKinds(
      view?.kinds ?? [],
      new Set(Object.keys(decided) as SitePermissionKindView[]),
      inUse,
      touched,
    ),
  );
  let saved = $derived(Object.keys(decided).length > 0);

  async function load() {
    const mine = ++latest;
    const next = await sitePermissions.list(origin);
    if (mine !== latest) return;
    view = next;
    loaded = true;
    decided = Object.fromEntries(
      (next?.entries ?? [])
        .filter((entry) => entry.origin === origin)
        .map((entry) => [entry.kind, entry.decision]),
    );
  }

  $effect(() => {
    void origin;
    if (!open || privateWindow) return;
    untrack(() => {
      touched = new Set();
      failed = false;
      void load();
    });
  });

  async function change(kind: SitePermissionKindView, choice: PermissionChoice) {
    if (busy || choice === choiceOf(decided[kind])) return;
    busy = true;
    failed = false;
    touched = new Set([...touched, kind]);
    choosing = { ...choosing, [kind]: choice };
    failed = !(await sitePermissions.set(origin, kind, decisionOf(kind, choice)));
    await load();
    choosing = {};
    busy = false;
  }

  async function reset() {
    if (busy) return;
    busy = true;
    failed = false;
    for (const kind of Object.keys(decided) as SitePermissionKindView[]) {
      if (!(await sitePermissions.set(origin, kind, null))) failed = true;
    }
    touched = new Set();
    await load();
    busy = false;
    // The button that was pressed is gone; the keyboard stays in the panel.
    section?.focus({ preventScroll: true });
  }
</script>

<section
  class="permissions"
  bind:this={section}
  tabindex="-1"
  aria-label={m.site_info_permissions()}
  aria-busy={!loaded || undefined}
>
  <header>
    <h3>{m.site_info_permissions()}</h3>
    {#if !privateWindow && saved}
      <Button size="compact" variant="ghost" disabled={busy} onclick={() => void reset()}>
        {m.site_info_permissions_reset()}
      </Button>
    {/if}
  </header>
  {#if privateWindow}
    <p class="note">{m.site_info_permissions_private()}</p>
  {:else if loaded && view === null}
    <p class="note">{m.site_settings_unavailable()}</p>
  {:else if loaded}
    {#if shown.length === 0}
      <p class="note">{m.site_info_permissions_empty()}</p>
    {:else}
      <ul>
        {#each shown as kind (kind)}
          <li>
            <span class="name">
              <span aria-hidden="true">{labels[kind]()}</span>
              {#if inUse.has(kind)}<span class="use">{m.site_info_in_use()}</span>{/if}
            </span>
            <ChoiceMenu
              label={labels[kind]()}
              options={permissionChoices(kind).map((choice) => ({
                value: choice,
                label: choiceLabels[choice](),
              }))}
              value={choosing[kind] ?? choiceOf(decided[kind])}
              onchange={(value) => void change(kind, value as PermissionChoice)}
            />
          </li>
        {/each}
      </ul>
    {/if}
    {#if view && !view.complete}
      <p class="note">{m.site_info_permissions_partial()}</p>
    {/if}
  {/if}
  {#if failed}
    <p class="note error" role="alert">{m.site_settings_failed()}</p>
  {/if}
</section>

<style>
  .permissions {
    display: grid;
    gap: 2px;
    outline: none;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-block-size: 24px;
  }

  h3 {
    margin: 0;
    color: var(--color-faint);
    font-size: var(--text-caption);
    font-weight: 550;
    letter-spacing: 0.01em;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-block-size: 34px;
  }

  .name {
    display: grid;
    min-inline-size: 0;
    font-size: var(--text-body);
    line-height: 16px;
  }

  .name > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .use {
    color: var(--color-danger);
    font-size: var(--text-caption);
    line-height: 14px;
  }

  .note {
    margin: 0;
    color: var(--color-muted);
    font-size: var(--text-label);
    line-height: 16px;
  }

  .error {
    color: var(--color-danger);
  }
</style>
