<script lang="ts">
  import { Camera01Icon, Mic01Icon } from "@hugeicons/core-free-icons";
  import { onMount } from "svelte";
  import type {
    PagePermissionPromptDecisionInput,
    PagePermissionPromptEntryView,
  } from "$shared/ipc/bindings";
  import * as m from "$shared/i18n/messages";
  import { pagePermissions as permissions } from "$domain/permissions";
  import Icon from "$shared/ui/Icon";
  import Button from "$shared/ui/Button";

  let { prompt }: { prompt: PagePermissionPromptEntryView } = $props();
  let dialog = $state<HTMLDivElement>();
  let denyButton = $state<HTMLButtonElement>();
  let busy = $derived(permissions.busy());
  let failure = $derived(permissions.failure());
  let camera = $derived(prompt.kinds.includes("camera"));
  let microphone = $derived(prompt.kinds.includes("microphone"));
  let title = $derived(
    camera && microphone
      ? m.page_permission_title_both()
      : camera
        ? m.page_permission_title_camera()
        : m.page_permission_title_microphone(),
  );
  let detail = $derived(
    camera && microphone
      ? m.page_permission_detail_both()
      : camera
        ? m.page_permission_detail_camera()
        : m.page_permission_detail_microphone(),
  );

  onMount(() => queueMicrotask(() => denyButton?.focus()));

  function respond(decision: PagePermissionPromptDecisionInput) {
    if (busy) return;
    permissions.respond(prompt, decision);
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      // Closing the prompt decides nothing beyond this request.
      if (!busy) respond("deny_once");
      return;
    }
    if (event.key !== "Tab") return;
    event.stopPropagation();
    const buttons = Array.from(dialog?.querySelectorAll("button") ?? []);
    const first = buttons.at(0);
    const last = buttons.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4">
  <div
    bind:this={dialog}
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="page-permission-title"
    aria-describedby="page-permission-origin page-permission-detail"
    class="w-[min(360px,calc(100vw-32px))] rounded-panel border border-border-strong bg-raised p-4 text-start shadow-[var(--shadow-overlay)]"
    data-zephium-page-permission-prompt
  >
    <div class="flex items-start gap-3">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-control-compact bg-accent-soft text-accent"
        aria-hidden="true"
      >
        <Icon icon={camera ? Camera01Icon : Mic01Icon} size={19} />
      </span>
      <div class="min-w-0 flex-1">
        <h1 id="page-permission-title" class="text-[14px] leading-5 font-semibold text-text">
          {title}
        </h1>
        <p id="page-permission-origin" class="mt-0.5 text-[11.5px] leading-4 break-all text-muted">
          {prompt.origin}
        </p>
      </div>
    </div>

    <p id="page-permission-detail" class="mt-3 text-[11.5px] leading-4 text-text">
      {detail}
    </p>

    {#if !prompt.rememberable}
      <p class="mt-3 rounded-row bg-fill px-2.5 py-2 text-[10.5px] leading-4 text-muted">
        {m.page_permission_ask_again()}
      </p>
    {/if}

    {#if failure !== null}
      <p role="alert" class="mt-2.5 text-[10.5px] leading-4 text-danger">{failure}</p>
    {:else if busy}
      <p role="status" class="mt-2.5 text-[10.5px] leading-4 text-muted">
        {m.page_permission_applying()}
      </p>
    {/if}

    {#if prompt.rememberable}
      <div class="mt-4 flex flex-col gap-1.5">
        <Button
          variant="secondary"
          class="w-full"
          disabled={busy}
          aria-busy={busy || undefined}
          onclick={() => respond("always_allow")}
        >
          {m.page_permission_allow_always()}
        </Button>
        <Button
          variant="secondary"
          class="w-full"
          disabled={busy}
          aria-busy={busy || undefined}
          onclick={() => respond("allow_once")}
        >
          {m.page_permission_allow_once()}
        </Button>
        <Button
          bind:ref={denyButton}
          variant="secondary"
          class="w-full"
          disabled={busy}
          aria-busy={busy || undefined}
          onclick={() => respond("always_deny")}
        >
          {m.page_permission_deny_always()}
        </Button>
      </div>
    {:else}
      <div class="mt-4 flex justify-end gap-2">
        <Button
          bind:ref={denyButton}
          variant="secondary"
          disabled={busy}
          aria-busy={busy || undefined}
          onclick={() => respond("deny_once")}
        >
          {m.page_permission_deny()}
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          aria-busy={busy || undefined}
          onclick={() => respond("allow_once")}
        >
          {m.page_permission_allow_once()}
        </Button>
      </div>
    {/if}
  </div>
</div>
