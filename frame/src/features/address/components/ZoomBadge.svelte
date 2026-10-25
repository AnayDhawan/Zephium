<script lang="ts">
  import * as m from "$shared/i18n/messages";
  import {
    Add01Icon,
    MinusSignIcon,
    SearchAddIcon,
    SearchMinusIcon,
  } from "@hugeicons/core-free-icons";
  import { commands } from "$shared/ipc/bindings";
  import Button from "$shared/ui/Button";
  import Disclosure from "$shared/ui/Disclosure";
  import Icon from "$shared/ui/Icon";
  import IconButton from "$shared/ui/IconButton";

  /** `percent` is the page's zoom; `standard` is what pages show at unless
   *  zoomed, which decides whether the glass magnifies or reduces. */
  let { percent, standard }: { percent: number; standard: number } = $props();
  const shown = $derived(m.zoom_percent({ percent }));
  const step = (command: string) => void commands.runCommand(command);
</script>

<!--
  Present only while the page is not at the default, as the address field's
  own record of it: the keys and the wheel zoom without a visible result, and
  this is where the person sees the level and puts it back.
-->
<Disclosure
  label={m.zoom_badge_label({ percent: shown })}
  triggerClass="zoom-badge"
  panelClass="zoom-panel"
  align="end"
>
  {#snippet trigger()}
    <Icon icon={percent > standard ? SearchAddIcon : SearchMinusIcon} size={13} />
    <span class="zoom-percent">{shown}</span>
  {/snippet}
  <div class="zoom-controls">
    <IconButton
      icon={MinusSignIcon}
      size={14}
      buttonSize={26}
      label={m.command_zoom_out()}
      onclick={() => step("zoom.out")}
    />
    <output class="zoom-level" aria-live="polite">{shown}</output>
    <IconButton
      icon={Add01Icon}
      size={14}
      buttonSize={26}
      label={m.command_zoom_in()}
      onclick={() => step("zoom.in")}
    />
    <Button size="compact" onclick={() => step("zoom.reset")}>{m.zoom_reset()}</Button>
  </div>
</Disclosure>

<style>
  :global(.zoom-badge) {
    display: flex;
    align-items: center;
    gap: 4px;
    block-size: 24px;
    padding-inline: 6px;
    border: 0;
    border-radius: var(--radius-inset);
    background: transparent;
    color: var(--color-label-secondary);
    cursor: default;
    outline: none;
    transition:
      background-color var(--motion-fast) var(--ease-out),
      color var(--motion-fast) var(--ease-out);
  }

  :global(.zoom-badge:hover),
  :global(.zoom-badge[data-state="open"]) {
    background: var(--row-hover);
    color: var(--color-text);
  }

  :global(.zoom-badge:focus-visible) {
    box-shadow: var(--shadow-field-focus);
  }

  .zoom-percent {
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
  }

  :global(.zoom-panel) {
    min-inline-size: 0;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
  }

  .zoom-level {
    min-inline-size: 44px;
    color: var(--color-text);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
</style>
