//! Waits in a page's own isolated world for a password field to take focus.
use objc2::runtime::AnyObject;
use objc2::{msg_send, ClassType};
use objc2_foundation::{MainThreadMarker, NSError, NSString};
use objc2_web_kit::WKContentWorld;
use std::cell::RefCell;

const WORLD: &str = "zephium-password-focus";

/// Runs `script` in the main frame. `done` gets whether it answered that a
/// password field took focus; a navigation or a newer watch answers false.
pub(crate) fn watch(view: &wry::WebView, script: &str, done: impl FnOnce(bool) + 'static) -> bool {
    let Some(mtm) = MainThreadMarker::new() else {
        return false;
    };
    let pending = RefCell::new(Some(done));
    let callback = block2::RcBlock::new(move |value: *mut AnyObject, error: *mut NSError| {
        let Some(done) = pending.borrow_mut().take() else {
            return;
        };
        let focused = !value.is_null()
            && error.is_null()
            // SAFETY: WebKit owns this callback-scoped object; its class is
            // checked before the cast.
            && unsafe {
                let string: bool = msg_send![value, isKindOfClass: NSString::class()];
                string && (*value.cast::<NSString>()).to_string() == "1"
            };
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| done(focused)));
    });
    let page = super::native_webview(view);
    // SAFETY: a fixed host-selected evaluation on the main thread; WebKit
    // retains the completion until the promise settles or the page leaves.
    unsafe {
        let world = WKContentWorld::worldWithName(&NSString::from_str(WORLD), mtm);
        page.callAsyncJavaScript_arguments_inFrame_inContentWorld_completionHandler(
            &NSString::from_str(&format!("return await ({script});")),
            None,
            None,
            &world,
            Some(&callback),
        );
    }
    true
}
