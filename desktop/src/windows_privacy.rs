//! Opens one fixed Windows settings pane; chrome cannot choose a shell URI.
use super::*;

#[cfg(any(target_os = "windows", test))]
fn required(readback: zephium_core::ports::store::AppSettingReadback) -> Option<bool> {
    use zephium_core::ports::store::AppSettingReadback;
    match readback {
        AppSettingReadback::Value(value) => Some(zephium_core::preferences::smartscreen_required(
            Some(&value),
        )),
        AppSettingReadback::Missing => Some(true),
        AppSettingReadback::Unavailable => None,
    }
}

#[cfg(target_os = "windows")]
pub(crate) fn initialize(store: &dyn zephium_core::ports::store::Store) -> std::io::Result<()> {
    let required = required(store.app_setting_readback("privacy.smartscreen"))
        .ok_or_else(|| std::io::Error::other("Windows reputation preference is unavailable"))?;
    if !zephium_engine::initialize_windows_reputation_checking(required) {
        return Err(std::io::Error::other(
            "Windows reputation policy is already initialized",
        ));
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub(crate) fn windows_diagnostics_settings(caller: WebviewWindow) -> bool {
    if !authorize(&caller, CallerPolicy::Main, "windows_diagnostics_settings") {
        return false;
    }
    #[cfg(target_os = "windows")]
    {
        use windows::core::w;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        // SAFETY: fixed trusted URI and verb, no user-controlled shell input.
        let result = unsafe {
            ShellExecuteW(
                None,
                w!("open"),
                w!("ms-settings:privacy-feedback"),
                None,
                None,
                SW_SHOWNORMAL,
            )
        };
        result.0 as isize > 32
    }
    #[cfg(not(target_os = "windows"))]
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use zephium_core::ports::store::AppSettingReadback;
    #[test]
    fn unavailable_privacy_settings_never_become_default_on_at_startup() {
        assert_eq!(required(AppSettingReadback::Unavailable), None);
        assert_eq!(required(AppSettingReadback::Missing), Some(true));
        assert_eq!(
            required(AppSettingReadback::Value("true".into())),
            Some(true)
        );
        assert_eq!(
            required(AppSettingReadback::Value("false".into())),
            Some(false)
        );
    }
}
