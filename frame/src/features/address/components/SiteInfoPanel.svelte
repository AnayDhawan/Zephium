<script lang="ts">
  import { tick } from "svelte";
  import {
    Alert02Icon,
    ArrowUpRight01Icon,
    CookieIcon,
    LockIcon,
  } from "@hugeicons/core-free-icons";
  import * as m from "$shared/i18n/messages";
  import { clearRequest, pageSite } from "$domain/site-data";
  import { commands } from "$shared/ipc/bindings";
  import Button from "$shared/ui/Button";
  import Icon from "$shared/ui/Icon";
  import { restingAddress, type AddressSecurity } from "../lib/address-model";
  import SiteBlocking from "./SiteBlocking.svelte";
  import SitePermissions from "./SitePermissions.svelte";

  /** Everything about the page in front that can be seen or changed from one
   *  place. `open` is whether the panel is showing; nothing is read while it
   *  is not. */
  let {
    url,
    security,
    open,
    zoom = null,
    standardZoom = 100,
    capture = null,
    privateWindow = false,
    onSiteSettings,
  }: {
    url: string;
    security: AddressSecurity;
    open: boolean;
    zoom?: number | null;
    standardZoom?: number;
    capture?: { camera: string; microphone: string } | null;
    privateWindow?: boolean;
    onSiteSettings?: () => void;
  } = $props();

  let body = $state<HTMLElement>();
  let site = $derived(pageSite(url));
  let host = $derived(restingAddress(url));
  let secure = $derived(security === "secure");
  let status = $derived(
    security === "untrusted"
      ? m.site_info_untrusted()
      : security === "insecure"
        ? m.site_info_insecure()
        : m.site_info_secure(),
  );
  let zoomed = $derived(zoom !== null && zoom !== standardZoom);

  // The panel takes the keyboard when it opens, so Escape closes it from
  // wherever it was opened, and after a control in it goes.
  $effect(() => {
    if (open) body?.focus({ preventScroll: true });
  });

  async function resetZoom() {
    await commands.runCommand("zoom.reset");
    await tick();
    body?.focus({ preventScroll: true });
  }
</script>

<div class="panel" bind:this={body} tabindex="-1">
  <header>
    <span class="mark" data-secure={secure || undefined}>
      <Icon icon={secure ? LockIcon : Alert02Icon} size={15} />
    </span>
    <span class="words">
      <span class="host" title={host}>{host}</span>
      <span class="status" data-secure={secure || undefined}>{status}</span>
      {#if security === "insecure"}<span class="help">{m.site_info_insecure_help()}</span>{/if}
    </span>
  </header>

  {#if site}
    <SitePermissions origin={site.origin} {open} {capture} {privateWindow} />
  {/if}

  <SiteBlocking {open} />

  {#if zoomed}
    <div class="zoom">
      <span class="name">{m.site_info_zoom()}</span>
      <output aria-live="polite">{m.zoom_percent({ percent: zoom ?? standardZoom })}</output>
      <Button size="compact" onclick={() => void resetZoom()}>{m.zoom_reset()}</Button>
    </div>
  {/if}

  {#if !privateWindow}
    <div class="actions">
      <button
        type="button"
        class="ui-menu-item row"
        data-dismiss
        onclick={() => clearRequest.ask(url)}
      >
        <span class="glyph"><Icon icon={CookieIcon} size={15} /></span>
        <span>{m.site_info_clear_data()}</span>
      </button>
      {#if onSiteSettings}
        <button type="button" class="ui-menu-item row" data-dismiss onclick={onSiteSettings}>
          <span class="glyph"><Icon icon={ArrowUpRight01Icon} size={15} /></span>
          <span>{m.site_settings_title()}</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .panel {
    display: grid;
    gap: 0;
    outline: none;
  }

  /* The panel is a menu's width of padding; text sits where a row's does. */
  .panel > :global(:not(.actions)) {
    padding-inline: var(--menu-item-inset);
  }

  /* One hairline between sections, only where two are showing. */
  .panel > :global(* + *) {
    margin-block-start: 6px;
    padding-block-start: 6px;
    border-block-start: 1px solid var(--color-menu-separator);
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .mark {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: 20px;
    block-size: 20px;
    color: var(--color-danger);
  }

  .mark[data-secure] {
    color: var(--color-success);
  }

  .words {
    display: grid;
    flex: 1;
    min-inline-size: 0;
  }

  .host {
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--text-body);
    font-weight: 600;
    letter-spacing: -0.005em;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status {
    color: var(--color-danger);
    font-size: var(--text-label);
    line-height: 16px;
  }

  .status[data-secure] {
    color: var(--color-muted);
  }

  .help {
    margin-block-start: 2px;
    color: var(--color-muted);
    font-size: var(--text-caption);
    line-height: 14px;
  }

  .zoom {
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: 34px;
  }

  .zoom .name {
    flex: 1;
    font-size: var(--text-body);
  }

  .zoom output {
    color: var(--color-muted);
    font-size: var(--text-label);
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: grid;
  }

  .row {
    inline-size: 100%;
    border: 0;
    background: transparent;
    font: inherit;
    text-align: start;
  }

  .row:focus-visible,
  .row:hover {
    background: var(--row-active);
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: 16px;
    color: var(--color-muted);
  }
</style>
