<script lang="ts">
  import { untrack } from "svelte";
  import { ShieldBanIcon } from "@hugeicons/core-free-icons";
  import * as m from "$shared/i18n/messages";
  import { blocker, shieldPresentation } from "$domain/blocker";
  import Icon from "$shared/ui/Icon";

  /** The blocking section of the site panel. Its controls load the first time
   *  the panel is open, a failed load is tried again at the next, and the
   *  standing is read afresh at every opening. */
  let { open }: { open: boolean } = $props();
  let Menu = $state<typeof import("./ProtectionMenu.svelte").default | null>(null);
  let failed = $state(false);
  let loading = false;

  $effect(() => {
    if (!open) return;
    untrack(() => {
      void blocker.refresh();
      if (Menu !== null || loading) return;
      loading = true;
      failed = false;
      void import("./ProtectionMenu.svelte")
        .then((module) => (Menu = module.default))
        .catch(() => (failed = true))
        .finally(() => (loading = false));
    });
  });
  let shield = $derived(shieldPresentation(blocker.status()));
</script>

{#if Menu}
  <Menu {open} />
{:else if shield.visible}
  <section class="protection" aria-label={m.site_info_blocking()} data-tray-tools>
    <div class="head">
      <span class="ui-menu-icon" aria-hidden="true"><Icon icon={ShieldBanIcon} size={16} /></span>
      <span class="title">{m.site_info_blocking()}</span>
    </div>
    {#if failed}<p class="failure" role="status">{m.surface_render_failed()}</p>{/if}
  </section>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: var(--menu-row);
    padding-inline: var(--menu-item-inset);
  }

  .title {
    font-size: var(--text-body);
    line-height: 18px;
  }

  .failure {
    margin: 0 var(--menu-item-inset) 4px;
    color: var(--color-warning);
    font-size: var(--text-caption);
  }
</style>
