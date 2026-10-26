<script lang="ts">
  import { surface as browserPage } from "$domain/surface";
  import { webext } from "$domain/webext";
  import * as m from "$shared/i18n/messages";
</script>

<!-- Laid over the whole row of the section it sits in, under everything the
     row draws, so the row opens the manager from anywhere on it except the
     buttons that have a job of their own. -->
{#if webext.isAvailable()}
  <button
    type="button"
    data-dismiss
    class="manage"
    aria-label={m.webext_manage()}
    title={m.webext_manage()}
    onclick={() => void browserPage.open("extensions")}
  ></button>
{/if}

<style>
  .manage {
    position: absolute;
    inset: 0;
    padding: 0;
    border: 0;
    border-radius: inherit;
    background: transparent;
    cursor: default;
    outline: none;
    transition: background-color var(--motion-instant) var(--ease-smooth);
  }

  .manage:hover,
  .manage:focus-visible {
    background: var(--row-active);
  }

  .manage:focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: -2px;
  }
</style>
