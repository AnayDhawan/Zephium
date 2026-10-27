<script lang="ts">
  import * as m from "$shared/i18n/messages";
  import { commands } from "$shared/ipc/bindings";
  import SettingsGroup from "$shared/ui/SettingsGroup";
  import SettingsRow from "$shared/ui/SettingsRow";
  import Button from "$shared/ui/Button";
  import PreferenceSwitch from "./PreferenceSwitch.svelte";

  let opening = $state(false);
  let failed = $state(false);
  async function openDiagnostics() {
    if (opening) return;
    opening = true;
    failed = false;
    try {
      failed = !(await commands.windowsDiagnosticsSettings());
    } catch {
      failed = true;
    } finally {
      opening = false;
    }
  }
</script>

<SettingsGroup title={m.privacy_windows_group()} description={m.privacy_windows_policy()}>
  <PreferenceSwitch id="privacy.smartscreen" preference="privacy.smartscreen" />
  <SettingsRow
    title={m.privacy_windows_diagnostics()}
    description={m.privacy_windows_diagnostics_help()}
  >
    <Button disabled={opening} onclick={() => void openDiagnostics()}
      >{m.privacy_windows_diagnostics_open()}</Button
    >
  </SettingsRow>
  <SettingsRow
    title={m.privacy_microsoft_statement()}
    description={m.privacy_microsoft_statement_help()}
  >
    <Button
      variant="ghost"
      onclick={() =>
        void commands
          .browserOpenUrl("https://privacy.microsoft.com/privacystatement", true)
          .catch(() => {})}>{m.privacy_microsoft_statement_open()}</Button
    >
  </SettingsRow>
  {#if failed}<p class="feedback" role="status">{m.privacy_windows_diagnostics_failed()}</p>{/if}
</SettingsGroup>

<style>
  .feedback {
    margin: 12px 18px;
    color: var(--color-muted);
    font-size: var(--text-body);
  }
</style>
