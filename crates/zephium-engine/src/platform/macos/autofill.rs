//! The system's AutoFill passwords panel, the one a page's right-click
//! AutoFill ▸ Passwords… opens, shown on request at the field in focus.
//!
//! It is never shown by itself on focus: the panel is drawn by another
//! process that takes the keyboard while it is open, so typing that follows a
//! click into a field would go to the panel instead of the field.

use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject};
use objc2::{msg_send, sel};
use objc2_web_kit::WKWebView;

/// Shows the panel for the field focused in `page`. False when this macOS
/// lacks the panel, or when `page` does not have the keyboard or no text
/// field in it has focus: WebKit has an input context only for an editable
/// element.
pub(crate) fn show_passwords(page: &WKWebView) -> bool {
    let Some(window) = page.window() else {
        return false;
    };
    let typing_here = window.isKeyWindow()
        && window.attachedSheet().is_none()
        && window
            .firstResponder()
            .is_some_and(|responder| std::ptr::addr_eq(&*responder, page));
    if !typing_here {
        return false;
    }
    let Some(context) = page.inputContext() else {
        return false;
    };
    let Some(class) = AnyClass::get(c"NSAutoFillHeuristicController") else {
        return false;
    };
    // SAFETY: main-thread AppKit calls, each guarded by respondsToSelector:
    // on the object it is sent to; the input context is retained above.
    unsafe {
        let shared: bool = msg_send![class, respondsToSelector: sel!(sharedInstance)];
        if !shared {
            return false;
        }
        let controller: Option<Retained<AnyObject>> = msg_send![class, sharedInstance];
        let Some(controller) = controller else {
            return false;
        };
        let show = sel!(showAutoFillPasswordsPopoverForTextInputContext:);
        let shows: bool = msg_send![&*controller, respondsToSelector: show];
        if !shows {
            return false;
        }
        let _: () = msg_send![
            &*controller,
            showAutoFillPasswordsPopoverForTextInputContext: &*context
        ];
    }
    true
}

#[cfg(test)]
mod tests {
    const SOURCE: &str = include_str!("autofill.rs");

    fn body() -> &'static str {
        SOURCE.split("#[cfg(test)]").next().unwrap()
    }

    #[test]
    fn the_panel_opens_only_for_a_page_typing_in_the_key_window() {
        let body = body();
        for guard in [
            "window.isKeyWindow()",
            "attachedSheet().is_none()",
            "std::ptr::addr_eq(&*responder, page)",
            "page.inputContext()",
        ] {
            assert!(body.contains(guard), "{guard}");
        }
    }

    #[test]
    fn every_private_call_is_guarded() {
        let body = body();
        let at = |text: &str| body.find(text).unwrap_or_else(|| panic!("{text}"));
        assert!(
            at("respondsToSelector: sel!(sharedInstance)") < at("msg_send![class, sharedInstance]")
        );
        assert!(
            at("respondsToSelector: show")
                < at("showAutoFillPasswordsPopoverForTextInputContext: &*context")
        );
    }
}
