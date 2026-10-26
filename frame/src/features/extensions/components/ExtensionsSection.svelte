<script lang="ts">
  import { ArrowRight01Icon, PuzzleIcon } from "@hugeicons/core-free-icons";
  import { extensions } from "$domain/extensions";
  import { tabs } from "$domain/tabs";
  import { webext } from "$domain/webext";
  import * as m from "$shared/i18n/messages";
  import Icon from "$shared/ui/Icon";
  import ExtensionActions from "./ExtensionActions.svelte";
  import ManageExtensions from "./ManageExtensions.svelte";

  let failure = $derived(extensions.failureReason(tabs.profile()?.id ?? null, tabs.activeId()));

  const failureMessage = (reason: ReturnType<typeof extensions.failureReason>) => {
    switch (reason) {
      case "tab_discarded":
        return "This tab is sleeping. Activate it before opening the extension.";
      case "action_disabled":
        return "This extension action is disabled on the current page.";
      case "popup_capacity_exceeded":
      case "capacity_exceeded":
        return "Close the current extension popup and try again.";
      case "unsupported_platform":
        return "This extension action is not supported on this platform.";
      case "shutting_down":
        return "Extensions are unavailable while Zephium is closing.";
      case "runtime_superseded":
      case "runtime_unavailable":
      case "tab_unavailable":
      case "action_unavailable":
        return "The extension changed. Try the action again.";
      case "popup_unavailable":
        return "This extension popup is unavailable.";
      case "invalid_request":
      case "native_admission_failed":
        return "Zephium couldn't open this extension action.";
      case null:
        return "";
    }
  };
</script>

<!-- Stays mounted while the panel is closed: an extension's key opens its
     action from the buttons here. One row: the name, each extension's own
     button, and the way to manage them, which is the rest of the row. -->
{#if webext.isAvailable()}
  <div class="extensions" data-tray-tools>
    <div class="row">
      <ManageExtensions />
      <span class="ui-menu-icon" aria-hidden="true"><Icon icon={PuzzleIcon} size={16} /></span>
      <span class="name">{m.webext_page_title()}</span>
      <ExtensionActions />
      <span class="chevron" aria-hidden="true"><Icon icon={ArrowRight01Icon} size={14} /></span>
    </div>
    {#if failure !== null}
      <p role="status" aria-live="polite" class="failure">{failureMessage(failure)}</p>
    {/if}
  </div>
{/if}

<style>
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: var(--menu-row);
    padding: 3px var(--menu-item-inset);
    border-radius: calc(var(--radius-menu) - var(--menu-pad));
  }

  /* The name starts where every row's does, a gutter past the icon. */
  .ui-menu-icon {
    margin-inline-end: 2px;
  }

  /* Over the row's button, and out of the pointer's way. */
  .ui-menu-icon,
  .name,
  .chevron {
    position: relative;
    pointer-events: none;
  }

  .name {
    flex: none;
    max-inline-size: 50%;
    overflow: hidden;
    font-size: var(--text-body);
    font-weight: 450;
    line-height: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    display: grid;
    flex: none;
    margin-inline-start: auto;
    color: var(--color-faint);
    transition: color var(--motion-instant) var(--ease-smooth);
  }

  .row:hover .chevron {
    color: var(--color-text);
  }

  .failure {
    margin-block: 0 4px;
    margin-inline: calc(var(--menu-item-inset) + 26px) var(--menu-item-inset);
    font-size: var(--text-label);
    line-height: 1.4;
    color: var(--color-muted);
  }
</style>
