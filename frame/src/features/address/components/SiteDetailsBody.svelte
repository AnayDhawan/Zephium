<script lang="ts">
  import { Add01Icon, MinusSignIcon } from "@hugeicons/core-free-icons";
  import * as m from "$shared/i18n/messages";
  import { clearRequest, pageSite } from "$domain/site-data";
  import { commands } from "$shared/ipc/bindings";
  import Button from "$shared/ui/Button";
  import IconButton from "$shared/ui/IconButton";
  import type { SitePage } from "../lib/address-model";
  import SitePermissions from "./SitePermissions.svelte";

  /** The decisions the site has, how far the page is zoomed, and its data.
   *  Each is its own section of the panel, or nothing. */
  let { page, open }: { page: SitePage; open: boolean } = $props();

  let site = $derived(pageSite(page.url));
  let zoomed = $derived(page.zoom !== null && page.zoom !== page.standardZoom);
  // The row that stepped the page back to the default stays until the panel
  // closes, so the control pressed is not taken from under the pointer.
  let stayed = $state(false);
  $effect(() => {
    if (!open) stayed = false;
    else if (zoomed) stayed = true;
  });

  const step = (command: string) => void commands.runCommand(command);
</script>

{#if site && !page.privateWindow}
  <SitePermissions origin={site.origin} {open} capture={page.capture} />
{/if}

{#if zoomed || stayed}
  <div class="zoom" role="group" aria-label={m.site_info_zoom()}>
    <span class="name">{m.site_info_zoom()}</span>
    <div class="controls">
      <IconButton
        icon={MinusSignIcon}
        size={14}
        buttonSize={26}
        label={m.command_zoom_out()}
        onclick={() => step("zoom.out")}
      />
      <output aria-live="polite"
        >{m.zoom_percent({ percent: page.zoom ?? page.standardZoom })}</output
      >
      <IconButton
        icon={Add01Icon}
        size={14}
        buttonSize={26}
        label={m.command_zoom_in()}
        onclick={() => step("zoom.in")}
      />
      <Button size="compact" onclick={() => step("zoom.reset")}>{m.zoom_reset()}</Button>
    </div>
  </div>
{/if}

{#if !page.privateWindow}
  <div class="rows">
    <button
      type="button"
      class="ui-menu-item row"
      data-dismiss
      onclick={() => clearRequest.ask(page.url)}
    >
      {m.site_info_clear_data()}
    </button>
  </div>
{/if}

<style>
  /* In a narrow column the controls drop under the name, together. */
  .zoom {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 8px;
    min-block-size: 36px;
    padding-inline: var(--menu-item-inset);
  }

  .name {
    flex: 1 1 auto;
    min-inline-size: 0;
    font-size: var(--text-body);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-inline-start: auto;
  }

  output {
    min-inline-size: 40px;
    margin-inline-end: 2px;
    color: var(--color-text);
    font-size: var(--text-label);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .row {
    inline-size: 100%;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: var(--text-body);
    text-align: start;
  }

  .row:focus-visible,
  .row:hover {
    background: var(--row-active);
  }
</style>
