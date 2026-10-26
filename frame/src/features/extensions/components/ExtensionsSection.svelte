<script lang="ts">
  import { webext } from "$domain/webext";
  import ExtensionActions from "./ExtensionActions.svelte";
  import ManageExtensions from "./ManageExtensions.svelte";
</script>

<!-- Stays mounted while the panel is closed: an extension's key opens its
     action from the buttons here. -->
{#if webext.isAvailable()}
  <div class="extensions">
    <ExtensionActions />
    <ManageExtensions />
  </div>
{/if}

<style>
  .extensions {
    display: grid;
    gap: 2px;
  }
</style>
