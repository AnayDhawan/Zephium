<script lang="ts">
  import { ArrowRight01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
  import * as m from "$shared/i18n/messages";
  import { blocker, blockerSites, hiding, shieldPresentation } from "$domain/blocker";
  import { tabs } from "$domain/tabs";
  import type { BlockerSiteAction } from "$shared/ipc/bindings";
  import { commands } from "$shared/ipc/bindings";
  import Icon from "$shared/ui/Icon";
  import Switch from "$shared/ui/Switch";

  /** Reads the day's count each time `open` turns true. */
  let { open }: { open: boolean } = $props();
  let status = $derived(blocker.status());
  let shield = $derived(shieldPresentation(status));
  let site = $derived(status.site);
  let on = $derived(status.applied_enabled === true);
  let busy = $state(false);
  let managing = $state(false);
  let failure = $state("");
  let contextKey = $derived(
    site ? `${site.context.profile}:${site.context.tab}:${site.context.site}` : "",
  );
  $effect(() => {
    void contextKey;
    failure = "";
    managing = false;
  });

  let blockedToday = $state<number | null>(null);
  // The day's count belongs to the profile, so it reads on pages without a
  // site too (the new tab); keyed to the id, as `site` is new on every event.
  let profile = $derived(tabs.profile()?.id);
  $effect(() => {
    if (!open || !profile) return;
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

  function ok(result: blocker.BlockerMutationResult) {
    return (
      result.state === "processed" &&
      (result.disposition.outcome === "applied" || result.disposition.outcome === "no_op")
    );
  }

  // The context's revision moves with every change, so each step reads it fresh.
  async function change(action: BlockerSiteAction): Promise<boolean> {
    const context = blocker.status().site?.context;
    if (!context) return false;
    const done = ok(await blockerSites.changeSite(context, action));
    if (!done) failure = m.site_info_blocking_failed();
    return done;
  }

  async function run(task: () => Promise<void>) {
    if (busy) return;
    busy = true;
    failure = "";
    try {
      await task();
    } finally {
      busy = false;
    }
  }

  const setProtected = (protect: boolean) =>
    run(async () => {
      if (!(await blockerSites.setProtected(protect))) failure = m.site_info_blocking_failed();
    });

  const enable = () =>
    run(async () => {
      if (!ok(await blocker.setEnabled(true))) failure = m.site_info_blocking_enable_failed();
    });

  const showAgain = (ids: string[]) =>
    run(async () => {
      for (const id of ids) if (!(await change({ kind: "remove_hide", id }))) return;
    });

  async function hide() {
    if (site && !(await hiding.start(site.context))) failure = m.site_info_hide_failed();
  }
</script>

{#if shield.visible}
  <section class="protection" aria-label={m.site_info_blocking()}>
    <div class="head">
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

    {#if status.desired_enabled !== true}
      <button
        type="button"
        class="ui-menu-item row"
        disabled={busy || !status.can_enable || status.preference !== "authoritative"}
        onclick={() => void enable()}>{m.site_info_blocking_enable()}</button
      >
    {/if}

    {#if site && on}
      {#if site.ready}
        <button
          type="button"
          class="ui-menu-item row"
          data-dismiss
          disabled={busy || site.busy}
          onclick={() => void hide()}>{m.site_info_hide_elements()}</button
        >
      {:else}
        <button
          type="button"
          class="ui-menu-item row"
          disabled={busy || site.busy}
          onclick={() => void run(async () => void (await change({ kind: "retry" })))}
          >{m.site_info_blocking_retry()}</button
        >
      {/if}
      {#if site.hides.length > 0}
        <button
          type="button"
          class="ui-menu-item row"
          aria-expanded={managing}
          onclick={() => (managing = !managing)}
        >
          <span>{m.site_info_hidden()}</span>
          <span class="count">{site.hides.length}</span>
          <span class="chevron" class:open={managing}
            ><Icon icon={ArrowRight01Icon} size={14} /></span
          >
        </button>
        {#if managing}
          <ul class="hides">
            {#each site.hides as hide (hide.id)}
              <li>
                <span class="label" title={hide.label}>{hide.label}</span>
                <button
                  type="button"
                  class="restore"
                  title={m.site_info_hidden_show({ name: hide.label })}
                  aria-label={m.site_info_hidden_show({ name: hide.label })}
                  disabled={busy || site.busy}
                  onclick={() => void showAgain([hide.id])}
                  ><Icon icon={Cancel01Icon} size={12} /></button
                >
              </li>
            {/each}
            {#if site.hides.length > 1}
              <li>
                <button
                  type="button"
                  class="all"
                  disabled={busy || site.busy}
                  onclick={() => void showAgain(site?.hides.map((hide) => hide.id) ?? [])}
                  >{m.site_info_hidden_show_all()}</button
                >
              </li>
            {/if}
          </ul>
        {/if}
      {/if}
    {/if}

    {#if failure}<p class="failure" role="status">{failure}</p>{/if}
  </section>
{/if}

<style>
  .protection {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-block-size: 38px;
    padding-inline: var(--menu-item-inset);
  }

  .words {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-inline-size: 0;
  }

  .title {
    font-size: var(--text-body);
    line-height: 18px;
    text-wrap: balance;
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

  .row {
    inline-size: 100%;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: var(--text-body);
    text-align: start;
  }

  .row:disabled {
    opacity: 0.45;
  }

  .row:focus-visible,
  .row:hover:not(:disabled) {
    background: var(--row-active);
  }

  .count {
    margin-inline-start: auto;
    color: var(--color-muted);
    font-size: var(--text-caption);
    font-variant-numeric: tabular-nums;
  }

  .chevron {
    display: grid;
    color: var(--color-faint);
    transition: rotate var(--motion-fast) var(--ease-out);
  }

  .chevron.open {
    rotate: 90deg;
  }

  .hides {
    max-block-size: 184px;
    margin: 0 0 2px;
    padding: 0 0 0 calc(var(--menu-item-inset) + 8px);
    overflow: auto;
    list-style: none;
  }

  .hides li {
    display: flex;
    align-items: center;
    gap: 6px;
    min-block-size: 28px;
    padding-inline-end: 4px;
  }

  .label {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    color: var(--color-text);
    font-size: var(--text-caption);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .restore {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    border: 0;
    border-radius: var(--radius-inset);
    background: transparent;
    color: var(--color-faint);
    cursor: default;
  }

  .restore:hover:not(:disabled) {
    background: var(--row-hover);
    color: var(--color-text);
  }

  .all {
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: var(--color-muted);
    font: inherit;
    font-size: var(--text-caption);
    cursor: default;
  }

  .all:hover:not(:disabled) {
    color: var(--color-text);
  }

  .failure {
    margin: 2px var(--menu-item-inset) 4px;
    color: var(--color-warning);
    font-size: var(--text-caption);
  }
</style>
