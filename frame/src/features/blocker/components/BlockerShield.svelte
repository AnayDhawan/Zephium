<script lang="ts">
  import { untrack } from "svelte";
  import * as m from "$shared/i18n/messages";
  import { blocker, shieldPresentation } from "$domain/blocker";

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
  <section class="protection" aria-label={m.site_info_blocking()}>
    <span class="title">{m.site_info_blocking()}</span>
    {#if failed}<span class="failure" role="status">{m.surface_render_failed()}</span>{/if}
  </section>
{/if}

<style>
  .protection {
    display: grid;
    gap: 2px;
    min-block-size: 38px;
    padding-inline: var(--menu-item-inset);
  }

  .title {
    font-size: var(--text-body);
    line-height: 18px;
  }

  .failure {
    color: var(--color-warning);
    font-size: var(--text-caption);
  }
</style>
