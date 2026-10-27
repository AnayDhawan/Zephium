<script lang="ts">
  import * as m from "$shared/i18n/messages";
  import Button from "$shared/ui/Button";
  import type { PageAssistDecisionV1, PageAssistStepStateV1 } from "$shared/ipc/bindings";
  import "../assist.css";

  let {
    destination,
    query,
    state: status,
    inert,
    ondecide,
  }: {
    destination: string;
    query: string;
    state: PageAssistStepStateV1;
    inert: boolean;
    ondecide: (decision: PageAssistDecisionV1) => void;
  } = $props();

  let answered = $state(false);
  function decide(decision: PageAssistDecisionV1) {
    answered = true;
    ondecide(decision);
  }
</script>

<section class="assist-card search" aria-label={m.assist_search_title({ destination })}>
  <h4>{m.assist_search_title({ destination })}</h4>
  <p>{m.assist_search_disclosure()}</p>
  <p class="query">{query}</p>
  {#if status === "confirm" && !inert}
    <div class="assist-actions">
      <Button variant="primary" size="compact" disabled={answered} onclick={() => decide("approve")}
        >{m.assist_search_approve()}</Button
      >
      <Button variant="ghost" size="compact" disabled={answered} onclick={() => decide("decline")}
        >{m.assist_decline()}</Button
      >
    </div>
  {:else if status === "done"}
    <p>{m.assist_search_done()}</p>
  {:else if status === "declined"}
    <p>{m.assist_step_declined()}</p>
  {:else if status === "failed"}
    <p>{m.assist_step_failed()}</p>
  {/if}
</section>

<style>
  .query {
    color: var(--color-label-primary);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    unicode-bidi: plaintext;
  }
</style>
