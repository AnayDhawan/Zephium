<script lang="ts">
  import { ShieldAlertIcon, ShieldCheckIcon } from "@hugeicons/core-free-icons";
  import * as m from "$shared/i18n/messages";
  import Icon from "$shared/ui/Icon";
  import { restingAddress, type SitePage } from "../lib/address-model";

  /** Who the page is from and whether the connection can be trusted. A secure
   *  page says so on its shield alone; one that is not says why in words. */
  let { page }: { page: SitePage | null } = $props();

  let host = $derived(restingAddress(page?.url));
  let secure = $derived(page?.security === "secure");
  let status = $derived(
    page?.security === "untrusted"
      ? m.site_info_untrusted()
      : page?.security === "insecure"
        ? m.site_info_insecure()
        : m.site_info_secure(),
  );
</script>

{#if page}
  <header>
    <span
      class="mark"
      role="img"
      aria-label={status}
      title={status}
      data-secure={secure || undefined}
    >
      <Icon icon={secure ? ShieldCheckIcon : ShieldAlertIcon} size={16} />
    </span>
    <span class="words">
      <span class="host" title={host}>{host}</span>
      {#if !secure}<span class="status">{status}</span>{/if}
    </span>
  </header>
{/if}

<style>
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: var(--menu-row);
    padding-inline: var(--menu-item-inset);
  }

  .mark {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: 16px;
    block-size: 16px;
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
    line-height: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status {
    color: var(--color-danger);
    font-size: var(--text-caption);
    line-height: 14px;
  }
</style>
