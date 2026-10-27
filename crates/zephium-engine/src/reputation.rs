//! One startup choice for every Windows WebView2 controller. WebView2 joins
//! per-controller requirements across a user-data folder, so mixing choices
//! would leave SmartScreen on even after the person switched it off.

#[cfg(target_os = "windows")]
static REQUIRED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();

/// Install the persisted choice before constructing any Windows WebViews.
/// Changes made in Settings take effect after restarting the application.
#[cfg(target_os = "windows")]
pub fn initialize(required: bool) -> bool {
    REQUIRED.set(required).is_ok()
}

#[cfg(target_os = "windows")]
pub fn configure(
    core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2,
) -> windows_core::Result<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings8;
    use windows_core::Interface;
    let required = REQUIRED.get().copied().unwrap_or(true);
    // The getter proves the native requirement, not the effective OS policy:
    // Windows can independently disable reputation checking.
    let settings = unsafe { core.Settings()? }.cast::<ICoreWebView2Settings8>()?;
    unsafe { settings.SetIsReputationCheckingRequired(required)? };
    let mut actual = windows_core::BOOL::default();
    unsafe { settings.IsReputationCheckingRequired(&mut actual)? };
    if actual.as_bool() != required {
        return Err(windows::Win32::Foundation::E_ACCESSDENIED.into());
    }
    Ok(())
}
