<script lang="ts">
  import { VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
  import * as m from "$shared/i18n/messages";
  import Icon from "$shared/ui/Icon";
  type AudioDisplayState = { muted: boolean; can_mute: boolean };

  let {
    audio,
    badge = false,
    onToggle,
  }: {
    audio: AudioDisplayState;
    /** A small raised disc on a mark's corner, where there is no row. */
    badge?: boolean;
    /** Asks for the opposite of the mute shown; native state answers. */
    onToggle: (muted: boolean) => void;
  } = $props();

  let size = $derived(badge ? 10 : 13);
  let status = $derived(audio.muted ? m.tab_audio_muted() : m.tab_audio_playing());
</script>

{#if audio.can_mute}
  <button
    type="button"
    class="audio-control"
    data-badge={badge || undefined}
    data-muted={audio.muted || undefined}
    title={status}
    aria-label={audio.muted ? m.tab_unmute() : m.tab_mute()}
    aria-pressed={audio.muted}
    onclick={(event) => {
      event.stopPropagation();
      onToggle(!audio.muted);
    }}
    onpointerdown={(event) => event.stopPropagation()}
    data-zephium-audio-control
  >
    <Icon icon={audio.muted ? VolumeOffIcon : VolumeHighIcon} {size} />
  </button>
{:else}
  <span
    class="audio-control"
    data-badge={badge || undefined}
    role="img"
    title={status}
    aria-label={status}
  >
    <Icon icon={VolumeHighIcon} {size} />
  </span>
{/if}

<style>
  .audio-control {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-control-compact);
    background: transparent;
    color: var(--color-label-secondary);
    cursor: default;
    transition:
      background-color var(--motion-fast) var(--ease-out),
      color var(--motion-fast) var(--ease-out);
  }

  .audio-control[data-badge] {
    inline-size: 16px;
    block-size: 16px;
    border-radius: var(--radius-capsule);
    background: var(--color-float);
    box-shadow: var(--shadow-badge);
  }

  .audio-control[data-muted] {
    color: var(--color-faint);
  }

  button.audio-control:hover {
    background: var(--row-pressed);
    color: var(--color-text);
  }

  button.audio-control:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
