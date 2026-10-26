<script lang="ts">
  import "$shared/ui/Button/control.css";
  import "$shared/ui/Shine/shine.css";
  import Disclosure from "$shared/ui/Disclosure";

  /** One choice from a few, in the control every select is drawn as, opening a
   *  short menu under itself. The panel it sits in already holds a
   *  Disclosure, so this is another rather than a portalled list. */
  let {
    label,
    options,
    value,
    onchange,
  }: {
    label: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    value: string;
    onchange: (value: string) => void;
  } = $props();

  let current = $derived(options.find((option) => option.value === value)?.label ?? "");
</script>

<!-- Pressing the trigger keeps the focus where it is. Where a button is not
     focused by a press, the panel around this takes it instead, and the menu
     closing on that would leave the click to open it again. -->
<span
  class="wrap"
  role="presentation"
  onmousedowncapture={(event) => {
    if (event.target instanceof Element && event.target.closest(".choice-trigger"))
      event.preventDefault();
  }}
>
  <Disclosure
    {label}
    menu
    align="end"
    triggerClass="ui-control ui-shine ui-shine-press choice-trigger"
    panelClass="choice-panel"
  >
    {#snippet trigger()}
      <span class="value">{current}</span>
      <svg
        class="chevrons"
        aria-hidden="true"
        viewBox="0 0 12 16"
        width="11"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 6.5L6 3.5l3 3" />
        <path d="M3 9.5l3 3 3-3" />
      </svg>
    {/snippet}
    <!-- A press keeps the focus where it is: the panel around this menu can take
       focus, and the focus leaving this menu would close it before the click. -->
    {#each options as option (option.value)}
      <button
        type="button"
        role="menuitem"
        class="ui-menu-item choice"
        aria-current={option.value === value || undefined}
        onmousedown={(event) => event.preventDefault()}
        onclick={() => onchange(option.value)}
      >
        <span class="text">{option.label}</span>
        <span class="ui-menu-mark" aria-hidden="true">
          {#if option.value === value}
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor">
              <path
                d="M2 6.3l2.7 2.7L10 3.4"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {/if}
        </span>
      </button>
    {/each}
  </Disclosure>
</span>

<style>
  .wrap {
    display: contents;
  }

  :global(.choice-trigger) {
    justify-content: space-between;
    gap: 8px;
    min-inline-size: 84px;
    padding-inline: var(--control-inset) 10px;
    font-weight: 450;
  }

  .value {
    min-inline-size: 0;
    flex: 1;
    overflow: hidden;
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevrons {
    flex: none;
    color: var(--color-muted);
  }

  /* Solid, so the row it opens over never reads through, as every select's is. */
  :global(.choice-panel.ui-disclosure-panel) {
    min-inline-size: 112px;
    background: var(--color-float);
    backdrop-filter: none;
  }

  .choice {
    inline-size: 100%;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: var(--text-body);
    text-align: start;
  }

  .choice:focus-visible,
  .choice:hover {
    background: var(--row-active);
  }

  .text {
    flex: 1;
    min-inline-size: 0;
    white-space: nowrap;
  }
</style>
