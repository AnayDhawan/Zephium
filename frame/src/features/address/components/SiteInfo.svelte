<script lang="ts">
  import { Alert02Icon, SlidersHorizontalIcon } from "@hugeicons/core-free-icons";
  import * as m from "$shared/i18n/messages";
  import Disclosure from "$shared/ui/Disclosure";
  import Icon from "$shared/ui/Icon";
  import type { AddressSecurity } from "../lib/address-model";

  /** The glyph at the field's start, and the panel it opens about the page in
   *  front. The panel loads, and reads anything, only once it is opened. */
  let {
    url,
    security,
    zoom = null,
    standardZoom = 100,
    capture = null,
    privateWindow = false,
    onSiteSettings,
  }: {
    url: string;
    security: AddressSecurity;
    zoom?: number | null;
    standardZoom?: number;
    capture?: { camera: string; microphone: string } | null;
    privateWindow?: boolean;
    onSiteSettings?: () => void;
  } = $props();

  let Panel = $state<typeof import("./SiteInfoPanel.svelte").default | null>(null);
  let failed = $state(false);
  let loading = false;
  let open = $state(false);

  // Only a problem earns colour; a secure page, the web's default, is a quiet glyph.
  let warning = $derived(
    security === "untrusted"
      ? m.address_certificate_exception()
      : security === "insecure"
        ? m.address_insecure()
        : null,
  );

  function opened() {
    open = true;
    if (Panel !== null || loading) return;
    loading = true;
    failed = false;
    void import("./SiteInfoPanel.svelte")
      .then((module) => (Panel = module.default))
      .catch(() => (failed = true))
      .finally(() => (loading = false));
  }
</script>

<Disclosure
  label={warning ? m.site_info_label_status({ status: warning }) : m.site_info_label()}
  triggerTitle={warning ?? m.site_info_label()}
  triggerClass="site-info-trigger"
  panelClass="site-info-panel"
  onopen={opened}
  onclose={() => (open = false)}
>
  {#snippet trigger()}
    <span class="site-info-glyph" data-tone={warning ? "warning" : undefined}>
      <Icon icon={warning ? Alert02Icon : SlidersHorizontalIcon} size={14} />
    </span>
  {/snippet}
  {#if Panel}
    <Panel
      {url}
      {security}
      {open}
      {zoom}
      {standardZoom}
      {capture}
      {privateWindow}
      {onSiteSettings}
    />
  {:else if failed}
    <p class="site-info-failed" role="status">{m.surface_render_failed()}</p>
  {/if}
</Disclosure>

<style>
  :global(.site-info-trigger) {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-inset);
    background: transparent;
    color: var(--color-faint);
    cursor: default;
    outline: none;
    transition:
      background-color var(--motion-fast) var(--ease-out),
      color var(--motion-fast) var(--ease-out);
  }

  :global(.site-info-trigger:hover),
  :global(.site-info-trigger[data-state="open"]) {
    background: var(--row-hover);
    color: var(--color-text);
  }

  :global(.site-info-trigger:focus-visible) {
    box-shadow: var(--shadow-field-focus);
  }

  .site-info-glyph {
    display: grid;
    place-items: center;
  }

  .site-info-glyph[data-tone="warning"] {
    color: var(--color-danger);
  }

  /* Under the field, from its edge: the trigger sits a field-padding in. */
  :global(.site-info-panel.ui-disclosure-panel) {
    inset-inline-start: -10px;
    inline-size: min(304px, calc(var(--sidebar-width, 320px) - 24px));
    padding: var(--menu-pad);

    /* A choice opens its menu over the rows below, past this panel's edge. */
    overflow: visible;
  }

  .site-info-failed {
    margin: 0;
    padding: 8px var(--menu-item-inset);
    color: var(--color-muted);
    font-size: var(--text-label);
  }
</style>
