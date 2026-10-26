<script lang="ts">
  import * as m from "$shared/i18n/messages";
  import { blocker, blockerSites, shieldPresentation } from "$domain/blocker";
  import { tabs } from "$domain/tabs";
  import { commands } from "$shared/ipc/bindings";
  import Switch from "$shared/ui/Switch";

  /** Reads the standing and the day's count each time `open` turns true. */
  let { open }: { open: boolean } = $props();

  let status = $derived(blocker.status());
  let shield = $derived(shieldPresentation(status));
  let site = $derived(status.site);
  let on = $derived(status.applied_enabled === true);
  let profile = $derived(tabs.profile()?.id);
  let blockedToday = $state<number | null>(null);
  let busy = $state(false);
  let failed = $state(false);

  $effect(() => {
    if (!open) return;
    failed = false;
    void blocker.refresh();
    if (!profile) return;
    let current = true;
    void commands
      .blockerStats(profile)
      .then((result) => {
        if (current) blockedToday = result.status === "ok" ? result.data.today : null;
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  });

  let standing = $derived(
    status.protection === "disabled"
      ? m.site_info_blocking_off()
      : status.protection === "pending"
        ? m.site_info_blocking_starting()
        : status.protection === "degraded"
          ? m.site_info_blocking_attention()
          : site?.paused
            ? m.site_info_blocking_paused()
            : blockedToday === null
              ? m.site_info_blocking_on()
              : m.site_info_blocking_count({ count: blockedToday.toLocaleString() }),
  );

  async function setProtected(protect: boolean) {
    if (busy) return;
    busy = true;
    failed = !(await blockerSites.setProtected(protect));
    busy = false;
  }
</script>

{#if shield.visible}
  <section class="blocking" aria-label={m.site_info_blocking()}>
    <div class="row">
      <div class="words">
        <span class="title" aria-hidden="true">{m.site_info_blocking()}</span>
        <span class="standing" class:warning={shield.tone === "warning"}>{standing}</span>
      </div>
      {#if on && site?.ready}
        <Switch
          label={m.site_info_blocking()}
          labelHidden
          checked={!site.paused}
          disabled={busy || site.busy}
          onchange={(value) => void setProtected(value)}
        />
      {/if}
    </div>
    {#if failed}<p class="failure" role="alert">{m.site_info_blocking_failed()}</p>{/if}
  </section>
{/if}

<style>
  .blocking {
    display: grid;
    gap: 2px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-block-size: 38px;
  }

  .words {
    display: grid;
    flex: 1;
    min-inline-size: 0;
  }

  .title {
    font-size: var(--text-body);
    line-height: 18px;
  }

  .standing {
    overflow: hidden;
    color: var(--color-muted);
    font-size: var(--text-caption);
    font-variant-numeric: tabular-nums;
    line-height: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .standing.warning {
    color: var(--color-warning);
  }

  .failure {
    margin: 0;
    color: var(--color-warning);
    font-size: var(--text-label);
    line-height: 16px;
  }
</style>
